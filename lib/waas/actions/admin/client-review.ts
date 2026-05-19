'use server'
import { revalidatePath } from 'next/cache'
import type { SiteVariantRecord } from '@/lib/waas/types'
import type { SectionConfig } from '@/lib/waas/templates/types'
import { getTemplate } from '@/lib/waas/templates/registry'
import { getAdminClient, isMissingSchemaTable } from './_shared'
import type { ActionResult } from './_shared'
import { saveTenantSiteVersion, generateReviewToken, normalizeLifecycleReason } from './_versioning'
import type { VariantLifecycleReasonCategory } from './_versioning'
import { applyTemplate } from './site-settings'

export interface ClientReviewSession {
  tenantId: string
  reviewToken: string
  businessName: string
  templateSlug: string | null
  sectionsJson: SectionConfig[]
  status: string
}


export interface ClientReviewVariant {
  id: string
  variantIndex: number
  variantLabel: string
  variantRationale: string | null
  templateSlug: string
  sectionsJson: SectionConfig[]
  status: string
}


export interface ClientVariantFeedback {
  tone?: string | null
  ctaIntensity?: string | null
  layoutPreference?: string | null
  notes?: string | null
}


export interface ClientVariantMix {
  sourceTemplates: string[]
  customSections?: SectionConfig[]
}


export interface ClientReviewVersion {
  id: string
  changeSource: string
  summary: string | null
  createdAt: string
}


export async function ensureClientReviewToken(
  tenantId: string,
): Promise<ActionResult<string>> {
  try {
    const supabase = getAdminClient()

    const { data: existing } = await supabase
      .from('tenant_site_config')
      .select('review_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const existingToken = (existing as { review_token?: string | null } | null)?.review_token
    if (typeof existingToken === 'string' && existingToken.length > 0) {
      return { success: true, data: existingToken }
    }

    const newToken = generateReviewToken()
    const { error } = await supabase
      .from('tenant_site_config')
      .upsert(
        {
          tenant_id: tenantId,
          review_token: newToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      )

    if (error) return { success: false, error: error.message }
    return { success: true, data: newToken }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function getClientReviewSession(
  reviewToken: string,
): Promise<ActionResult<ClientReviewSession & { variants: ClientReviewVariant[] }>> {
  try {
    const supabase = getAdminClient()

    const { data: configRow, error: configError } = await supabase
      .from('tenant_site_config')
      .select('tenant_id, review_token, active_sections_json, template_id, site_templates(slug)')
      .eq('review_token', reviewToken)
      .maybeSingle()

    if (configError || !configRow) {
      return { success: false, error: 'Review session not found.' }
    }

    const config = configRow as Record<string, unknown>
    const tenantId = config.tenant_id as string
    const templateSlug = (config.site_templates as { slug?: string } | null)?.slug ?? null

    const { data: tenant } = await supabase.from('tenants').select('brand_config').eq('id', tenantId).maybeSingle()
    const bc = (tenant as { brand_config?: Record<string, unknown> } | null)?.brand_config ?? {}
    const businessName = typeof bc.business_name === 'string' ? bc.business_name : tenantId

    const { data: variantRows, error: variantError } = await supabase
      .from('tenant_site_variants')
      .select('id, variant_index, variant_label, variant_rationale, template_slug, sections_json, status')
      .eq('tenant_id', tenantId)
      .in('status', ['sent_to_review', 'selected'])
      .order('variant_index', { ascending: true })

    let variants: ClientReviewVariant[] = []
    if (!variantError && variantRows) {
      variants = (variantRows as Array<Record<string, unknown>>).map((row) => ({
        id: typeof row.id === 'string' ? row.id : '',
        variantIndex: typeof row.variant_index === 'number' ? row.variant_index : 0,
        variantLabel: typeof row.variant_label === 'string' ? row.variant_label : 'Variant',
        variantRationale: typeof row.variant_rationale === 'string' ? row.variant_rationale : null,
        templateSlug: typeof row.template_slug === 'string' ? row.template_slug : 'modern',
        sectionsJson: Array.isArray(row.sections_json) ? row.sections_json as SectionConfig[] : [],
        status: typeof row.status === 'string' ? row.status : 'sent_to_review',
      }))
    }

    return {
      success: true,
      data: {
        tenantId,
        reviewToken,
        businessName,
        templateSlug,
        sectionsJson: Array.isArray(config.active_sections_json) ? config.active_sections_json as SectionConfig[] : [],
        status: variants.some((v) => v.status === 'selected') ? 'selected' : 'in_review',
        variants,
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function selectClientVariantByReviewToken(
  reviewToken: string,
  variantIndex: number,
  feedback?: ClientVariantFeedback,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    const { data: configRow, error: configError } = await supabase
      .from('tenant_site_config')
      .select('tenant_id, review_token')
      .eq('review_token', reviewToken)
      .maybeSingle()

    if (configError || !configRow) return { success: false, error: 'Review session not found.' }
    const tenantId = (configRow as { tenant_id: string }).tenant_id

    const { data: variantRow, error: variantError } = await supabase
      .from('tenant_site_variants')
      .select('id, template_slug, sections_json, status')
      .eq('tenant_id', tenantId)
      .eq('variant_index', variantIndex)
      .maybeSingle()

    if (variantError || !variantRow) return { success: false, error: 'Variant not found.' }
    const variant = variantRow as Record<string, unknown>
    if (variant.status !== 'sent_to_review') return { success: false, error: 'Variant is not available for selection.' }

    const { error: updateVariantError } = await supabase
      .from('tenant_site_variants')
      .update({ status: 'selected', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('variant_index', variantIndex)

    if (updateVariantError) return { success: false, error: updateVariantError.message }

    const configUpdate: Record<string, unknown> = {
      client_selected_template_slug: typeof variant.template_slug === 'string' ? variant.template_slug : null,
      client_selected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (feedback) {
      if (feedback.tone !== undefined) configUpdate.client_feedback_tone = feedback.tone
      if (feedback.ctaIntensity !== undefined) configUpdate.client_feedback_cta_intensity = feedback.ctaIntensity
      if (feedback.layoutPreference !== undefined) configUpdate.client_feedback_layout_preference = feedback.layoutPreference
      if (feedback.notes !== undefined) configUpdate.client_feedback_notes = feedback.notes
      if (Object.keys(configUpdate).some((k) => k.startsWith('client_feedback_'))) {
        configUpdate.client_feedback_submitted_at = new Date().toISOString()
      }
    }

    const { error: configUpdateError } = await supabase.from('tenant_site_config').update(configUpdate).eq('tenant_id', tenantId)
    if (configUpdateError && !isMissingSchemaTable(configUpdateError.message, 'tenant_site_config')) return { success: false, error: configUpdateError.message }

    await saveTenantSiteVersion(tenantId, 'client_selected_variant', `Client selected variant ${variantIndex} via review token`, { lifecycleMeta: { reasonCategory: 'client_request', reasonText: null } })

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function mixClientVariantsByReviewToken(
  reviewToken: string,
  selectedSections: Array<{ variantIndex: number; sectionId: string }>,
  feedback?: ClientVariantFeedback,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    const { data: configRow } = await supabase.from('tenant_site_config').select('tenant_id, review_token').eq('review_token', reviewToken).maybeSingle()
    if (!configRow) return { success: false, error: 'Review session not found.' }
    const tenantId = (configRow as { tenant_id: string }).tenant_id

    const { data: variantRows } = await supabase
      .from('tenant_site_variants')
      .select('variant_index, template_slug, sections_json')
      .eq('tenant_id', tenantId)
      .in('status', ['sent_to_review', 'selected'])

    const variantMap = new Map<number, { templateSlug: string; sections: SectionConfig[] }>()
    for (const row of (variantRows ?? []) as Array<Record<string, unknown>>) {
      variantMap.set(
        typeof row.variant_index === 'number' ? row.variant_index : 0,
        { templateSlug: typeof row.template_slug === 'string' ? row.template_slug : 'modern', sections: Array.isArray(row.sections_json) ? row.sections_json as SectionConfig[] : [] },
      )
    }

    const mixedSections: SectionConfig[] = []
    const sourceTemplates = new Set<string>()

    for (const { variantIndex, sectionId } of selectedSections) {
      const variant = variantMap.get(variantIndex)
      if (!variant) continue
      const section = variant.sections.find((s) => s.section === sectionId)
      if (!section) continue
      mixedSections.push(section)
      sourceTemplates.add(variant.templateSlug)
    }

    if (mixedSections.length === 0) return { success: false, error: 'No valid sections selected for mix.' }

    const mixedSectionsSorted = [...mixedSections].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }))

    const configUpdate: Record<string, unknown> = {
      active_sections_json: mixedSectionsSorted,
      client_mix_source_templates: [...sourceTemplates],
      client_mix_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (feedback) {
      if (feedback.tone !== undefined) configUpdate.client_feedback_tone = feedback.tone
      if (feedback.ctaIntensity !== undefined) configUpdate.client_feedback_cta_intensity = feedback.ctaIntensity
      if (feedback.layoutPreference !== undefined) configUpdate.client_feedback_layout_preference = feedback.layoutPreference
      if (feedback.notes !== undefined) configUpdate.client_feedback_notes = feedback.notes
      configUpdate.client_feedback_submitted_at = new Date().toISOString()
    }

    const { error } = await supabase.from('tenant_site_config').update(configUpdate).eq('tenant_id', tenantId)
    if (error) return { success: false, error: error.message }

    for (const row of (variantRows ?? []) as Array<Record<string, unknown>>) {
      await supabase.from('tenant_site_variants').update({ status: 'selected', updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('variant_index', row.variant_index as number)
    }

    await saveTenantSiteVersion(tenantId, 'client_mixed_variant', `Client mixed variant via review token (${sourceTemplates.size} templates)`, { lifecycleMeta: { reasonCategory: 'client_request', reasonText: null } })

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function regenerateSelectedVariantByReviewToken(
  reviewToken: string,
  variantIndex: number,
  reason: string,
  reasonCategory: VariantLifecycleReasonCategory = 'client_request',
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const normalizedReason = normalizeLifecycleReason(reason)
    if (!normalizedReason || normalizedReason.length < 10) return { success: false, error: 'Please provide a regeneration reason of at least 10 characters.' }

    const { data: configRow } = await supabase.from('tenant_site_config').select('tenant_id, template_id, site_templates(slug)').eq('review_token', reviewToken).maybeSingle()
    if (!configRow) return { success: false, error: 'Review session not found.' }
    const tenantId = (configRow as { tenant_id: string }).tenant_id
    const templateSlug = (configRow as { site_templates?: { slug?: string } | null }).site_templates?.slug ?? null

    const { data: variantRow } = await supabase.from('tenant_site_variants').select('id, template_slug, variant_label').eq('tenant_id', tenantId).eq('variant_index', variantIndex).maybeSingle()
    if (!variantRow) return { success: false, error: 'Variant not found.' }
    const variant = variantRow as Record<string, unknown>
    const variantTemplateSlug = typeof variant.template_slug === 'string' ? variant.template_slug : (templateSlug ?? 'modern')

    const template = getTemplate(variantTemplateSlug)
    if (!template) return { success: false, error: `Template "${variantTemplateSlug}" not found in registry.` }

    const freshSections: SectionConfig[] = template.defaultLayout.map((section, idx) => ({ ...section, order: idx + 1, config: {} }))

    const { error: updateError } = await supabase
      .from('tenant_site_variants')
      .update({ sections_json: freshSections, status: 'sent_to_review', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('variant_index', variantIndex)

    if (updateError) return { success: false, error: updateError.message }

    await applyTemplate(tenantId, variantTemplateSlug)

    await saveTenantSiteVersion(
      tenantId,
      'client_regenerated_variant',
      `Client requested regeneration of variant ${variantIndex}. Reason: ${normalizedReason}`,
      { lifecycleMeta: { reasonCategory, reasonText: normalizedReason } },
    )

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
