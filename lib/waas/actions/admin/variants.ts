'use server'
import { revalidatePath } from 'next/cache'
import type { SiteVariantRecord } from '@/lib/waas/types'
import type { SectionConfig, SectionId } from '@/lib/waas/templates/types'
import { generateSiteVariants } from '@/lib/waas/services/generate-site-content'
import { getAdminClient, isMissingSchemaTable } from './_shared'
import type { ActionResult } from './_shared'
import { saveTenantSiteVersion, VARIANT_LIFECYCLE_SOURCES, normalizeReasonCategory, getDefaultReasonCategoryForSource } from './_versioning'
import type { VariantLifecycleReasonCategory } from './_versioning'
import { toSectionConfigList, normalizeVariantSections, validateVariantSections,
         getVariantCoreSectionFailures, validateVariantReviewReadiness } from './_validation'
import type { WaasTenant } from '@/lib/waas/types'

export interface AdminSiteVariant {
  id: string
  variant_index: number
  variant_label: string
  variant_rationale: string | null
  template_slug: string
  sections_json: SectionConfig[]
  generation_notes: string | null
  status: SiteVariantRecord['status']
  generated_at: string
}


export interface UpdateSiteVariantInput {
  variantLabel?: string
  variantRationale?: string | null
  sections?: SectionConfig[]
}


export interface VariantEditHistoryEntry {
  versionId: string
  summary: string | null
  createdAt: string
}


export interface VariantReviewReadinessCheck {
  variantIndex: number
  ready: boolean
  issues: string[]
  enabledSections: string[]
}


export interface VariantReviewReadinessReport {
  ready: boolean
  variantCount: number
  checks: VariantReviewReadinessCheck[]
  issues: string[]
}


export interface VariantLifecycleEvent {
  id: string
  changeSource: string
  summary: string | null
  templateSlug: string | null
  createdAt: string
  reasonCategory: VariantLifecycleReasonCategory | null
  reasonText: string | null
  actorType: 'admin_user' | 'authenticated_user' | 'public_client' | 'system'
  operatorId: string | null
  operatorEmail: string | null
  operatorRole: string | null
}


export interface VariantLifecycleVariantStatus {
  variantIndex: number
  variantLabel: string
  status: SiteVariantRecord['status']
  updatedAt: string | null
}


export interface VariantLifecycleTelemetry {
  reviewState: 'editing' | 'in_review' | 'selected'
  selectedTemplateSlug: string | null
  selectedAt: string | null
  lastReviewSentAt: string | null
  lastUnlockedAt: string | null
  variantStatuses: VariantLifecycleVariantStatus[]
  events: VariantLifecycleEvent[]
}


function mapSiteVariantRow(row: Record<string, unknown>): AdminSiteVariant {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    variant_index: typeof row.variant_index === 'number' ? row.variant_index : 0,
    variant_label: typeof row.variant_label === 'string' ? row.variant_label : 'Variant',
    variant_rationale: typeof row.variant_rationale === 'string' ? row.variant_rationale : null,
    template_slug: typeof row.template_slug === 'string' ? row.template_slug : 'modern',
    sections_json: Array.isArray(row.sections_json) ? row.sections_json as SectionConfig[] : [],
    generation_notes: typeof row.generation_notes === 'string' ? row.generation_notes : null,
    status: (typeof row.status === 'string' ? row.status : 'generated') as SiteVariantRecord['status'],
    generated_at: typeof row.generated_at === 'string' ? row.generated_at : new Date().toISOString(),
  }
}


export async function getTenantVariantStatuses(tenantId: string): Promise<string[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('tenant_site_variants')
    .select('status')
    .eq('tenant_id', tenantId)
  if (error) {
    if (isMissingSchemaTable(error.message, 'tenant_site_variants')) return []
    throw new Error(error.message)
  }
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => (typeof row.status === 'string' ? row.status : 'generated'))
}


export async function saveVariantHistorySnapshot(tenantId: string, variantIndex: number, summary: string): Promise<void> {
  try {
    const supabase = getAdminClient()
    const { data: variantRow, error: variantError } = await supabase
      .from('tenant_site_variants')
      .select('variant_index, variant_label, variant_rationale, template_slug, sections_json')
      .eq('tenant_id', tenantId)
      .eq('variant_index', variantIndex)
      .single()
    if (variantError || !variantRow) return
    const row = variantRow as Record<string, unknown>
    const snapshot = { type: 'site_variant_snapshot', tenant_id: tenantId, variant_index: row.variant_index, variant_label: row.variant_label ?? null, variant_rationale: row.variant_rationale ?? null, template_slug: row.template_slug ?? null, sections_json: row.sections_json ?? [] }
    await supabase.from('tenant_site_versions').insert({ tenant_id: tenantId, change_source: 'variant_edit_snapshot', summary, template_slug: typeof row.template_slug === 'string' ? row.template_slug : null, snapshot_json: snapshot, created_at: new Date().toISOString() })
  } catch { /* backward-safe */ }
}


export async function getSiteVariants(tenantId: string): Promise<ActionResult<AdminSiteVariant[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('tenant_site_variants')
      .select('id, variant_index, variant_label, variant_rationale, template_slug, sections_json, generation_notes, status, generated_at')
      .eq('tenant_id', tenantId)
      .order('variant_index', { ascending: true })
    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_variants')) return { success: true, data: [] }
      return { success: false, error: error.message }
    }
    return { success: true, data: ((data ?? []) as Array<Record<string, unknown>>).map(mapSiteVariantRow) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function getVariantReviewReadiness(tenantId: string): Promise<ActionResult<VariantReviewReadinessReport>> {
  try {
    const supabase = getAdminClient()
    const { data: variants, error: variantsError } = await supabase
      .from('tenant_site_variants')
      .select('variant_index, sections_json')
      .eq('tenant_id', tenantId)
      .order('variant_index', { ascending: true })
    if (variantsError) {
      if (isMissingSchemaTable(variantsError.message, 'tenant_site_variants')) return { success: false, error: 'Site variants are not available in this environment.' }
      return { success: false, error: variantsError.message }
    }
    const variantRows = (variants ?? []) as Array<Record<string, unknown>>
    const checks: VariantReviewReadinessCheck[] = []
    const reportIssues: string[] = []
    if (variantRows.length < 3) reportIssues.push('Cannot send to client review until 3 variants are generated.')
    for (const row of variantRows) {
      const variantIndex = typeof row.variant_index === 'number' ? row.variant_index : 0
      const sectionsRaw = Array.isArray(row.sections_json) ? row.sections_json : []
      const sections = normalizeVariantSections(toSectionConfigList(sectionsRaw))
      const enabledSections = sections.filter((s) => s.enabled).map((s) => s.section)
      const issues: string[] = []
      if (sections.length === 0) {
        issues.push('No valid sections configured.')
      } else {
        const readinessError = validateVariantReviewReadiness(variantIndex, sections)
        if (readinessError) issues.push(readinessError.replace(new RegExp(`^Variant ${variantIndex}:\\s*`), ''))
      }
      if (issues.length > 0) reportIssues.push(`Variant ${variantIndex}: ${issues.join(' ')}`)
      checks.push({ variantIndex, ready: issues.length === 0, issues, enabledSections })
    }
    return { success: true, data: { ready: reportIssues.length === 0, variantCount: variantRows.length, checks, issues: reportIssues } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function getVariantLifecycleTelemetry(tenantId: string): Promise<ActionResult<VariantLifecycleTelemetry>> {
  try {
    const supabase = getAdminClient()
    let variantStatuses: VariantLifecycleVariantStatus[] = []
    const { data: variantRows, error: variantError } = await supabase.from('tenant_site_variants').select('variant_index, variant_label, status, updated_at').eq('tenant_id', tenantId).order('variant_index', { ascending: true })
    if (!variantError) {
      variantStatuses = ((variantRows ?? []) as Array<Record<string, unknown>>).map((row) => ({ variantIndex: typeof row.variant_index === 'number' ? row.variant_index : 0, variantLabel: typeof row.variant_label === 'string' ? row.variant_label : 'Variant', status: (typeof row.status === 'string' ? row.status : 'generated') as SiteVariantRecord['status'], updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null }))
    } else if (!isMissingSchemaTable(variantError.message, 'tenant_site_variants')) {
      return { success: false, error: variantError.message }
    }
    let selectedTemplateSlug: string | null = null
    let selectedAt: string | null = null
    const { data: configRow } = await supabase.from('tenant_site_config').select('client_selected_template_slug, client_selected_at').eq('tenant_id', tenantId).maybeSingle()
    if (configRow && typeof configRow === 'object') {
      const row = configRow as Record<string, unknown>
      selectedTemplateSlug = typeof row.client_selected_template_slug === 'string' ? row.client_selected_template_slug : null
      selectedAt = typeof row.client_selected_at === 'string' ? row.client_selected_at : null
    }
    let events: VariantLifecycleEvent[] = []
    const { data: versionRows, error: versionError } = await supabase.from('tenant_site_versions').select('id, change_source, summary, template_slug, created_at, snapshot_json').eq('tenant_id', tenantId).in('change_source', [...VARIANT_LIFECYCLE_SOURCES]).order('created_at', { ascending: false }).limit(20)
    if (!versionError) {
      events = ((versionRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...(function parseMeta() {
          const snapshot = row.snapshot_json && typeof row.snapshot_json === 'object' ? (row.snapshot_json as Record<string, unknown>) : null
          const meta = snapshot?.lifecycle_event_meta && typeof snapshot.lifecycle_event_meta === 'object' ? (snapshot.lifecycle_event_meta as Record<string, unknown>) : null
          const reasonCategory = typeof meta?.reasonCategory === 'string' ? normalizeReasonCategory(meta.reasonCategory, getDefaultReasonCategoryForSource(String(row.change_source ?? ''))) : getDefaultReasonCategoryForSource(String(row.change_source ?? ''))
          return { reasonCategory, reasonText: typeof meta?.reasonText === 'string' ? meta.reasonText : null, actorType: (typeof meta?.actorType === 'string' ? meta.actorType : (String(row.change_source ?? '').startsWith('client_') ? 'public_client' : 'system')) as VariantLifecycleEvent['actorType'], operatorId: typeof meta?.operatorId === 'string' ? meta.operatorId : null, operatorEmail: typeof meta?.operatorEmail === 'string' ? meta.operatorEmail : null, operatorRole: typeof meta?.operatorRole === 'string' ? meta.operatorRole : null }
        })(),
        id: typeof row.id === 'string' ? row.id : '',
        changeSource: typeof row.change_source === 'string' ? row.change_source : 'unknown_change',
        summary: typeof row.summary === 'string' ? row.summary : null,
        templateSlug: typeof row.template_slug === 'string' ? row.template_slug : null,
        createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      }))
    } else if (!isMissingSchemaTable(versionError.message, 'tenant_site_versions')) {
      return { success: false, error: versionError.message }
    }
    const reviewState: VariantLifecycleTelemetry['reviewState'] = variantStatuses.some((v) => v.status === 'selected') ? 'selected' : variantStatuses.some((v) => v.status === 'sent_to_review') ? 'in_review' : 'editing'
    const lastReviewSentAt = events.find((e) => e.changeSource === 'site_variants_sent_to_review')?.createdAt ?? null
    const lastUnlockedAt = events.find((e) => e.changeSource === 'site_variants_unlocked_for_editing')?.createdAt ?? null
    return { success: true, data: { reviewState, selectedTemplateSlug, selectedAt, lastReviewSentAt, lastUnlockedAt, variantStatuses, events } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function updateSiteVariant(tenantId: string, variantIndex: number, input: UpdateSiteVariantInput): Promise<ActionResult<void>> {
  try {
    if (!Number.isInteger(variantIndex) || variantIndex < 1 || variantIndex > 3) return { success: false, error: 'Variant index must be between 1 and 3.' }
    const supabase = getAdminClient()
    const statuses = await getTenantVariantStatuses(tenantId)
    if (statuses.includes('sent_to_review') || statuses.includes('selected')) return { success: false, error: 'Variant editing is locked while client review is active. Unlock variants before editing.' }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof input.variantLabel === 'string') {
      const normalized = input.variantLabel.trim()
      if (!normalized) return { success: false, error: 'Variant label cannot be empty.' }
      patch.variant_label = normalized.slice(0, 120)
    }
    if (typeof input.variantRationale === 'string') {
      const normalized = input.variantRationale.trim()
      patch.variant_rationale = normalized ? normalized.slice(0, 500) : null
    } else if (input.variantRationale === null) {
      patch.variant_rationale = null
    }
    if (Array.isArray(input.sections)) {
      const safeSections = normalizeVariantSections(toSectionConfigList(input.sections))
      const validationError = validateVariantSections(safeSections)
      if (validationError) return { success: false, error: validationError }
      patch.sections_json = safeSections
    }
    await saveVariantHistorySnapshot(tenantId, variantIndex, `Snapshot before edit to variant ${variantIndex}`)
    const { error } = await supabase.from('tenant_site_variants').update(patch).eq('tenant_id', tenantId).eq('variant_index', variantIndex)
    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_variants')) return { success: false, error: 'Site variant storage is not available in this environment.' }
      return { success: false, error: error.message }
    }
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function getVariantEditHistory(tenantId: string, variantIndex: number, limit = 8): Promise<ActionResult<VariantEditHistoryEntry[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase.from('tenant_site_versions').select('id, summary, created_at, snapshot_json, change_source').eq('tenant_id', tenantId).in('change_source', ['variant_edit_snapshot', 'variant_rollback_applied']).order('created_at', { ascending: false }).limit(Math.max(10, limit * 4))
    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_versions')) return { success: true, data: [] }
      return { success: false, error: error.message }
    }
    const out: VariantEditHistoryEntry[] = []
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const snapshot = row.snapshot_json && typeof row.snapshot_json === 'object' ? (row.snapshot_json as Record<string, unknown>) : null
      const snapshotVariantIndex = typeof snapshot?.variant_index === 'number' ? snapshot.variant_index : null
      if (snapshotVariantIndex !== variantIndex) continue
      out.push({ versionId: typeof row.id === 'string' ? row.id : '', summary: typeof row.summary === 'string' ? row.summary : null, createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString() })
      if (out.length >= limit) break
    }
    return { success: true, data: out }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function rollbackSiteVariantFromHistory(tenantId: string, variantIndex: number, versionId: string): Promise<ActionResult<void>> {
  try {
    if (!versionId) return { success: false, error: 'Version ID is required.' }
    const statuses = await getTenantVariantStatuses(tenantId)
    if (statuses.includes('sent_to_review') || statuses.includes('selected')) return { success: false, error: 'Variant editing is locked while client review is active. Unlock variants before rollback.' }
    const supabase = getAdminClient()
    const { data: versionRow, error: versionError } = await supabase.from('tenant_site_versions').select('id, snapshot_json').eq('id', versionId).eq('tenant_id', tenantId).single()
    if (versionError || !versionRow) return { success: false, error: versionError?.message ?? 'Snapshot not found.' }
    const snapshot = (versionRow as { snapshot_json?: Record<string, unknown> | null }).snapshot_json ?? null
    const snapshotVariantIndex = typeof snapshot?.variant_index === 'number' ? snapshot.variant_index : null
    if (snapshotVariantIndex !== variantIndex) return { success: false, error: 'Snapshot does not match this variant.' }
    const sectionsRaw = snapshot?.sections_json
    const safeSections = Array.isArray(sectionsRaw) ? normalizeVariantSections(toSectionConfigList(sectionsRaw)) : null
    if (!safeSections || safeSections.length === 0) return { success: false, error: 'Snapshot is missing valid section data.' }
    const validationError = validateVariantSections(safeSections)
    if (validationError) return { success: false, error: `Snapshot failed validation: ${validationError}` }
    await saveVariantHistorySnapshot(tenantId, variantIndex, `Snapshot before rollback to version ${versionId}`)
    const patch: Record<string, unknown> = { sections_json: safeSections, updated_at: new Date().toISOString() }
    if (typeof snapshot?.variant_label === 'string' && snapshot.variant_label.trim()) patch.variant_label = snapshot.variant_label.trim().slice(0, 120)
    if (typeof snapshot?.variant_rationale === 'string') { const n = snapshot.variant_rationale.trim(); patch.variant_rationale = n ? n.slice(0, 500) : null }
    const { error: updateError } = await supabase.from('tenant_site_variants').update(patch).eq('tenant_id', tenantId).eq('variant_index', variantIndex)
    if (updateError) {
      if (isMissingSchemaTable(updateError.message, 'tenant_site_variants')) return { success: false, error: 'Site variant storage is not available in this environment.' }
      return { success: false, error: updateError.message }
    }
    await saveVariantHistorySnapshot(tenantId, variantIndex, `Rollback applied to variant ${variantIndex}`)
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


function setSectionConfig(sections: SectionConfig[], sectionId: SectionId, changes: Partial<SectionConfig>): SectionConfig[] {
  return sections.map((section) => {
    if (section.section !== sectionId) return section
    return { ...section, ...changes, config: { ...section.config, ...(changes.config ?? {}) } }
  })
}


function normalizeSectionOrder(sections: SectionConfig[]): SectionConfig[] {
  return [...sections].sort((a, b) => a.order - b.order).map((section, index) => ({ ...section, order: index + 1 }))
}


export async function reorderVariantSections(tenantId: string, variantIndex: number, orderedIds: SectionId[]): Promise<ActionResult<void>> {
  try {
    if (!tenantId) return { success: false, error: 'Missing tenantId' }
    if (!Number.isInteger(variantIndex) || variantIndex < 1 || variantIndex > 3) return { success: false, error: 'Variant index must be 1–3' }
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { success: false, error: 'orderedIds must be a non-empty array' }
    const seen = new Set<string>()
    for (const id of orderedIds) {
      if (seen.has(id)) return { success: false, error: `Duplicate section id: ${id}` }
      seen.add(id)
    }
    const variantsResult = await getSiteVariants(tenantId)
    if (!variantsResult.success || !variantsResult.data) return { success: false, error: variantsResult.error ?? 'Failed to load variants' }
    const variant = variantsResult.data.find((v) => v.variant_index === variantIndex)
    if (!variant) return { success: false, error: `Variant ${variantIndex} not found for tenant ${tenantId}` }
    const sectionMap = new Map<string, SectionConfig>(variant.sections_json.map((s) => [s.section, s]))
    for (const id of orderedIds) {
      if (!sectionMap.has(id)) return { success: false, error: `Section "${id}" does not exist in variant ${variantIndex}` }
    }
    const reordered: SectionConfig[] = orderedIds.map((id, index) => ({ ...sectionMap.get(id)!, order: index + 1 }))
    let tail = variant.sections_json.length + 1
    for (const section of variant.sections_json) {
      if (!seen.has(section.section)) reordered.push({ ...section, order: tail++ })
    }
    return updateSiteVariant(tenantId, variantIndex, { sections: reordered })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
