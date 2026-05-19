'use server'
import { revalidatePath } from 'next/cache'
import type { SiteVariantRecord } from '@/lib/waas/types'
import type { SectionConfig, SectionId } from '@/lib/waas/templates/types'
import { getTemplate } from '@/lib/waas/templates/registry'
import { getAdminClient, isMissingSchemaTable } from './_shared'
import type { ActionResult } from './_shared'
import { saveTenantSiteVersion, generateReviewToken, normalizeLifecycleReason } from './_versioning'
import type { VariantLifecycleReasonCategory } from './_versioning'
import { applyTemplate } from './site-settings'

export async function ensureClientReviewToken(tenantId: string): Promise<ActionResult<string>> {
  try {
    const supabase = getAdminClient()
    const { data: existing } = await supabase
      .from('tenant_site_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    const existingToken = (existing as { client_review_token?: string | null } | null)?.client_review_token
    if (existingToken && typeof existingToken === 'string') {
      return { success: true, data: existingToken }
    }

    const newToken = generateReviewToken()

    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      active_sections_json: (existing as { active_sections_json?: unknown } | null)?.active_sections_json ?? [],
      updated_at: new Date().toISOString(),
      client_review_token: newToken,
    }

    const { error } = await supabase
      .from('tenant_site_config')
      .upsert(payload, { onConflict: 'tenant_id' })

    if (error) {
      // Backward-safe fallback until migration 010 is applied.
      return { success: true, data: tenantId }
    }

    return { success: true, data: newToken }
  } catch {
    return { success: true, data: tenantId }
  }
}

export interface ClientReviewSession {
  tenantId: string
  slug: string
  businessName: string
  selectedTemplateSlug: string | null
  reviewToken: string
  feedback: ClientVariantFeedback
  mix: ClientVariantMix
  versions: ClientReviewVersion[]
  variants: ClientReviewVariant[]
}

export interface ClientReviewVariant {
  variantIndex: number
  label: string
  rationale: string | null
  templateSlug: string
  status: SiteVariantRecord['status']
}

export interface ClientVariantFeedback {
  tone: string | null
  ctaIntensity: string | null
  layoutPreference: string | null
  notes: string | null
  submittedAt: string | null
}

export interface ClientVariantMix {
  sourceTemplates: string[]
  submittedAt: string | null
}

export interface ClientReviewVersion {
  id: string
  changeSource: string
  summary: string | null
  templateSlug: string | null
  createdAt: string
}

export async function getClientReviewSession(reviewKey: string): Promise<ActionResult<ClientReviewSession>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id, client_selected_template_slug, client_review_token')
      .eq('client_review_token', reviewKey)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      // Legacy fallback: allow direct tenant ID URLs.
      const { data: byTenantId } = await supabase
        .from('tenant_site_config')
        .select('tenant_id, client_selected_template_slug, client_review_token')
        .eq('tenant_id', reviewKey)
        .single()
      if (byTenantId) {
        tenantId = (byTenantId as { tenant_id: string }).tenant_id
      }
    }

    if (!tenantId) {
      // Last-resort fallback: treat review key as tenant ID and proceed.
      tenantId = reviewKey
    }

    const tokenResult = await ensureClientReviewToken(tenantId)
    const safeToken = tokenResult.data ?? reviewKey

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, brand_config')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return { success: false, error: tenantError?.message ?? 'Tenant not found' }
    }

    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('client_selected_template_slug, client_feedback_tone, client_feedback_cta_intensity, client_feedback_layout_preference, client_feedback_notes, client_feedback_submitted_at, client_mix_source_templates, client_mix_submitted_at')
      .eq('tenant_id', tenantId)
      .single()

    const { data: versionsRows } = await supabase
      .from('tenant_site_versions')
      .select('id, change_source, summary, template_slug, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(12)

    let variants: ClientReviewVariant[] = []
    const { data: variantRows, error: variantError } = await supabase
      .from('tenant_site_variants')
      .select('variant_index, variant_label, variant_rationale, template_slug, status')
      .eq('tenant_id', tenantId)
      .order('variant_index', { ascending: true })

    if (!variantError) {
      variants = ((variantRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
        variantIndex: typeof row.variant_index === 'number' ? row.variant_index : 0,
        label: typeof row.variant_label === 'string' ? row.variant_label : 'Variant',
        rationale: typeof row.variant_rationale === 'string' ? row.variant_rationale : null,
        templateSlug: typeof row.template_slug === 'string' ? row.template_slug : 'modern',
        status: (typeof row.status === 'string' ? row.status : 'generated') as SiteVariantRecord['status'],
      }))
    }

    const brandConfig = (tenant as { brand_config?: Record<string, unknown> }).brand_config ?? {}
    const businessName = typeof brandConfig.business_name === 'string'
      ? brandConfig.business_name
      : 'Your Business'

    return {
      success: true,
      data: {
        tenantId,
        slug: (tenant as { slug: string }).slug,
        businessName,
        selectedTemplateSlug: (siteConfig as { client_selected_template_slug?: string | null } | null)?.client_selected_template_slug ?? null,
        reviewToken: safeToken,
        feedback: {
          tone: (siteConfig as { client_feedback_tone?: string | null } | null)?.client_feedback_tone ?? null,
          ctaIntensity: (siteConfig as { client_feedback_cta_intensity?: string | null } | null)?.client_feedback_cta_intensity ?? null,
          layoutPreference: (siteConfig as { client_feedback_layout_preference?: string | null } | null)?.client_feedback_layout_preference ?? null,
          notes: (siteConfig as { client_feedback_notes?: string | null } | null)?.client_feedback_notes ?? null,
          submittedAt: (siteConfig as { client_feedback_submitted_at?: string | null } | null)?.client_feedback_submitted_at ?? null,
        },
        mix: {
          sourceTemplates: (siteConfig as { client_mix_source_templates?: string[] | null } | null)?.client_mix_source_templates ?? [],
          submittedAt: (siteConfig as { client_mix_submitted_at?: string | null } | null)?.client_mix_submitted_at ?? null,
        },
        versions: ((versionsRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id ?? ''),
          changeSource: String(row.change_source ?? 'unknown_change'),
          summary: (row.summary as string | null | undefined) ?? null,
          templateSlug: (row.template_slug as string | null | undefined) ?? null,
          createdAt: String(row.created_at ?? new Date().toISOString()),
        })),
        variants,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export async function selectClientVariantByReviewToken(
  reviewToken: string,
  templateSlug: string,
  feedback?: {
    tone?: string | null
    ctaIntensity?: string | null
    layoutPreference?: string | null
    notes?: string | null
  }
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id')
      .eq('client_review_token', reviewToken)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      // Legacy fallback for pre-token links.
      tenantId = reviewToken
    }

    const apply = await applyTemplate(tenantId, templateSlug)
    if (!apply.success) {
      return { success: false, error: apply.error ?? 'Failed to apply template' }
    }

    const metadataUpdate: Record<string, unknown> = {
      client_selected_template_slug: templateSlug,
      client_selected_at: new Date().toISOString(),
      client_feedback_tone: feedback?.tone ?? null,
      client_feedback_cta_intensity: feedback?.ctaIntensity ?? null,
      client_feedback_layout_preference: feedback?.layoutPreference ?? null,
      client_feedback_notes: feedback?.notes?.trim() ? feedback.notes.trim().slice(0, 3000) : null,
      client_feedback_submitted_at: new Date().toISOString(),
      client_mix_source_templates: null,
      client_mix_submitted_at: null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('tenant_site_config')
      .update(metadataUpdate)
      .eq('tenant_id', tenantId)

    if (error) {
      // Keep backward compatibility if migration 010 has not yet been applied.
      revalidatePath(`/admin/dashboard/${tenantId}`)
      revalidatePath(`/review/${reviewToken}`)
      return { success: true }
    }

    await saveTenantSiteVersion(
      tenantId,
      'client_selected_variant',
      `Client selected ${templateSlug} with feedback preferences`,
      {
        lifecycleMeta: {
          reasonCategory: 'client_request',
          reasonText: normalizeLifecycleReason(feedback?.notes ?? null),
        },
      },
    )

    const { error: clearStatusError } = await supabase
      .from('tenant_site_variants')
      .update({ status: 'sent_to_review', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    if (!clearStatusError) {
      const { error: markSelectedError } = await supabase
        .from('tenant_site_variants')
        .update({ status: 'selected', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('template_slug', templateSlug)

      if (markSelectedError && !isMissingSchemaTable(markSelectedError.message, 'tenant_site_variants')) {
        return { success: false, error: markSelectedError.message }
      }
    }

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function mixClientVariantsByReviewToken(
  reviewToken: string,
  primaryTemplateSlug: string,
  mixSourceTemplates: string[],
  feedback?: {
    tone?: string | null
    ctaIntensity?: string | null
    layoutPreference?: string | null
    notes?: string | null
  }
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id')
      .eq('client_review_token', reviewToken)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      tenantId = reviewToken
    }

    const apply = await applyTemplate(tenantId, primaryTemplateSlug)
    if (!apply.success) {
      return { success: false, error: apply.error ?? 'Failed to apply mixed template direction' }
    }

    const normalizedMix = Array.from(new Set(mixSourceTemplates.filter(Boolean))).slice(0, 3)

    const metadataUpdate: Record<string, unknown> = {
      client_selected_template_slug: primaryTemplateSlug,
      client_selected_at: new Date().toISOString(),
      client_feedback_tone: feedback?.tone ?? null,
      client_feedback_cta_intensity: feedback?.ctaIntensity ?? null,
      client_feedback_layout_preference: feedback?.layoutPreference ?? null,
      client_feedback_notes: feedback?.notes?.trim() ? feedback.notes.trim().slice(0, 3000) : null,
      client_feedback_submitted_at: new Date().toISOString(),
      client_mix_source_templates: normalizedMix,
      client_mix_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('tenant_site_config')
      .update(metadataUpdate)
      .eq('tenant_id', tenantId)

    if (error) {
      revalidatePath(`/admin/dashboard/${tenantId}`)
      revalidatePath(`/review/${reviewToken}`)
      return { success: true }
    }

    const mixSummary = normalizedMix.length
      ? `Client selected ${primaryTemplateSlug} mixed with ${normalizedMix.join(', ')}`
      : `Client selected ${primaryTemplateSlug} as mixed direction`

    await saveTenantSiteVersion(
      tenantId,
      'client_mixed_variant',
      mixSummary,
      {
        lifecycleMeta: {
          reasonCategory: 'client_request',
          reasonText: normalizeLifecycleReason(feedback?.notes ?? null) ?? (normalizedMix.length > 0
            ? `Mixed with ${normalizedMix.join(', ')}`
            : null),
        },
      },
    )

    const { error: clearStatusError } = await supabase
      .from('tenant_site_variants')
      .update({ status: 'sent_to_review', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    if (!clearStatusError) {
      const { error: markSelectedError } = await supabase
        .from('tenant_site_variants')
        .update({ status: 'selected', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('template_slug', primaryTemplateSlug)

      if (markSelectedError && !isMissingSchemaTable(markSelectedError.message, 'tenant_site_variants')) {
        return { success: false, error: markSelectedError.message }
      }
    }

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

function setSectionConfig(
  sections: SectionConfig[],
  sectionId: SectionId,
  changes: Partial<SectionConfig>,
): SectionConfig[] {
  return sections.map((section) => {
    if (section.section !== sectionId) return section
    return {
      ...section,
      ...changes,
      config: {
        ...section.config,
        ...(changes.config ?? {}),
      },
    }
  })
}

function normalizeSectionOrder(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index + 1 }))
}

export async function regenerateSelectedVariantByReviewToken(
  reviewToken: string,
  preferredTemplateSlug?: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id')
      .eq('client_review_token', reviewToken)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      tenantId = reviewToken
    }

    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('template_id, client_selected_template_slug, client_feedback_tone, client_feedback_cta_intensity, client_feedback_layout_preference, client_mix_source_templates, site_templates(slug)')
      .eq('tenant_id', tenantId)
      .single()

    const row = (siteConfig ?? {}) as Record<string, unknown>
    const linkedTemplateSlug = (row.site_templates as { slug?: string } | null | undefined)?.slug ?? null
    const selectedTemplateSlug = (row.client_selected_template_slug as string | null | undefined) ?? null
    const baseTemplateSlug = preferredTemplateSlug?.trim() || selectedTemplateSlug || linkedTemplateSlug || 'modern'

    const tone = (row.client_feedback_tone as string | null | undefined) ?? null
    const ctaIntensity = (row.client_feedback_cta_intensity as string | null | undefined) ?? null
    const layoutPreference = (row.client_feedback_layout_preference as string | null | undefined) ?? null
    const mixSourceTemplates = (row.client_mix_source_templates as string[] | null | undefined) ?? []

    let regeneratedSections = getTemplate(baseTemplateSlug).default_layout_json.map((section) => ({
      ...section,
      config: { ...section.config },
    }))

    // Tone adjustments
    if (tone === 'professional' || tone === 'premium') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'trust', {
        enabled: true,
        config: { variant: 'full-width' },
      })
    }
    if (tone === 'friendly') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'centered' },
      })
    }
    if (tone === 'direct') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'split' },
      })
    }

    // CTA intensity adjustments
    if (ctaIntensity === 'soft') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'booking', {
        config: { variant: 'inline' },
      })
      regeneratedSections = setSectionConfig(regeneratedSections, 'financing', {
        enabled: false,
      })
    }
    if (ctaIntensity === 'strong') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'booking', {
        config: { variant: 'modal-trigger' },
      })
      regeneratedSections = setSectionConfig(regeneratedSections, 'financing', {
        enabled: true,
      })
    }

    // Layout preference adjustments
    if (layoutPreference === 'compact') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'services', {
        config: { columns: 2 },
      })
    }
    if (layoutPreference === 'spacious') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'services', {
        config: { columns: 3 },
      })
    }

    // Mix influence adjustments
    if (mixSourceTemplates.includes('bold')) {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'split' },
      })
      regeneratedSections = setSectionConfig(regeneratedSections, 'financing', {
        enabled: true,
      })
    }
    if (mixSourceTemplates.includes('trust-first')) {
      regeneratedSections = setSectionConfig(regeneratedSections, 'reviews', {
        enabled: true,
        order: 2,
      })
    }
    if (mixSourceTemplates.includes('modern')) {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'centered' },
      })
    }

    regeneratedSections = normalizeSectionOrder(regeneratedSections)

    const { error: updateError } = await supabase
      .from('tenant_site_config')
      .update({
        active_sections_json: regeneratedSections,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await saveTenantSiteVersion(
      tenantId,
      'client_regenerated_variant',
      `Regenerated ${baseTemplateSlug} using saved feedback${mixSourceTemplates.length ? ` and mix (${mixSourceTemplates.join(', ')})` : ''}`,
      {
        lifecycleMeta: {
          reasonCategory: 'client_request',
          reasonText: mixSourceTemplates.length > 0 ? `Regeneration with mix: ${mixSourceTemplates.join(', ')}` : null,
        },
      },
    )

    revalidatePath('/admin/dashboard')
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    revalidatePath('/_sites', 'layout')
    revalidatePath(`/_preview/${tenantId}`)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}
