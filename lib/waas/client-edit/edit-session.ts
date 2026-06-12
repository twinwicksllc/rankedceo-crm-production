// =============================================================================
// lib/waas/client-edit/edit-session.ts
// Token validation, permission checks and session state helpers for the
// client self-service editor.
//
// All functions run server-side (no 'use client').
// Uses the WaaS admin client (service-role) since client edits are
// authenticated via review token, not a Supabase auth session.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { createHash }   from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientEditPermissions {
  canEditText:    boolean
  canSwapImages:  boolean
  canChangeColors: boolean
  canApprove:     boolean
  canUnaprove:    boolean   // within grace period
  isLocked:       boolean   // approval locked by admin or past grace window
}

export interface ClientEditSession {
  tenantId:         string
  slug:             string
  businessName:     string
  reviewToken:      string
  selectedVariantIndex: number | null
  selectedTemplateSlug: string | null
  brandConfig:      Record<string, unknown>
  permissions:      ClientEditPermissions
  editSessionStartedAt: string | null
  approvalAt:       string | null
  approvalLocked:   boolean
}

export type EditSessionResult =
  | { ok: true;  session: ClientEditSession }
  | { ok: false; reason: 'not_found' | 'locked' | 'invalid_token' | 'error'; message: string }

// ---------------------------------------------------------------------------
// Approval grace period (ms) — client can un-approve within this window
// ---------------------------------------------------------------------------

export const APPROVAL_GRACE_PERIOD_MS = 60 * 60 * 1000 // 1 hour

// ---------------------------------------------------------------------------
// Hash a review token for storage (SHA-256, hex-encoded)
// Never store raw tokens in audit logs
// ---------------------------------------------------------------------------

export function hashReviewToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ---------------------------------------------------------------------------
// Get admin Supabase client (same pattern as admin.ts)
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
// resolveClientEditSession
// Primary entry point — given a raw reviewToken, return a full edit session
// including all permissions the client currently has.
// ---------------------------------------------------------------------------

export async function resolveClientEditSession(
  reviewToken: string,
): Promise<EditSessionResult> {
  if (!reviewToken || typeof reviewToken !== 'string' || reviewToken.length < 8) {
    return { ok: false, reason: 'invalid_token', message: 'Invalid review token.' }
  }

  try {
    const supabase = getAdminClient()

    // 1. Resolve tenant from review token
    const { data: configRow, error: configErr } = await supabase
      .from('tenant_site_config')
      .select(`
        tenant_id,
        client_review_token,
        client_selected_template_slug,
        client_edit_session_started_at,
        client_approval_at,
        client_approval_locked
      `)
      .eq('client_review_token', reviewToken)
      .single()

    if (configErr || !configRow) {
      // Legacy fallback: if `ensureClientReviewToken` failed its upsert it returns the
      // tenantId as the token. Try resolving by tenant_id directly.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewToken)
      if (isUuid) {
        const { data: fallbackRow, error: fallbackErr } = await supabase
          .from('tenant_site_config')
          .select(`
            tenant_id,
            client_review_token,
            client_selected_template_slug,
            client_edit_session_started_at,
            client_approval_at,
            client_approval_locked
          `)
          .eq('tenant_id', reviewToken)
          .single()

        if (!fallbackErr && fallbackRow) {
          // Found by tenant_id — patch the row with a proper token so future visits work
          const newToken = (fallbackRow as any).client_review_token
          if (!newToken) {
            console.warn('[resolveClientEditSession] tenant_id fallback succeeded but no token stored; row needs ensureClientReviewToken re-run')
          }
          // Reassign configRow to the fallback
          Object.assign(fallbackRow as any, {
            // Ensure the session uses the stored token (or the tenantId if still null)
            client_review_token: (fallbackRow as any).client_review_token ?? reviewToken,
          })
          ;(configRow as any) // TypeScript: reassign via cast below
          const patchedConfig = fallbackRow as typeof configRow
          // Re-run rest of resolution with patchedConfig
          const { data: tenantRowFallback, error: tenantErrFallback } = await supabase
            .from('tenants')
            .select('id, slug, brand_config, status')
            .eq('id', (patchedConfig as any).tenant_id)
            .single()

          if (tenantErrFallback || !tenantRowFallback) {
            return { ok: false, reason: 'not_found', message: 'Tenant not found.' }
          }

          const tenantFb = tenantRowFallback as { id: string; slug: string; brand_config: Record<string, unknown>; status: string }
          const brandConfigFb = tenantFb.brand_config ?? {}
          const businessNameFb = typeof brandConfigFb.business_name === 'string' ? brandConfigFb.business_name : 'Your Business'
          const configFb = patchedConfig as any

          const approvalAtFb = configFb.client_approval_at
          const isApprovalLockedFb = configFb.client_approval_locked === true
          const withinGraceFb = approvalAtFb ? Date.now() - new Date(approvalAtFb).getTime() < APPROVAL_GRACE_PERIOD_MS : false
          const canEditFb = !isApprovalLockedFb

          return {
            ok: true,
            session: {
              tenantId:              tenantFb.id,
              slug:                  tenantFb.slug,
              businessName:          businessNameFb,
              reviewToken:           configFb.client_review_token ?? reviewToken,
              selectedVariantIndex:  null,
              selectedTemplateSlug:  configFb.client_selected_template_slug ?? null,
              brandConfig:           brandConfigFb,
              permissions: {
                canEditText:     canEditFb,
                canSwapImages:   canEditFb,
                canChangeColors: canEditFb,
                canApprove:      !approvalAtFb && !isApprovalLockedFb,
                canUnaprove:     !!approvalAtFb && withinGraceFb && !isApprovalLockedFb,
                isLocked:        isApprovalLockedFb,
              },
              editSessionStartedAt:  configFb.client_edit_session_started_at ?? null,
              approvalAt:            approvalAtFb ?? null,
              approvalLocked:        isApprovalLockedFb,
            },
          }
        }
      }

      console.error('[resolveClientEditSession] tenant_site_config query failed:', {
        hasError: !!configErr,
        errorCode: configErr?.code,
        errorMessage: configErr?.message,
        errorHint: configErr?.hint,
        rowExists: !!configRow,
        token: reviewToken?.slice(0, 8),
      })
      return { ok: false, reason: 'not_found', message: 'Review session not found.' }
    }

    const config = configRow as {
      tenant_id:                      string
      client_review_token:            string
      client_selected_template_slug:  string | null
      client_edit_session_started_at: string | null
      client_approval_at:             string | null
      client_approval_locked:         boolean
    }

    // 2. Load tenant
    const { data: tenantRow, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, slug, brand_config, status')
      .eq('id', config.tenant_id)
      .single()

    if (tenantErr || !tenantRow) {
      return { ok: false, reason: 'not_found', message: 'Tenant not found.' }
    }

    const tenant = tenantRow as {
      id:           string
      slug:         string
      brand_config: Record<string, unknown>
      status:       string
    }

    // 3. Find selected variant index
    let selectedVariantIndex: number | null = null
    if (config.client_selected_template_slug) {
      const { data: variantRow } = await supabase
        .from('tenant_site_variants')
        .select('variant_index')
        .eq('tenant_id', tenant.id)
        .eq('template_slug', config.client_selected_template_slug)
        .in('status', ['selected', 'sent_to_review', 'generated'])
        .order('variant_index', { ascending: true })
        .limit(1)
        .single()

      if (variantRow) {
        selectedVariantIndex = (variantRow as { variant_index: number }).variant_index
      }
    }

    // 4. Compute permissions
    const isApprovalLocked   = config.client_approval_locked === true
    const approvalAt         = config.client_approval_at
    const withinGracePeriod  = approvalAt
      ? Date.now() - new Date(approvalAt).getTime() < APPROVAL_GRACE_PERIOD_MS
      : false

    const canEdit = !isApprovalLocked

    const permissions: ClientEditPermissions = {
      canEditText:    canEdit,
      canSwapImages:  canEdit,
      canChangeColors: canEdit,
      canApprove:     !approvalAt && !isApprovalLocked,
      canUnaprove:    !!approvalAt && withinGracePeriod && !isApprovalLocked,
      isLocked:       isApprovalLocked,
    }

    // 5. Mark edit session as started if first visit
    if (!config.client_edit_session_started_at) {
      await supabase
        .from('tenant_site_config')
        .update({ client_edit_session_started_at: new Date().toISOString() })
        .eq('tenant_id', tenant.id)
        .is('client_edit_session_started_at', null)
    }

    const brandConfig = tenant.brand_config ?? {}
    const businessName =
      typeof brandConfig.business_name === 'string'
        ? brandConfig.business_name
        : 'Your Business'

    return {
      ok: true,
      session: {
        tenantId:              tenant.id,
        slug:                  tenant.slug,
        businessName,
        reviewToken:           config.client_review_token,
        selectedVariantIndex,
        selectedTemplateSlug:  config.client_selected_template_slug,
        brandConfig,
        permissions,
        editSessionStartedAt:  config.client_edit_session_started_at,
        approvalAt,
        approvalLocked:        isApprovalLocked,
      },
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'Unexpected error',
    }
  }
}

// ---------------------------------------------------------------------------
// canClientEditVariant
// Quick permission check used inside server actions before mutating data.
// Returns { allowed: true } or { allowed: false, reason }
// ---------------------------------------------------------------------------

export async function canClientEditVariant(
  reviewToken: string,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const result = await resolveClientEditSession(reviewToken)
  if (!result.ok) return { allowed: false, reason: result.message }

  const { permissions } = result.session
  if (permissions.isLocked) {
    return { allowed: false, reason: 'Your design has been approved and is locked for deployment. Contact support to request changes.' }
  }
  if (!permissions.canEditText) {
    return { allowed: false, reason: 'Editing is not available at this time.' }
  }
  return { allowed: true }
}
