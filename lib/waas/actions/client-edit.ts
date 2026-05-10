'use server'

// =============================================================================
// lib/waas/actions/client-edit.ts
// Token-scoped server actions for the client self-service editor.
//
// All actions authenticate via reviewToken (no Supabase auth session).
// Token is SHA-256 hashed before storage in audit logs.
//
// Exports:
//   getClientEditSession          — load session + permissions
//   updateClientVariantContent    — patch a variant's sections_json
//   uploadClientAsset             — register an uploaded asset CDN URL
//   requestAiRewrite              — AI-assisted text rewrite intent
//   submitClientApproval          — final approval by client
//   revokeClientApproval          — un-approve within grace period
// =============================================================================

import { createClient }          from '@supabase/supabase-js'
import { revalidatePath }        from 'next/cache'
import {
  resolveClientEditSession,
  canClientEditVariant,
  hashReviewToken,
  type ClientEditSession,
} from '@/lib/waas/client-edit/edit-session'
import {
  validateEditPath,
  getValueAtPath,
  setValueAtPath,
  serializeForHistory,
  type JsonValue,
} from '@/lib/waas/client-edit/content-paths'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ActionResult<T = null> {
  success: boolean
  data?:   T
  error?:  string
}

export type EditType =
  | 'text_edit'
  | 'image_swap'
  | 'color_change'
  | 'ai_rewrite'
  | 'section_toggle'

// ---------------------------------------------------------------------------
// Internal: service-role admin client (same pattern as admin.ts)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase admin env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Internal: classify which EditType a path maps to
// ---------------------------------------------------------------------------

function classifyEditType(path: string): EditType {
  if (/\.enabled$/.test(path)) return 'section_toggle'
  if (/image_url$|logo_url$/.test(path)) return 'image_swap'
  if (/color$/.test(path)) return 'color_change'
  return 'text_edit'
}

// =============================================================================
// 1. getClientEditSession
//    Returns the full session object so the editor page can render correctly.
// =============================================================================

export async function getClientEditSession(
  reviewToken: string,
): Promise<ActionResult<ClientEditSession>> {
  const result = await resolveClientEditSession(reviewToken)

  if (!result.ok) {
    return { success: false, error: result.message }
  }

  return { success: true, data: result.session }
}

// =============================================================================
// 2. updateClientVariantContent
//    JSONPath-based patch of sections_json in tenant_site_variants.
//    Writes an audit event to client_variant_edit_events.
//    Returns the new sections array on success.
//
//    IMPORTANT: sections_json is stored as a top-level array — but our path
//    convention reads naturally as "sections[N].content.headline". We wrap
//    the array in { sections: [...] } for pathing, then unwrap before save.
// =============================================================================

export interface UpdateContentArgs {
  reviewToken:   string
  variantIndex:  number
  path:          string   // e.g. "sections[0].content.headline"
  newValue:      JsonValue
  aiIntent?:     string   // set if the edit was AI-assisted
}

export async function updateClientVariantContent(
  args: UpdateContentArgs,
): Promise<ActionResult<{ sections: JsonValue }>> {
  const { reviewToken, variantIndex, path, newValue, aiIntent } = args

  // --- Permission gate ---
  const perm = await canClientEditVariant(reviewToken)
  if (!perm.allowed) {
    return { success: false, error: perm.reason }
  }

  // --- Validate path ---
  const pathCheck = validateEditPath(path)
  if (!pathCheck.valid) {
    return { success: false, error: pathCheck.reason }
  }

  // --- Validate value is not undefined ---
  if (newValue === undefined) {
    return { success: false, error: 'newValue must not be undefined' }
  }

  // --- Resolve session for tenant context ---
  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message }
  }
  const { tenantId } = sessionResult.session
  const tokenHash   = hashReviewToken(reviewToken)

  try {
    const supabase = getAdminClient()

    // Fetch current variant sections_json
    const { data: variantRow, error: fetchErr } = await supabase
      .from('tenant_site_variants')
      .select('id, sections_json, client_edit_count')
      .eq('tenant_id', tenantId)
      .eq('variant_index', variantIndex)
      .single()

    if (fetchErr || !variantRow) {
      return { success: false, error: 'Variant not found.' }
    }

    const variant = variantRow as {
      id:                string
      sections_json:     JsonValue
      client_edit_count: number | null
    }

    // Wrap the array in { sections: [...] } so path semantics read naturally
    const wrapped = { sections: Array.isArray(variant.sections_json) ? variant.sections_json : [] }

    const oldValue    = getValueAtPath(wrapped as JsonValue, path)
    const patchResult = setValueAtPath(wrapped as JsonValue, path, newValue)

    if (!patchResult.ok) {
      return { success: false, error: patchResult.error }
    }

    const patchedWrapped = patchResult.result as { sections: JsonValue[] }
    const newSections    = patchedWrapped.sections
    const editType       = classifyEditType(path)
    const now            = new Date().toISOString()

    // Write patched sections back to variant
    const { error: updateErr } = await supabase
      .from('tenant_site_variants')
      .update({
        sections_json:         newSections,
        client_last_edited_at: now,
        client_edit_count:     (variant.client_edit_count ?? 0) + 1,
      })
      .eq('id', variant.id)

    if (updateErr) {
      return { success: false, error: `Failed to save edit: ${updateErr.message}` }
    }

    // Write audit event
    const { error: auditErr } = await supabase
      .from('client_variant_edit_events')
      .insert({
        tenant_id:         tenantId,
        variant_id:        variant.id,
        field_path:        path,
        old_value:         serializeForHistory(oldValue),
        new_value:         serializeForHistory(newValue),
        edit_type:         editType,
        source:            aiIntent ? 'ai_assisted' : 'client',
        review_token_hash: tokenHash,
        ai_intent:         aiIntent ?? null,
        created_at:        now,
      })

    if (auditErr) {
      // Non-fatal — the edit was saved; log but don't fail
      console.error('[client-edit] audit insert failed:', auditErr.message)
    }

    // Revalidate admin review path so changes are visible immediately
    revalidatePath(`/waas/clients/${tenantId}`)

    return { success: true, data: { sections: newSections } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error saving edit',
    }
  }
}

// =============================================================================
// 3. uploadClientAsset
//    Registers a client-uploaded asset (image/logo/etc.) after it has been
//    stored in Supabase Storage.  The caller is responsible for the actual
//    upload to the bucket; this action just records the metadata row.
// =============================================================================

export interface UploadAssetArgs {
  reviewToken:   string
  variantIndex:  number
  storagePath:   string   // path inside the Supabase Storage bucket
  cdnUrl:        string   // public CDN URL for the asset
  assetSlot:     string   // logical slot name, e.g. "hero_image" or "logo"
  mimeType?:     string
  fileSizeBytes?: number
}

export async function uploadClientAsset(
  args: UploadAssetArgs,
): Promise<ActionResult<{ assetId: string; cdnUrl: string }>> {
  const { reviewToken, variantIndex, storagePath, cdnUrl, assetSlot, mimeType, fileSizeBytes } = args

  const perm = await canClientEditVariant(reviewToken)
  if (!perm.allowed) {
    return { success: false, error: perm.reason }
  }

  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message }
  }
  const { tenantId } = sessionResult.session
  const tokenHash   = hashReviewToken(reviewToken)

  try {
    const supabase = getAdminClient()

    const { data: assetRow, error: insertErr } = await supabase
      .from('client_uploaded_assets')
      .insert({
        tenant_id:         tenantId,
        storage_path:      storagePath,
        cdn_url:           cdnUrl,
        variant_index:     variantIndex,
        asset_slot:        assetSlot,
        mime_type:         mimeType ?? null,
        file_size_bytes:   fileSizeBytes ?? null,
        review_token_hash: tokenHash,
        created_at:        new Date().toISOString(),
      })
      .select('id, cdn_url')
      .single()

    if (insertErr || !assetRow) {
      return { success: false, error: `Failed to register asset: ${insertErr?.message ?? 'unknown'}` }
    }

    const row = assetRow as { id: string; cdn_url: string }
    return { success: true, data: { assetId: row.id, cdnUrl: row.cdn_url } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error registering asset',
    }
  }
}

// =============================================================================
// 4. requestAiRewrite
//    Sends the current text + client intent to the AI rewrite service.
//    Returns the rewritten text.
//    Actual call to the AI API is kept in a separate service layer;
//    this action validates the token and calls it, returning the result.
// =============================================================================

export interface AiRewriteArgs {
  reviewToken:  string
  currentText:  string
  intent:       string   // e.g. "make it sound more professional"
  fieldContext: string   // e.g. "headline for services section"
  maxLength?:   number
}

export interface AiRewriteResult {
  rewrittenText: string
  tokensUsed?:   number
}

export async function requestAiRewrite(
  args: AiRewriteArgs,
): Promise<ActionResult<AiRewriteResult>> {
  const { reviewToken, currentText, intent, fieldContext, maxLength = 300 } = args

  // Gate on text edit permission specifically
  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message }
  }
  if (!sessionResult.session.permissions.canEditText) {
    return { success: false, error: 'Text editing is not available for this session.' }
  }

  // Sanitize inputs
  if (!currentText?.trim()) {
    return { success: false, error: 'currentText must not be empty' }
  }
  if (!intent?.trim()) {
    return { success: false, error: 'intent must not be empty' }
  }
  if (currentText.length > 5000) {
    return { success: false, error: 'currentText exceeds maximum length of 5000 characters' }
  }
  if (intent.length > 500) {
    return { success: false, error: 'intent exceeds maximum length of 500 characters' }
  }

  try {
    const openAiKey = process.env.OPENAI_API_KEY
    if (!openAiKey) {
      return { success: false, error: 'AI rewrite is not configured for this environment.' }
    }

    const systemPrompt = [
      'You are a professional copywriter helping a small business owner improve their website.',
      'Rewrite the given text according to the client\'s intent.',
      'Keep the tone consistent with a small local business.',
      `Maximum output length: ${maxLength} characters.`,
      'Return ONLY the rewritten text. No explanations, no quotes, no formatting.',
    ].join(' ')

    const userPrompt = [
      `Field: ${fieldContext}`,
      `Current text: "${currentText}"`,
      `Client intent: "${intent}"`,
    ].join('\n')

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        max_tokens:  Math.ceil(maxLength * 1.5),
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text()
      return { success: false, error: `AI service error: ${resp.status} ${errBody.slice(0, 200)}` }
    }

    const json = await resp.json() as {
      choices: Array<{ message: { content: string } }>
      usage:   { total_tokens: number }
    }

    const rewrittenText = json.choices?.[0]?.message?.content?.trim() ?? ''
    if (!rewrittenText) {
      return { success: false, error: 'AI returned an empty response' }
    }

    return {
      success: true,
      data: {
        rewrittenText,
        tokensUsed: json.usage?.total_tokens,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error calling AI rewrite',
    }
  }
}

// =============================================================================
// 5. submitClientApproval
//    Client clicks "Approve & Publish".
//    - Sets client_approval_at, client_approved_by_token_hash, client_approval_note
//    - Sets tenant status to 'pending_deploy' (enters admin deploy queue)
//    - Does NOT lock immediately — admin can lock from their dashboard
// =============================================================================

export interface ApprovalArgs {
  reviewToken:   string
  approvalNote?: string  // optional "anything else?" note from client
}

export interface ApprovalResult {
  approvedAt:  string
  tenantSlug:  string
}

export async function submitClientApproval(
  args: ApprovalArgs,
): Promise<ActionResult<ApprovalResult>> {
  const { reviewToken, approvalNote } = args

  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message }
  }

  const { session } = sessionResult

  if (!session.permissions.canApprove) {
    if (session.permissions.isLocked) {
      return { success: false, error: 'Your design is already approved and locked. Contact support to make changes.' }
    }
    if (session.approvalAt) {
      return { success: false, error: 'You have already approved your design.' }
    }
    return { success: false, error: 'Approval is not available at this time.' }
  }

  const tokenHash = hashReviewToken(reviewToken)
  const now       = new Date().toISOString()

  try {
    const supabase = getAdminClient()

    // Update tenant_site_config
    const { error: configErr } = await supabase
      .from('tenant_site_config')
      .update({
        client_approval_at:            now,
        client_approved_by_token_hash: tokenHash,
        client_approval_note:          approvalNote ?? null,
      })
      .eq('tenant_id', session.tenantId)

    if (configErr) {
      return { success: false, error: `Failed to record approval: ${configErr.message}` }
    }

    // Advance tenant status to pending_deploy
    const { error: tenantErr } = await supabase
      .from('tenants')
      .update({ status: 'pending_deploy' })
      .eq('id', session.tenantId)
      .eq('status', 'pending_review')  // Only advance if currently in review; avoid overwriting

    if (tenantErr) {
      // Non-fatal — status update is best-effort; approval is already recorded
      console.error('[client-edit] status update to pending_deploy failed:', tenantErr.message)
    }

    // Mark selected variant as approved
    if (session.selectedVariantIndex !== null) {
      await supabase
        .from('tenant_site_variants')
        .update({ status: 'selected' })
        .eq('tenant_id', session.tenantId)
        .eq('variant_index', session.selectedVariantIndex)
    }

    // Audit event
    await supabase
      .from('client_variant_edit_events')
      .insert({
        tenant_id:         session.tenantId,
        variant_id:        null,
        field_path:        '__approval__',
        old_value:         null,
        new_value:         approvalNote ? approvalNote.slice(0, 500) : 'approved',
        edit_type:         'text_edit',
        source:            'client_approval',
        review_token_hash: tokenHash,
        ai_intent:         null,
        created_at:        now,
      })

    revalidatePath(`/waas/clients/${session.tenantId}`)
    revalidatePath('/waas/deploy-queue')

    return {
      success: true,
      data: {
        approvedAt: now,
        tenantSlug: session.slug,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error submitting approval',
    }
  }
}

// =============================================================================
// 6. revokeClientApproval
//    Client un-approves within the 1-hour grace period.
//    Clears approval timestamps; puts tenant back to pending_review.
// =============================================================================

export async function revokeClientApproval(
  reviewToken: string,
): Promise<ActionResult<{ message: string }>> {
  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message }
  }

  const { session } = sessionResult

  if (!session.permissions.canUnaprove) {
    if (session.permissions.isLocked) {
      return { success: false, error: 'Your approval has been locked by the team. Contact support to request changes.' }
    }
    if (!session.approvalAt) {
      return { success: false, error: 'No active approval to revoke.' }
    }
    return { success: false, error: 'The grace period for revoking approval has passed. Please contact support.' }
  }

  const tokenHash = hashReviewToken(reviewToken)
  const now       = new Date().toISOString()

  try {
    const supabase = getAdminClient()

    // Clear approval fields
    const { error: configErr } = await supabase
      .from('tenant_site_config')
      .update({
        client_approval_at:            null,
        client_approved_by_token_hash: null,
        client_approval_note:          null,
      })
      .eq('tenant_id', session.tenantId)

    if (configErr) {
      return { success: false, error: `Failed to revoke approval: ${configErr.message}` }
    }

    // Roll tenant status back to pending_review
    await supabase
      .from('tenants')
      .update({ status: 'pending_review' })
      .eq('id', session.tenantId)
      .eq('status', 'pending_deploy')

    // Audit event
    await supabase
      .from('client_variant_edit_events')
      .insert({
        tenant_id:         session.tenantId,
        variant_id:        null,
        field_path:        '__approval_revoked__',
        old_value:         'approved',
        new_value:         'revoked',
        edit_type:         'text_edit',
        source:            'client_revoke',
        review_token_hash: tokenHash,
        ai_intent:         null,
        created_at:        now,
      })

    revalidatePath(`/waas/clients/${session.tenantId}`)

    return {
      success: true,
      data: { message: 'Approval revoked. You can continue editing your design.' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error revoking approval',
    }
  }
}

// =============================================================================
// 7. getClientEditHistory
//    Returns the audit trail of edits for a given variant (admin or self-view).
//    Token-scoped — only returns events for the given review token.
// =============================================================================

export interface EditHistoryEvent {
  id:          string
  fieldPath:   string
  oldValue:    string | null
  newValue:    string | null
  editType:    EditType
  source:      string
  aiIntent:    string | null
  createdAt:   string
}

export async function getClientEditHistory(
  reviewToken: string,
  variantIndex?: number,
  limit = 50,
): Promise<ActionResult<EditHistoryEvent[]>> {
  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message }
  }

  const { tenantId } = sessionResult.session
  const tokenHash   = hashReviewToken(reviewToken)

  try {
    const supabase = getAdminClient()

    const query = supabase
      .from('client_variant_edit_events')
      .select('id, field_path, old_value, new_value, edit_type, source, ai_intent, created_at, variant_id')
      .eq('tenant_id', tenantId)
      .eq('review_token_hash', tokenHash)
      .order('created_at', { ascending: false })
      .limit(limit)

    // NOTE: variantIndex filtering deferred to a future migration that denormalises
    // variant_index onto the events table. For now all events for the token are returned.
    void variantIndex

    const { data: rows, error: fetchErr } = await query

    if (fetchErr) {
      return { success: false, error: `Failed to load history: ${fetchErr.message}` }
    }

    const events: EditHistoryEvent[] = (rows ?? []).map((row) => {
      const r = row as {
        id:         string
        field_path: string
        old_value:  string | null
        new_value:  string | null
        edit_type:  EditType
        source:     string
        ai_intent:  string | null
        created_at: string
      }
      return {
        id:        r.id,
        fieldPath: r.field_path,
        oldValue:  r.old_value,
        newValue:  r.new_value,
        editType:  r.edit_type,
        source:    r.source,
        aiIntent:  r.ai_intent,
        createdAt: r.created_at,
      }
    })

    return { success: true, data: events }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error loading edit history',
    }
  }
}

// =============================================================================
// 8. updateClientBrandConfig
//    Convenience wrapper that patches brand_config fields on the tenant row.
//    Validates path against the brand_config allowlist before writing.
// =============================================================================

export interface UpdateBrandConfigArgs {
  reviewToken: string
  field:       string   // e.g. "business_name", "tagline", "colors.primary"
  newValue:    string
}

export async function updateClientBrandConfig(
  args: UpdateBrandConfigArgs,
): Promise<ActionResult<{ brandConfig: Record<string, unknown> }>> {
  const { reviewToken, field, newValue } = args

  const perm = await canClientEditVariant(reviewToken)
  if (!perm.allowed) {
    return { success: false, error: perm.reason }
  }

  const fullPath = `brand_config.${field}`
  const pathCheck = validateEditPath(fullPath)
  if (!pathCheck.valid) {
    return { success: false, error: pathCheck.reason }
  }

  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message }
  }

  const { tenantId, brandConfig } = sessionResult.session
  const tokenHash = hashReviewToken(reviewToken)

  try {
    const supabase = getAdminClient()

    // Use the JSONPath patcher to support nested fields like "colors.primary"
    // Wrap brandConfig under a synthetic root so paths read "brand_config.*"
    const wrapped = { brand_config: brandConfig }
    const oldValue = getValueAtPath(wrapped as JsonValue, fullPath)
    const patchResult = setValueAtPath(wrapped as JsonValue, fullPath, newValue)

    if (!patchResult.ok) {
      return { success: false, error: patchResult.error }
    }

    const patchedWrapped = patchResult.result as { brand_config: Record<string, unknown> }
    const updatedConfig  = patchedWrapped.brand_config

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ brand_config: updatedConfig })
      .eq('id', tenantId)

    if (updateErr) {
      return { success: false, error: `Failed to update brand config: ${updateErr.message}` }
    }

    // Audit
    const now = new Date().toISOString()
    await supabase
      .from('client_variant_edit_events')
      .insert({
        tenant_id:         tenantId,
        variant_id:        null,
        field_path:        fullPath,
        old_value:         serializeForHistory(oldValue as JsonValue),
        new_value:         serializeForHistory(newValue as JsonValue),
        edit_type:         fullPath.includes('color') ? 'color_change' : 'text_edit',
        source:            'client',
        review_token_hash: tokenHash,
        ai_intent:         null,
        created_at:        now,
      })

    revalidatePath(`/waas/clients/${tenantId}`)

    return { success: true, data: { brandConfig: updatedConfig } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error updating brand config',
    }
  }
}

// =============================================================================
// 9. requestAiRewriteVariants
//    Returns 3 tone-labelled rewrites in a single OpenAI call so the client
//    can pick the best fit without multiple round trips.
//    Uses response_format: { type: 'json_object' } to enforce structured output.
//    Falls back to 3× sequential single-shot calls if the model returns
//    invalid JSON or the wrong shape.
// =============================================================================

export interface AiRewriteVariantsArgs {
  reviewToken:  string
  currentText:  string
  intent:       string       // e.g. "make it sound more professional"
  fieldContext: string       // e.g. "headline for Services section, HVAC business"
  maxLength?:   number       // default 300
  toneHints?:   string[]     // optional tone presets, e.g. ['Professional','Bold','Friendly']
}

export interface AiRewriteVariant {
  tone: string   // label shown in the UI card, e.g. "Professional"
  text: string   // the rewritten content
}

export interface AiRewriteVariantsResult {
  variants:   AiRewriteVariant[]  // always 3
  tokensUsed: number
}

const DEFAULT_TONES = ['Professional', 'Friendly', 'Bold & concise']

export async function requestAiRewriteVariants(
  args: AiRewriteVariantsArgs,
): Promise<ActionResult<AiRewriteVariantsResult>> {
  const {
    reviewToken, currentText, intent, fieldContext,
    maxLength = 300,
    toneHints = DEFAULT_TONES,
  } = args

  // --- Permission gate ---
  const sessionResult = await resolveClientEditSession(reviewToken)
  if (!sessionResult.ok) return { success: false, error: sessionResult.message }
  if (!sessionResult.session.permissions.canEditText) {
    return { success: false, error: 'Text editing is not available for this session.' }
  }

  // --- Input validation ---
  if (!currentText?.trim()) return { success: false, error: 'currentText must not be empty' }
  if (!intent?.trim())       return { success: false, error: 'intent must not be empty' }
  if (currentText.length > 5000) return { success: false, error: 'currentText exceeds 5000 characters' }
  if (intent.length > 500)       return { success: false, error: 'intent exceeds 500 characters' }

  const openAiKey = process.env.OPENAI_API_KEY
  if (!openAiKey) return { success: false, error: 'AI rewrite is not configured.' }

  const tones = toneHints.length >= 3 ? toneHints.slice(0, 3) : DEFAULT_TONES

  const systemPrompt = [
    'You are a professional copywriter helping a small local business improve their website.',
    'Return ONLY valid JSON matching this exact schema:',
    '{ "variants": [ { "tone": "<label>", "text": "<rewritten>" }, ... ] }',
    'Provide exactly 3 variants with the tone labels requested.',
    `Maximum text length per variant: ${maxLength} characters.`,
    'No explanations, no markdown, no extra keys.',
  ].join(' ')

  const userPrompt = [
    `Field: ${fieldContext}`,
    `Current text: "${currentText}"`,
    `Client intent: "${intent}"`,
    `Write one variant each with these tones: ${tones.join(', ')}.`,
  ].join('\n')

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        max_tokens:      Math.ceil(maxLength * 1.5 * 3 + 200),
        temperature:     0.75,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text()
      return { success: false, error: `AI service error: ${resp.status} — ${errBody.slice(0, 200)}` }
    }

    const json = await resp.json() as {
      choices: Array<{ message: { content: string } }>
      usage:   { total_tokens: number }
    }

    const raw = json.choices?.[0]?.message?.content ?? ''
    const tokensUsed = json.usage?.total_tokens ?? 0

    // Parse + validate schema
    const parsed = tryParseVariants(raw, tones)
    if (parsed) {
      return { success: true, data: { variants: parsed, tokensUsed } }
    }

    // Fallback: 3× single-shot calls with explicit tones
    const fallbackVariants = await fallbackThreeCalls(
      openAiKey, currentText, intent, fieldContext, maxLength, tones,
    )
    if (!fallbackVariants) {
      return { success: false, error: 'AI returned an unexpected response. Please try again.' }
    }
    return { success: true, data: { variants: fallbackVariants, tokensUsed } }

  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error calling AI rewrite',
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseVariants(raw: string, tones: string[]): AiRewriteVariant[] | null {
  try {
    const obj = JSON.parse(raw) as { variants?: unknown }
    if (!Array.isArray(obj.variants)) return null
    const items = obj.variants as Array<{ tone?: unknown; text?: unknown }>
    if (items.length < 3) return null
    const result: AiRewriteVariant[] = items.slice(0, 3).map((item, i) => ({
      tone: typeof item.tone === 'string' && item.tone.trim() ? item.tone.trim() : tones[i] ?? `Option ${i + 1}`,
      text: typeof item.text === 'string' ? item.text.trim() : '',
    }))
    if (result.some((v) => !v.text)) return null
    return result
  } catch {
    return null
  }
}

async function fallbackThreeCalls(
  apiKey:       string,
  currentText:  string,
  intent:       string,
  fieldContext: string,
  maxLength:    number,
  tones:        string[],
): Promise<AiRewriteVariant[] | null> {
  const results: AiRewriteVariant[] = []

  for (const tone of tones.slice(0, 3)) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model:       'gpt-4o-mini',
          max_tokens:  Math.ceil(maxLength * 1.5),
          temperature: 0.75,
          messages: [
            {
              role: 'system',
              content: `You are a professional copywriter for small local businesses. Rewrite text in a ${tone} tone. Return ONLY the rewritten text, no quotes, no explanation.`,
            },
            {
              role: 'user',
              content: `Field: ${fieldContext}\nCurrent: "${currentText}"\nIntent: "${intent}"\nMax ${maxLength} characters.`,
            },
          ],
        }),
      })
      if (!resp.ok) continue
      const j = await resp.json() as { choices: Array<{ message: { content: string } }> }
      const text = j.choices?.[0]?.message?.content?.trim() ?? ''
      if (text) results.push({ tone, text })
    } catch {
      // Skip failed tone
    }
  }

  return results.length === 3 ? results : null
}
