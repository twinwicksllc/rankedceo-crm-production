'use server'

// =============================================================================
// AdvantagePoint - Admin Server Actions
// Protected actions for Tom & Darrick's Command Center
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { WaasTenant, WaasDomainRequest, SiteVariantRecord } from '@/lib/waas/types'
import { ALL_TEMPLATES, getTemplate } from '@/lib/waas/templates/registry'
import { recommendTemplates, type TemplateRecommendation } from '@/lib/waas/services/template-recommender'
import type { TenantSiteConfig, SectionConfig, SectionId } from '@/lib/waas/templates/types'
import { generateSiteVariants } from '@/lib/waas/services/generate-site-content'

// ---------------------------------------------------------------------------
// Raw service-role client
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase admin env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface ActionResult<T = null> {
  success: boolean
  data?:   T
  error?:  string
}

function parseMissingTenantColumn(errorMessage: string): string | null {
  const match = errorMessage.match(/Could not find the '([^']+)' column of 'tenants' in the schema cache/i)
  return match?.[1] ?? null
}

function isPendingReviewEnumError(errorMessage: string): boolean {
  return /invalid input value for enum .*pending_review/i.test(errorMessage)
}

function isMissingSchemaTable(errorMessage: string, tableName: string): boolean {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`Could not find the table 'public\\.${escaped}' in the schema cache`, 'i')
  return re.test(errorMessage)
}

export interface AdminTenantListItem extends WaasTenant {
  client_selected_template_slug?: string | null
  client_selected_at?: string | null
  client_review_token?: string | null
}

export interface ArchivedTenantListItem {
  id: string
  legal_name: string | null
  brand_config: WaasTenant['brand_config']
  submitted_by_email: string | null
  deleted_at: string
  created_at: string
}

export interface TenantSiteVersion {
  id: string
  change_source: string
  summary: string | null
  template_slug: string | null
  created_at: string
}

export interface TenantDeploymentRecord {
  id: string
  deployed_by: string
  source_version_id: string | null
  deployment_payload_json: Record<string, unknown> | null
  created_at: string
}

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

export interface TenantDetailData {
  tenant:         WaasTenant
  domainRequests: WaasDomainRequest[]
  audit:          Record<string, unknown> | null
  siteConfig:     (TenantSiteConfig & { site_templates?: { slug: string } | null }) | null
  versions:       TenantSiteVersion[]
  deployments:    TenantDeploymentRecord[]
}

export interface DeployReadinessCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface DeployPackageSummary {
  selectedTemplateSlug: string | null
  enabledSections: string[]
  sectionCount: number
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  contactHooks: {
    hasCalendly: boolean
    hasPhone: boolean
    hasEmail: boolean
  }
  clientSelection: {
    templateSlug: string | null
    selectedAt: string | null
    feedbackSubmittedAt: string | null
    mixSubmittedAt: string | null
  }
}

export interface DeployReadinessReport {
  ready: boolean
  checks: DeployReadinessCheck[]
  blockers: string[]
  packageSummary: DeployPackageSummary
}

// ---------------------------------------------------------------------------
// Get all pending + active tenants for the dashboard table
// ---------------------------------------------------------------------------

export async function getAdminTenants(): Promise<ActionResult<AdminTenantListItem[]>> {
  try {
    const supabase = getAdminClient()
    let statuses: string[] = ['pending_review', 'onboarding', 'active']

    let { data, error } = await supabase
      .from('tenants')
      .select('*')
      .in('status', statuses)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error && isPendingReviewEnumError(error.message)) {
      statuses = statuses.filter((status) => status !== 'pending_review')
      const retry = await supabase
        .from('tenants')
        .select('*')
        .in('status', statuses)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      data = retry.data
      error = retry.error
    }

    if (error && parseMissingTenantColumn(error.message) === 'deleted_at') {
      const retry = await supabase
        .from('tenants')
        .select('*')
        .in('status', statuses)
        .order('created_at', { ascending: false })
      data = retry.data
      error = retry.error

      if (error && isPendingReviewEnumError(error.message)) {
        const retryStatuses = statuses.filter((status) => status !== 'pending_review')
        const retryWithoutDeletedAt = await supabase
          .from('tenants')
          .select('*')
          .in('status', retryStatuses)
          .order('created_at', { ascending: false })
        data = retryWithoutDeletedAt.data
        error = retryWithoutDeletedAt.error
      }
    }

    if (error) return { success: false, error: error.message }

    const tenants = (data ?? []) as WaasTenant[]
    if (tenants.length === 0) {
      return { success: true, data: [] }
    }

    const tenantIds = tenants.map(item => item.id)
    const { data: siteConfigRows } = await supabase
      .from('tenant_site_config')
      .select('tenant_id, client_review_token, client_selected_template_slug, client_selected_at')
      .in('tenant_id', tenantIds)

    const siteConfigMap = new Map<string, {
      client_review_token?: string | null
      client_selected_template_slug?: string | null
      client_selected_at?: string | null
    }>()

    for (const row of (siteConfigRows ?? []) as Array<Record<string, unknown>>) {
      const tenantId = row.tenant_id as string | undefined
      if (!tenantId) continue
      siteConfigMap.set(tenantId, {
        client_review_token: (row.client_review_token as string | null | undefined) ?? null,
        client_selected_template_slug: (row.client_selected_template_slug as string | null | undefined) ?? null,
        client_selected_at: (row.client_selected_at as string | null | undefined) ?? null,
      })
    }

    const enriched = tenants.map((tenant) => ({
      ...tenant,
      ...siteConfigMap.get(tenant.id),
    }))

    return { success: true, data: enriched }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function archiveTenant(tenantId: string): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('tenants')
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq('id', tenantId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function getRecentlyArchivedTenants(limit = 8): Promise<ActionResult<ArchivedTenantListItem[]>> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('tenants')
      .select('id, legal_name, brand_config, submitted_by_email, deleted_at, created_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (parseMissingTenantColumn(error.message) === 'deleted_at') {
        return { success: true, data: [] }
      }
      return { success: false, error: error.message }
    }

    return { success: true, data: (data ?? []) as ArchivedTenantListItem[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function restoreArchivedTenant(tenantId: string): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const { error } = await supabase
      .from('tenants')
      .update({
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (error) {
      if (parseMissingTenantColumn(error.message) === 'deleted_at') {
        return { success: false, error: 'This environment does not support archived tenant restore.' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function archiveDuplicatePendingAttempts(): Promise<ActionResult<{ archivedCount: number }>> {
  try {
    const supabase = getAdminClient()
    let statuses: string[] = ['pending_review', 'onboarding']

    let query = supabase
      .from('tenants')
      .select('id, created_at, submitted_by_email, legal_name, brand_config, status')
      .in('status', statuses)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    let { data, error } = await query

    if (error && isPendingReviewEnumError(error.message)) {
      statuses = statuses.filter((status) => status !== 'pending_review')
      const retry = await supabase
        .from('tenants')
        .select('id, created_at, submitted_by_email, legal_name, brand_config, status')
        .in('status', statuses)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      data = retry.data
      error = retry.error
    }

    if (error && parseMissingTenantColumn(error.message) === 'deleted_at') {
      const retry = await supabase
        .from('tenants')
        .select('id, created_at, submitted_by_email, legal_name, brand_config, status')
        .in('status', statuses)
        .order('created_at', { ascending: false })
      data = retry.data
      error = retry.error
    }

    if (error) {
      return { success: false, error: error.message }
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>
    if (rows.length < 2) {
      return { success: true, data: { archivedCount: 0 } }
    }

    const groups = new Map<string, Array<Record<string, unknown>>>()
    for (const row of rows) {
      const brand = (row.brand_config as Record<string, unknown> | null | undefined) ?? {}
      const businessName = (typeof brand.business_name === 'string' && brand.business_name.trim())
        ? brand.business_name.trim().toLowerCase()
        : (typeof row.legal_name === 'string' ? row.legal_name.trim().toLowerCase() : 'unknown')

      const email = typeof row.submitted_by_email === 'string'
        ? row.submitted_by_email.trim().toLowerCase()
        : ''

      const key = `${businessName}::${email}`
      const existing = groups.get(key) ?? []
      existing.push(row)
      groups.set(key, existing)
    }

    const archiveIds: string[] = []
    for (const [, groupRows] of groups) {
      if (groupRows.length < 2) continue
      const sorted = [...groupRows].sort((a, b) => {
        const aTime = new Date(String(a.created_at ?? 0)).getTime()
        const bTime = new Date(String(b.created_at ?? 0)).getTime()
        return bTime - aTime
      })

      for (const row of sorted.slice(1)) {
        if (typeof row.id === 'string' && row.id) {
          archiveIds.push(row.id)
        }
      }
    }

    if (archiveIds.length === 0) {
      return { success: true, data: { archivedCount: 0 } }
    }

    const now = new Date().toISOString()
    const { error: archiveError } = await supabase
      .from('tenants')
      .update({ deleted_at: now, updated_at: now })
      .in('id', archiveIds)

    if (archiveError) {
      return { success: false, error: archiveError.message }
    }

    revalidatePath('/admin/dashboard')
    return { success: true, data: { archivedCount: archiveIds.length } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Get a single tenant with domain requests and audit data
// ---------------------------------------------------------------------------

export async function getTenantDetail(tenantId: string): Promise<ActionResult<TenantDetailData>> {
  try {
    const supabase = getAdminClient()

    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()
    if (tErr) return { success: false, error: tErr.message }

    const { data: domains } = await supabase
      .from('domain_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('priority', { ascending: true })

    const tenantRow = tenant as WaasTenant
    let audit: Record<string, unknown> | null = null
    if (tenantRow.source_audit_id) {
      const { data: auditData } = await supabase
        .from('audits')
        .select('id, status, report_data, target_url, competitor_urls, completed_at')
        .eq('id', tenantRow.source_audit_id)
        .single()
      audit = auditData as Record<string, unknown> | null
    } else if (tenantRow.submitted_by_email) {
      // Fallback for legacy onboarding records that did not persist source_audit_id.
      const { data: fallbackAudit } = await supabase
        .from('audits')
        .select('id, status, report_data, target_url, competitor_urls, completed_at')
        .eq('requestor_email', tenantRow.submitted_by_email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      audit = (fallbackAudit as Record<string, unknown> | null) ?? null
    }

    let resolvedDomainRequests = (domains ?? []) as WaasDomainRequest[]
    if (resolvedDomainRequests.length === 0) {
      // Fallback for environments where domain_requests was unavailable at onboarding time.
      const brandConfigRecord = tenantRow.brand_config as unknown as Record<string, unknown> | undefined
      const domainWishlist = brandConfigRecord?.domain_wishlist
      if (Array.isArray(domainWishlist)) {
        resolvedDomainRequests = domainWishlist.map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>
          const domainName = typeof row.domain_name === 'string' ? row.domain_name : ''
          const extension = typeof row.extension === 'string' ? row.extension : '.com'
          const normalizedStatus = typeof row.status === 'string'
            ? row.status
            : 'requested'

          return {
            id: `wishlist-${tenantId}-${index + 1}`,
            tenant_id: tenantId,
            domain_name: domainName,
            extension,
            full_domain: `${domainName}${extension}`,
            status: (['requested', 'checking', 'available', 'taken', 'registered', 'connected'].includes(normalizedStatus)
              ? normalizedStatus
              : 'requested') as WaasDomainRequest['status'],
            priority: Number(row.priority ?? index + 1),
            notes: null,
            actioned_at: null,
            actioned_by: null,
            created_at: tenantRow.created_at,
            updated_at: tenantRow.updated_at,
          }
        }).filter((row) => row.domain_name)
      }
    }

    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('*, site_templates(slug)')
      .eq('tenant_id', tenantId)
      .single()

    const { data: versionsRows } = await supabase
      .from('tenant_site_versions')
      .select('id, change_source, summary, template_slug, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10)

    let deploymentsRows: Array<Record<string, unknown>> = []
    const { data: deploymentsData, error: deploymentsError } = await supabase
      .from('tenant_site_deployments')
      .select('id, deployed_by, source_version_id, deployment_payload_json, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!deploymentsError) {
      deploymentsRows = (deploymentsData ?? []) as Array<Record<string, unknown>>
    }

    return {
      success: true,
      data: {
        tenant:         tenantRow,
        domainRequests: resolvedDomainRequests,
        audit,
        siteConfig: (siteConfig as (TenantSiteConfig & { site_templates?: { slug: string } | null }) | null) ?? null,
        versions: (versionsRows ?? []) as TenantSiteVersion[],
        deployments: deploymentsRows.map((row) => ({
          id: typeof row.id === 'string' ? row.id : '',
          deployed_by: typeof row.deployed_by === 'string' ? row.deployed_by : 'admin_console',
          source_version_id: typeof row.source_version_id === 'string' ? row.source_version_id : null,
          deployment_payload_json: row.deployment_payload_json && typeof row.deployment_payload_json === 'object'
            ? (row.deployment_payload_json as Record<string, unknown>)
            : null,
          created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
        })),
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
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

export async function getSiteVariants(tenantId: string): Promise<ActionResult<AdminSiteVariant[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('tenant_site_variants')
      .select('id, variant_index, variant_label, variant_rationale, template_slug, sections_json, generation_notes, status, generated_at')
      .eq('tenant_id', tenantId)
      .order('variant_index', { ascending: true })

    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_variants')) {
        return { success: true, data: [] }
      }
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: ((data ?? []) as Array<Record<string, unknown>>).map(mapSiteVariantRow),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
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

export type VariantLifecycleReasonCategory =
  | 'workflow_transition'
  | 'content_revision'
  | 'client_request'
  | 'compliance_update'
  | 'quality_issue'
  | 'other'

interface VariantLifecycleEventMeta {
  reasonCategory: VariantLifecycleReasonCategory
  reasonText: string | null
  actorType: 'admin_user' | 'authenticated_user' | 'public_client' | 'system'
  operatorId: string | null
  operatorEmail: string | null
  operatorRole: string | null
}

interface SaveTenantSiteVersionOptions {
  lifecycleMeta?: {
    reasonCategory?: VariantLifecycleReasonCategory | null
    reasonText?: string | null
  }
}

const LIFECYCLE_REASON_CATEGORY_SET = new Set<VariantLifecycleReasonCategory>([
  'workflow_transition',
  'content_revision',
  'client_request',
  'compliance_update',
  'quality_issue',
  'other',
])

const VARIANT_LIFECYCLE_SOURCES = [
  'site_variants_sent_to_review',
  'site_variants_unlocked_for_editing',
  'site_variants_review_reopened',
  'client_selected_variant',
  'client_mixed_variant',
  'client_regenerated_variant',
] as const

function normalizeLifecycleReason(reason: string | null | undefined): string | null {
  if (typeof reason !== 'string') return null
  const normalized = reason.trim().replace(/\s+/g, ' ')
  if (!normalized) return null
  return normalized.slice(0, 500)
}

function isVariantLifecycleSource(source: string): boolean {
  return VARIANT_LIFECYCLE_SOURCES.includes(source as (typeof VARIANT_LIFECYCLE_SOURCES)[number])
}

function getDefaultReasonCategoryForSource(source: string): VariantLifecycleReasonCategory {
  if (source === 'site_variants_review_reopened') return 'content_revision'
  if (source === 'site_variants_unlocked_for_editing') return 'workflow_transition'
  if (source === 'site_variants_sent_to_review') return 'workflow_transition'
  if (source.startsWith('client_')) return 'client_request'
  return 'other'
}

function normalizeReasonCategory(
  value: VariantLifecycleReasonCategory | string | null | undefined,
  fallback: VariantLifecycleReasonCategory,
): VariantLifecycleReasonCategory {
  if (typeof value !== 'string') return fallback
  return LIFECYCLE_REASON_CATEGORY_SET.has(value as VariantLifecycleReasonCategory)
    ? (value as VariantLifecycleReasonCategory)
    : fallback
}

async function resolveLifecycleOperatorIdentity(source: string): Promise<{
  actorType: 'admin_user' | 'authenticated_user' | 'public_client' | 'system'
  operatorId: string | null
  operatorEmail: string | null
  operatorRole: string | null
}> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        actorType: source.startsWith('client_') ? 'public_client' : 'system',
        operatorId: null,
        operatorEmail: null,
        operatorRole: null,
      }
    }

    const operatorRole = typeof user.app_metadata?.role === 'string'
      ? user.app_metadata.role
      : (typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null)

    const isAdmin = operatorRole === 'waas_admin' || user.app_metadata?.waas_admin === true || user.app_metadata?.waas_admin === 'true'

    return {
      actorType: isAdmin ? 'admin_user' : 'authenticated_user',
      operatorId: user.id,
      operatorEmail: typeof user.email === 'string' ? user.email : null,
      operatorRole,
    }
  } catch {
    return {
      actorType: source.startsWith('client_') ? 'public_client' : 'system',
      operatorId: null,
      operatorEmail: null,
      operatorRole: null,
    }
  }
}

async function getTenantVariantStatuses(tenantId: string): Promise<string[]> {
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

function normalizeVariantSections(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      ...section,
      order: index + 1,
      config: section.config && typeof section.config === 'object' ? section.config : {},
    }))
}

function readContentString(content: unknown, key: string): string | null {
  if (!content || typeof content !== 'object') return null
  const value = (content as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function validateStringLength(value: string | null, max: number, label: string): string | null {
  if (value && value.length > max) {
    return `${label} must be ${max} characters or fewer.`
  }
  return null
}

function validateVariantSections(sections: SectionConfig[]): string | null {
  for (const section of sections) {
    const headline = readContentString(section.content, 'headline')
    const subheadline = readContentString(section.content, 'subheadline')
    const eyebrow = readContentString(section.content, 'eyebrow')

    const headlineErr = validateStringLength(headline, 140, `${section.section} headline`)
    if (headlineErr) return headlineErr

    const subheadlineErr = validateStringLength(subheadline, 700, `${section.section} subheadline`)
    if (subheadlineErr) return subheadlineErr

    const eyebrowErr = validateStringLength(eyebrow, 60, `${section.section} eyebrow`)
    if (eyebrowErr) return eyebrowErr

    if (section.section === 'about') {
      const body = readContentString(section.content, 'body')
      const bodyErr = validateStringLength(body, 2500, 'About body')
      if (bodyErr) return bodyErr

      const highlights = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).highlights
        : null

      if (Array.isArray(highlights)) {
        if (highlights.length > 10) return 'About highlights are limited to 10 items.'
        for (const item of highlights) {
          if (typeof item !== 'string') return 'About highlights must be text items.'
          if (item.length > 120) return 'Each About highlight must be 120 characters or fewer.'
        }
      }
    }

    if (section.section === 'faq') {
      const faqItems = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).items
        : null

      if (Array.isArray(faqItems)) {
        if (faqItems.length > 12) return 'FAQ supports up to 12 items.'
        for (const item of faqItems) {
          if (!item || typeof item !== 'object') return 'FAQ items must be objects.'
          const row = item as Record<string, unknown>
          const question = typeof row.question === 'string' ? row.question.trim() : ''
          const answer = typeof row.answer === 'string' ? row.answer.trim() : ''
          if (!question) return 'Each FAQ item requires a question.'
          if (!answer) return 'Each FAQ item requires an answer.'
          if (question.length > 180) return 'FAQ questions must be 180 characters or fewer.'
          if (answer.length > 700) return 'FAQ answers must be 700 characters or fewer.'
        }
      }
    }

    if (section.section === 'how-it-works') {
      const steps = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).steps
        : null

      if (Array.isArray(steps)) {
        if (steps.length > 8) return 'How It Works supports up to 8 steps.'
        for (const item of steps) {
          if (!item || typeof item !== 'object') return 'How It Works steps must be objects.'
          const row = item as Record<string, unknown>
          const title = typeof row.title === 'string' ? row.title.trim() : ''
          const description = typeof row.description === 'string' ? row.description.trim() : ''
          if (!title) return 'Each How It Works step requires a title.'
          if (!description) return 'Each How It Works step requires a description.'
          if (title.length > 100) return 'How It Works step titles must be 100 characters or fewer.'
          if (description.length > 320) return 'How It Works step descriptions must be 320 characters or fewer.'
        }
      }
    }

    if (section.section === 'services') {
      const items = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).items
        : null

      if (Array.isArray(items)) {
        if (items.length > 12) return 'Services supports up to 12 items.'
        for (const item of items) {
          if (!item || typeof item !== 'object') return 'Service items must be objects.'
          const row = item as Record<string, unknown>
          const title = typeof row.title === 'string' ? row.title.trim() : ''
          if (!title) return 'Each service item requires a title.'
          if (title.length > 90) return 'Service item titles must be 90 characters or fewer.'
          const description = typeof row.description === 'string' ? row.description : null
          const descriptionErr = validateStringLength(description, 260, 'Service item description')
          if (descriptionErr) return descriptionErr
        }
      }
    }
  }

  return null
}

function getVariantCoreSectionFailures(sections: SectionConfig[]): string[] {
  const enabled = new Set(sections.filter((section) => section.enabled).map((section) => section.section))
  const required: Array<SectionId> = ['hero', 'services', 'booking']
  return required.filter((section) => !enabled.has(section))
}

function validateVariantReviewReadiness(
  variantIndex: number,
  sections: SectionConfig[],
): string | null {
  const contentValidation = validateVariantSections(sections)
  if (contentValidation) {
    return `Variant ${variantIndex}: ${contentValidation}`
  }

  const coreSectionFailures = getVariantCoreSectionFailures(sections)
  if (coreSectionFailures.length > 0) {
    return `Variant ${variantIndex}: missing required enabled sections (${coreSectionFailures.join(', ')}).`
  }

  return null
}

export async function getVariantReviewReadiness(
  tenantId: string,
): Promise<ActionResult<VariantReviewReadinessReport>> {
  try {
    const supabase = getAdminClient()
    const { data: variants, error: variantsError } = await supabase
      .from('tenant_site_variants')
      .select('variant_index, sections_json')
      .eq('tenant_id', tenantId)
      .order('variant_index', { ascending: true })

    if (variantsError) {
      if (isMissingSchemaTable(variantsError.message, 'tenant_site_variants')) {
        return { success: false, error: 'Site variants are not available in this environment.' }
      }
      return { success: false, error: variantsError.message }
    }

    const variantRows = (variants ?? []) as Array<Record<string, unknown>>
    const checks: VariantReviewReadinessCheck[] = []
    const reportIssues: string[] = []

    if (variantRows.length < 3) {
      reportIssues.push('Cannot send to client review until 3 variants are generated.')
    }

    for (const row of variantRows) {
      const variantIndex = typeof row.variant_index === 'number' ? row.variant_index : 0
      const sectionsRaw = Array.isArray(row.sections_json) ? row.sections_json : []
      const sections = normalizeVariantSections(toSectionConfigList(sectionsRaw))
      const enabledSections = sections.filter((section) => section.enabled).map((section) => section.section)
      const issues: string[] = []

      if (sections.length === 0) {
        issues.push('No valid sections configured.')
      } else {
        const readinessError = validateVariantReviewReadiness(variantIndex, sections)
        if (readinessError) {
          issues.push(readinessError.replace(new RegExp(`^Variant ${variantIndex}:\\s*`), ''))
        }
      }

      if (issues.length > 0) {
        reportIssues.push(`Variant ${variantIndex}: ${issues.join(' ')}`)
      }

      checks.push({
        variantIndex,
        ready: issues.length === 0,
        issues,
        enabledSections,
      })
    }

    return {
      success: true,
      data: {
        ready: reportIssues.length === 0,
        variantCount: variantRows.length,
        checks,
        issues: reportIssues,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function getVariantLifecycleTelemetry(
  tenantId: string,
): Promise<ActionResult<VariantLifecycleTelemetry>> {
  try {
    const supabase = getAdminClient()

    let variantStatuses: VariantLifecycleVariantStatus[] = []
    const { data: variantRows, error: variantError } = await supabase
      .from('tenant_site_variants')
      .select('variant_index, variant_label, status, updated_at')
      .eq('tenant_id', tenantId)
      .order('variant_index', { ascending: true })

    if (!variantError) {
      variantStatuses = ((variantRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
        variantIndex: typeof row.variant_index === 'number' ? row.variant_index : 0,
        variantLabel: typeof row.variant_label === 'string' ? row.variant_label : 'Variant',
        status: (typeof row.status === 'string' ? row.status : 'generated') as SiteVariantRecord['status'],
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
      }))
    } else if (!isMissingSchemaTable(variantError.message, 'tenant_site_variants')) {
      return { success: false, error: variantError.message }
    }

    let selectedTemplateSlug: string | null = null
    let selectedAt: string | null = null
    const { data: configRow } = await supabase
      .from('tenant_site_config')
      .select('client_selected_template_slug, client_selected_at')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (configRow && typeof configRow === 'object') {
      const row = configRow as Record<string, unknown>
      selectedTemplateSlug = typeof row.client_selected_template_slug === 'string'
        ? row.client_selected_template_slug
        : null
      selectedAt = typeof row.client_selected_at === 'string'
        ? row.client_selected_at
        : null
    }

    let events: VariantLifecycleEvent[] = []
    const { data: versionRows, error: versionError } = await supabase
      .from('tenant_site_versions')
      .select('id, change_source, summary, template_slug, created_at, snapshot_json')
      .eq('tenant_id', tenantId)
      .in('change_source', [...VARIANT_LIFECYCLE_SOURCES])
      .order('created_at', { ascending: false })
      .limit(20)

    if (!versionError) {
      events = ((versionRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...(function parseMeta() {
          const snapshot = row.snapshot_json && typeof row.snapshot_json === 'object'
            ? (row.snapshot_json as Record<string, unknown>)
            : null
          const meta = snapshot?.lifecycle_event_meta && typeof snapshot.lifecycle_event_meta === 'object'
            ? (snapshot.lifecycle_event_meta as Record<string, unknown>)
            : null

          const reasonCategory = typeof meta?.reasonCategory === 'string'
            ? normalizeReasonCategory(meta.reasonCategory, getDefaultReasonCategoryForSource(String(row.change_source ?? '')))
            : getDefaultReasonCategoryForSource(String(row.change_source ?? ''))

          return {
            reasonCategory,
            reasonText: typeof meta?.reasonText === 'string' ? meta.reasonText : null,
            actorType: (typeof meta?.actorType === 'string'
              ? meta.actorType
              : (String(row.change_source ?? '').startsWith('client_') ? 'public_client' : 'system')) as VariantLifecycleEvent['actorType'],
            operatorId: typeof meta?.operatorId === 'string' ? meta.operatorId : null,
            operatorEmail: typeof meta?.operatorEmail === 'string' ? meta.operatorEmail : null,
            operatorRole: typeof meta?.operatorRole === 'string' ? meta.operatorRole : null,
          }
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

    const reviewState: VariantLifecycleTelemetry['reviewState'] = variantStatuses.some((item) => item.status === 'selected')
      ? 'selected'
      : variantStatuses.some((item) => item.status === 'sent_to_review')
        ? 'in_review'
        : 'editing'

    const lastReviewSentAt = events.find((event) => event.changeSource === 'site_variants_sent_to_review')?.createdAt ?? null
    const lastUnlockedAt = events.find((event) => event.changeSource === 'site_variants_unlocked_for_editing')?.createdAt ?? null

    return {
      success: true,
      data: {
        reviewState,
        selectedTemplateSlug,
        selectedAt,
        lastReviewSentAt,
        lastUnlockedAt,
        variantStatuses,
        events,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

async function saveVariantHistorySnapshot(
  tenantId: string,
  variantIndex: number,
  summary: string,
): Promise<void> {
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
    const snapshot = {
      type: 'site_variant_snapshot',
      tenant_id: tenantId,
      variant_index: row.variant_index,
      variant_label: row.variant_label ?? null,
      variant_rationale: row.variant_rationale ?? null,
      template_slug: row.template_slug ?? null,
      sections_json: row.sections_json ?? [],
    }

    await supabase
      .from('tenant_site_versions')
      .insert({
        tenant_id: tenantId,
        change_source: 'variant_edit_snapshot',
        summary,
        template_slug: typeof row.template_slug === 'string' ? row.template_slug : null,
        snapshot_json: snapshot,
        created_at: new Date().toISOString(),
      })
  } catch {
    // Backward-safe: if versioning table/migration is absent, skip snapshots.
  }
}

export async function updateSiteVariant(
  tenantId: string,
  variantIndex: number,
  input: UpdateSiteVariantInput,
): Promise<ActionResult<void>> {
  try {
    if (!Number.isInteger(variantIndex) || variantIndex < 1 || variantIndex > 3) {
      return { success: false, error: 'Variant index must be between 1 and 3.' }
    }

    const supabase = getAdminClient()

    const statuses = await getTenantVariantStatuses(tenantId)
    if (statuses.includes('sent_to_review') || statuses.includes('selected')) {
      return {
        success: false,
        error: 'Variant editing is locked while client review is active. Unlock variants before editing.',
      }
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof input.variantLabel === 'string') {
      const normalized = input.variantLabel.trim()
      if (!normalized) {
        return { success: false, error: 'Variant label cannot be empty.' }
      }
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
      if (validationError) {
        return { success: false, error: validationError }
      }
      patch.sections_json = safeSections
    }

    await saveVariantHistorySnapshot(
      tenantId,
      variantIndex,
      `Snapshot before edit to variant ${variantIndex}`,
    )

    const { error } = await supabase
      .from('tenant_site_variants')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('variant_index', variantIndex)

    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_variants')) {
        return { success: false, error: 'Site variant storage is not available in this environment.' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function getVariantEditHistory(
  tenantId: string,
  variantIndex: number,
  limit = 8,
): Promise<ActionResult<VariantEditHistoryEntry[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('tenant_site_versions')
      .select('id, summary, created_at, snapshot_json, change_source')
      .eq('tenant_id', tenantId)
      .in('change_source', ['variant_edit_snapshot', 'variant_rollback_applied'])
      .order('created_at', { ascending: false })
      .limit(Math.max(10, limit * 4))

    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_versions')) {
        return { success: true, data: [] }
      }
      return { success: false, error: error.message }
    }

    const out: VariantEditHistoryEntry[] = []
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const snapshot = row.snapshot_json && typeof row.snapshot_json === 'object'
        ? (row.snapshot_json as Record<string, unknown>)
        : null
      const snapshotVariantIndex = typeof snapshot?.variant_index === 'number'
        ? snapshot.variant_index
        : null
      if (snapshotVariantIndex !== variantIndex) continue

      out.push({
        versionId: typeof row.id === 'string' ? row.id : '',
        summary: typeof row.summary === 'string' ? row.summary : null,
        createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      })

      if (out.length >= limit) break
    }

    return { success: true, data: out }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function rollbackSiteVariantFromHistory(
  tenantId: string,
  variantIndex: number,
  versionId: string,
): Promise<ActionResult<void>> {
  try {
    if (!versionId) {
      return { success: false, error: 'Version ID is required.' }
    }

    const statuses = await getTenantVariantStatuses(tenantId)
    if (statuses.includes('sent_to_review') || statuses.includes('selected')) {
      return {
        success: false,
        error: 'Variant editing is locked while client review is active. Unlock variants before rollback.',
      }
    }

    const supabase = getAdminClient()
    const { data: versionRow, error: versionError } = await supabase
      .from('tenant_site_versions')
      .select('id, snapshot_json')
      .eq('id', versionId)
      .eq('tenant_id', tenantId)
      .single()

    if (versionError || !versionRow) {
      return { success: false, error: versionError?.message ?? 'Snapshot not found.' }
    }

    const snapshot = (versionRow as { snapshot_json?: Record<string, unknown> | null }).snapshot_json ?? null
    const snapshotVariantIndex = typeof snapshot?.variant_index === 'number' ? snapshot.variant_index : null
    if (snapshotVariantIndex !== variantIndex) {
      return { success: false, error: 'Snapshot does not match this variant.' }
    }

    const sectionsRaw = snapshot?.sections_json
    const safeSections = Array.isArray(sectionsRaw)
      ? normalizeVariantSections(toSectionConfigList(sectionsRaw))
      : null

    if (!safeSections || safeSections.length === 0) {
      return { success: false, error: 'Snapshot is missing valid section data.' }
    }

    const validationError = validateVariantSections(safeSections)
    if (validationError) {
      return { success: false, error: `Snapshot failed validation: ${validationError}` }
    }

    await saveVariantHistorySnapshot(
      tenantId,
      variantIndex,
      `Snapshot before rollback to version ${versionId}`,
    )

    const patch: Record<string, unknown> = {
      sections_json: safeSections,
      updated_at: new Date().toISOString(),
    }

    if (typeof snapshot?.variant_label === 'string' && snapshot.variant_label.trim()) {
      patch.variant_label = snapshot.variant_label.trim().slice(0, 120)
    }

    if (typeof snapshot?.variant_rationale === 'string') {
      const normalized = snapshot.variant_rationale.trim()
      patch.variant_rationale = normalized ? normalized.slice(0, 500) : null
    }

    const { error: updateError } = await supabase
      .from('tenant_site_variants')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('variant_index', variantIndex)

    if (updateError) {
      if (isMissingSchemaTable(updateError.message, 'tenant_site_variants')) {
        return { success: false, error: 'Site variant storage is not available in this environment.' }
      }
      return { success: false, error: updateError.message }
    }

    await saveVariantHistorySnapshot(
      tenantId,
      variantIndex,
      `Rollback applied to variant ${variantIndex}`,
    )

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function unlockVariantsForEditing(
  tenantId: string,
  reasonCategory: VariantLifecycleReasonCategory = 'workflow_transition',
  reasonText?: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const statuses = await getTenantVariantStatuses(tenantId)

    if (statuses.includes('selected')) {
      return {
        success: false,
        error: 'Cannot unlock because a client selection already exists. Regenerate variants or clear selection first.',
      }
    }

    const { error } = await supabase
      .from('tenant_site_variants')
      .update({
        status: 'generated',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'sent_to_review')

    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_variants')) {
        return { success: false, error: 'Site variant storage is not available in this environment.' }
      }
      return { success: false, error: error.message }
    }

    await saveTenantSiteVersion(
      tenantId,
      'site_variants_unlocked_for_editing',
      'Admin unlocked variants for editing',
      {
        lifecycleMeta: {
          reasonCategory,
          reasonText: normalizeLifecycleReason(reasonText) ?? null,
        },
      },
    )

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function reopenVariantReviewCycle(
  tenantId: string,
  reason: string,
  reasonCategory: VariantLifecycleReasonCategory = 'content_revision',
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const normalizedReason = normalizeLifecycleReason(reason)
    if (!normalizedReason || normalizedReason.length < 10) {
      return { success: false, error: 'Provide a reopen reason of at least 10 characters.' }
    }

    const statuses = await getTenantVariantStatuses(tenantId)
    if (!statuses.includes('selected')) {
      return {
        success: false,
        error: 'No selected variant exists. Use unlock when review is active without a final selection.',
      }
    }

    const { error: statusError } = await supabase
      .from('tenant_site_variants')
      .update({
        status: 'generated',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .in('status', ['selected', 'sent_to_review'])

    if (statusError) {
      if (isMissingSchemaTable(statusError.message, 'tenant_site_variants')) {
        return { success: false, error: 'Site variant storage is not available in this environment.' }
      }
      return { success: false, error: statusError.message }
    }

    const { error: configError } = await supabase
      .from('tenant_site_config')
      .update({
        client_selected_template_slug: null,
        client_selected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)

    if (configError && !isMissingSchemaTable(configError.message, 'tenant_site_config')) {
      return { success: false, error: configError.message }
    }

    await saveTenantSiteVersion(
      tenantId,
      'site_variants_review_reopened',
      `Admin reopened review cycle. Reason: ${normalizedReason}`,
      {
        lifecycleMeta: {
          reasonCategory,
          reasonText: normalizedReason,
        },
      },
    )

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function generateAndStoreSiteVariants(
  tenantId: string,
  notes?: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return { success: false, error: tenantError?.message ?? 'Tenant not found' }
    }

    const variants = await generateSiteVariants(tenant as WaasTenant, notes)
    const now = new Date().toISOString()

    const payload = variants.map((variant) => ({
      tenant_id: tenantId,
      variant_index: variant.variantIndex,
      variant_label: variant.variantLabel,
      variant_rationale: variant.variantRationale,
      template_slug: variant.templateSlug,
      sections_json: variant.sections,
      generation_notes: notes ?? null,
      status: 'generated',
      generated_at: now,
      updated_at: now,
    }))

    const { error: upsertError } = await supabase
      .from('tenant_site_variants')
      .upsert(payload, { onConflict: 'tenant_id,variant_index' })

    if (upsertError) {
      if (isMissingSchemaTable(upsertError.message, 'tenant_site_variants')) {
        return { success: true }
      }
      return { success: false, error: upsertError.message }
    }

    for (const variant of variants) {
      await saveVariantHistorySnapshot(
        tenantId,
        variant.variantIndex,
        `Snapshot after generating variant ${variant.variantIndex}`,
      )
    }

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function markVariantsSentToReview(tenantId: string): Promise<ActionResult<string>> {
  try {
    const supabase = getAdminClient()
    const statuses = await getTenantVariantStatuses(tenantId)

    if (statuses.includes('selected')) {
      return {
        success: false,
        error: 'Client selection already exists. Regenerate variants before starting a new review cycle.',
      }
    }

    if (statuses.includes('sent_to_review') && !statuses.includes('generated')) {
      return {
        success: false,
        error: 'Variants are already in client review. Unlock variants before sending again.',
      }
    }

    const tokenResult = await ensureClientReviewToken(tenantId)
    const reviewToken = tokenResult.data ?? tenantId

    const readiness = await getVariantReviewReadiness(tenantId)
    if (!readiness.success || !readiness.data) {
      return { success: false, error: readiness.error ?? 'Unable to validate variant review readiness.' }
    }

    if (!readiness.data.ready) {
      return { success: false, error: readiness.data.issues[0] ?? 'Variants are not ready for client review.' }
    }

    const { error } = await supabase
      .from('tenant_site_variants')
      .update({
        status: 'sent_to_review',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'generated')

    if (error && !isMissingSchemaTable(error.message, 'tenant_site_variants')) {
      return { success: false, error: error.message }
    }

    await saveTenantSiteVersion(
      tenantId,
      'site_variants_sent_to_review',
      'Admin sent generated variants to client review',
      {
        lifecycleMeta: {
          reasonCategory: 'workflow_transition',
          reasonText: null,
        },
      },
    )

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)

    // Phase 6.4: notify tenant that designs are ready for review (fire-and-forget)
    void import('@/lib/waas/services/notifications').then(({ sendTenantNotification }) => {
      void sendTenantNotification({
        type:     'site_ready_for_review',
        tenantId,
        data: {
          reviewUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.rankedceo.com'}/edit/${reviewToken}`,
        },
        dedupKey: `site_ready_${tenantId}_${new Date().toISOString().slice(0, 10)}`,
      })
    }).catch(() => { /* never block on notification failure */ })

    return { success: true, data: reviewToken }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

function toSectionConfigList(value: unknown): SectionConfig[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SectionConfig => {
    if (!item || typeof item !== 'object') return false
    const row = item as Record<string, unknown>
    return typeof row.section === 'string' && typeof row.enabled === 'boolean' && typeof row.order === 'number' && typeof row.config === 'object' && row.config !== null
  })
}

function getCoreSectionFailures(enabledSections: string[]): string[] {
  const required = ['hero', 'services', 'booking']
  return required.filter((section) => !enabledSections.includes(section))
}

export async function getDeployReadiness(tenantId: string): Promise<ActionResult<DeployReadinessReport>> {
  try {
    const supabase = getAdminClient()

    const [{ data: tenant, error: tenantError }, { data: siteConfig, error: configError }] = await Promise.all([
      supabase
        .from('tenants')
        .select('id, slug, domain, subdomain, calendly_url, submitted_by_email, brand_config')
        .eq('id', tenantId)
        .single(),
      supabase
        .from('tenant_site_config')
        .select('meta_title, meta_description, og_image_url, custom_css, active_sections_json, template_id, client_selected_template_slug, client_selected_at, client_feedback_submitted_at, client_mix_submitted_at, site_templates(slug, default_layout_json)')
        .eq('tenant_id', tenantId)
        .single(),
    ])

    if (tenantError || !tenant) {
      return { success: false, error: tenantError?.message ?? 'Tenant not found' }
    }

    if (configError || !siteConfig) {
      return { success: false, error: configError?.message ?? 'Tenant site configuration not found' }
    }

    const tenantRow = tenant as Record<string, unknown>
    const configRow = siteConfig as Record<string, unknown>
    const siteTemplate = (configRow.site_templates as Record<string, unknown> | null | undefined) ?? null

    const templateDefaultSections = toSectionConfigList(siteTemplate?.default_layout_json)
    const activeSections = toSectionConfigList(configRow.active_sections_json)
    const resolvedSections = activeSections.length > 0 ? activeSections : templateDefaultSections
    const enabledSections = resolvedSections.filter((section) => section.enabled).map((section) => section.section)

    const metaTitle = typeof configRow.meta_title === 'string' ? configRow.meta_title.trim() : ''
    const metaDescription = typeof configRow.meta_description === 'string' ? configRow.meta_description.trim() : ''
    const ogImageUrl = typeof configRow.og_image_url === 'string' ? configRow.og_image_url.trim() : ''
    const customCss = typeof configRow.custom_css === 'string' ? configRow.custom_css : ''

    const brandConfig = (tenantRow.brand_config as Record<string, unknown> | null | undefined) ?? null
    const brandContact = (brandConfig?.contact as Record<string, unknown> | null | undefined) ?? null
    const phone = typeof brandContact?.phone === 'string' ? brandContact.phone.trim() : ''
    const email = typeof brandContact?.email === 'string' ? brandContact.email.trim() : ''
    const calendly = typeof tenantRow.calendly_url === 'string' ? tenantRow.calendly_url.trim() : ''
    const submittedByEmail = typeof tenantRow.submitted_by_email === 'string' ? tenantRow.submitted_by_email.trim() : ''

    const coreSectionFailures = getCoreSectionFailures(enabledSections)

    const checks: DeployReadinessCheck[] = [
      {
        id: 'template_selected',
        label: 'Template linked',
        status: configRow.template_id ? 'pass' : 'fail',
        detail: configRow.template_id ? 'Template and site config are linked.' : 'No template is linked to tenant site config.',
      },
      {
        id: 'meta_title',
        label: 'Meta title present',
        status: metaTitle.length >= 20 ? 'pass' : 'fail',
        detail: metaTitle.length >= 20
          ? `Meta title length looks good (${metaTitle.length} chars).`
          : 'Meta title must be at least 20 characters before deploy.',
      },
      {
        id: 'meta_description',
        label: 'Meta description present',
        status: metaDescription.length >= 70 ? 'pass' : 'fail',
        detail: metaDescription.length >= 70
          ? `Meta description length looks good (${metaDescription.length} chars).`
          : 'Meta description must be at least 70 characters before deploy.',
      },
      {
        id: 'core_sections',
        label: 'Core sections enabled',
        status: coreSectionFailures.length === 0 ? 'pass' : 'fail',
        detail: coreSectionFailures.length === 0
          ? 'Hero, services, and booking sections are enabled.'
          : `Missing required enabled sections: ${coreSectionFailures.join(', ')}.`,
      },
      {
        id: 'performance_css_budget',
        label: 'Custom CSS budget',
        status: customCss.length <= 12000 ? 'pass' : 'fail',
        detail: customCss.length <= 12000
          ? `Custom CSS size is within budget (${customCss.length} chars).`
          : `Custom CSS exceeds budget (${customCss.length} chars > 12000).`,
      },
      {
        id: 'performance_section_count',
        label: 'Section count guard',
        status: enabledSections.length <= 6 ? 'pass' : 'warn',
        detail: enabledSections.length <= 6
          ? `Enabled sections count is ${enabledSections.length}.`
          : `Enabled sections count is high (${enabledSections.length}); consider simplifying for performance.`,
      },
      {
        id: 'og_image',
        label: 'Open Graph image',
        status: ogImageUrl ? 'pass' : 'warn',
        detail: ogImageUrl
          ? 'Open Graph image is set.'
          : 'Open Graph image is missing; social previews may be weaker.',
      },
      {
        id: 'contact_hooks',
        label: 'Contact hook present',
        status: calendly || phone || email || submittedByEmail ? 'pass' : 'fail',
        detail: calendly || phone || email || submittedByEmail
          ? 'At least one contact hook is configured.'
          : 'No Calendly, phone, or email contact hook found.',
      },
    ]

    const blockers = checks.filter((check) => check.status === 'fail').map((check) => `${check.label}: ${check.detail}`)

    const packageSummary: DeployPackageSummary = {
      selectedTemplateSlug: (siteTemplate?.slug as string | undefined) ?? null,
      enabledSections,
      sectionCount: enabledSections.length,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      ogImageUrl: ogImageUrl || null,
      contactHooks: {
        hasCalendly: Boolean(calendly),
        hasPhone: Boolean(phone),
        hasEmail: Boolean(email || submittedByEmail),
      },
      clientSelection: {
        templateSlug: (configRow.client_selected_template_slug as string | null | undefined) ?? null,
        selectedAt: (configRow.client_selected_at as string | null | undefined) ?? null,
        feedbackSubmittedAt: (configRow.client_feedback_submitted_at as string | null | undefined) ?? null,
        mixSubmittedAt: (configRow.client_mix_submitted_at as string | null | undefined) ?? null,
      },
    }

    return {
      success: true,
      data: {
        ready: blockers.length === 0,
        checks,
        blockers,
        packageSummary,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function deploySite(tenantId: string, deployedBy = 'admin_console'): Promise<ActionResult<{ deploymentId: string | null }>> {
  try {
    const supabase = getAdminClient()

    const readiness = await getDeployReadiness(tenantId)
    if (!readiness.success || !readiness.data) {
      return { success: false, error: readiness.error ?? 'Unable to validate deploy readiness' }
    }

    if (!readiness.data.ready) {
      return {
        success: false,
        error: `Deploy blocked. Resolve required checks first: ${readiness.data.blockers.join(' | ')}`,
      }
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug, domain, subdomain')
      .eq('id', tenantId)
      .single()

    const tenantRow = (tenant ?? {}) as Record<string, unknown>
    const domain = typeof tenantRow.domain === 'string' ? tenantRow.domain.trim() : ''
    const subdomain = typeof tenantRow.subdomain === 'string' ? tenantRow.subdomain.trim() : ''
    const slug = typeof tenantRow.slug === 'string' ? tenantRow.slug.trim() : ''

    const deploymentUrl = domain
      ? `https://${domain}`
      : subdomain
        ? `https://${subdomain}`
        : slug
          ? `https://${slug}`
          : null

    const deployedAt = new Date().toISOString()

    let selectedVariantSections: SectionConfig[] | null = null
    const { data: selectedVariant, error: variantError } = await supabase
      .from('tenant_site_variants')
      .select('sections_json')
      .eq('tenant_id', tenantId)
      .eq('status', 'selected')
      .order('variant_index', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!variantError && selectedVariant && Array.isArray((selectedVariant as { sections_json?: unknown[] }).sections_json)) {
      selectedVariantSections = (selectedVariant as { sections_json: SectionConfig[] }).sections_json
    }

    const [{ error: tenantUpdateError }, { error: configUpdateError }] = await Promise.all([
      supabase
        .from('tenants')
        .update({
          status: 'active',
          updated_at: deployedAt,
        })
        .eq('id', tenantId),
      supabase
        .from('tenant_site_config')
        .update({
          deployment_url: deploymentUrl,
          deployed_at: deployedAt,
          ...(selectedVariantSections ? { active_sections_json: selectedVariantSections } : {}),
          updated_at: deployedAt,
        })
        .eq('tenant_id', tenantId),
    ])

    if (tenantUpdateError) return { success: false, error: tenantUpdateError.message }
    if (configUpdateError) return { success: false, error: configUpdateError.message }

    const deployedVersionId = await saveTenantSiteVersion(
      tenantId,
      'site_deployed',
      `Deployment completed by ${deployedBy}`,
    )

    let deploymentId: string | null = null
    try {
      const { data: deploymentRow } = await supabase
        .from('tenant_site_deployments')
        .insert({
          tenant_id: tenantId,
          deployed_by: deployedBy,
          source_version_id: deployedVersionId,
          deployment_payload_json: readiness.data.packageSummary,
          created_at: deployedAt,
        })
        .select('id')
        .single()

      deploymentId = (deploymentRow as { id?: string } | null)?.id ?? null
    } catch {
      // Backward-safe: if migration is not applied yet, deployment still succeeds.
    }

    revalidatePath('/admin/dashboard')
    revalidatePath(`/admin/dashboard/${tenantId}`)
    return { success: true, data: { deploymentId } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Update domain request status
// ---------------------------------------------------------------------------

export async function updateDomainStatus(
  requestId: string,
  status: WaasDomainRequest['status'],
  notes?: string,
): Promise<ActionResult> {
  try {
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('domain_requests')
      .update({
        status,
        notes:       notes ?? null,
        actioned_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('id', requestId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Admin stats for dashboard header cards
// ---------------------------------------------------------------------------

export interface AdminStats {
  pendingCount: number
  activeCount:  number
  totalLeads:   number
}

export async function generateTemplateRecommendations(
  tenantId: string
): Promise<ActionResult<TemplateRecommendation[]>> {
  try {
    const supabase = getAdminClient()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('brand_config, target_industry, target_location, usp, calendly_url, financing_enabled')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      return { success: false, error: error?.message ?? 'Tenant not found' }
    }

    const brandConfig = (tenant as { brand_config?: Record<string, unknown> }).brand_config ?? {}

    const recommendations = await recommendTemplates(
      {
        businessName: typeof brandConfig.business_name === 'string' ? brandConfig.business_name : 'Business',
        industry: (tenant as { target_industry?: string | null }).target_industry ?? null,
        location: (tenant as { target_location?: string | null }).target_location ?? null,
        usp: (tenant as { usp?: string | null }).usp ?? null,
        financingEnabled: Boolean((tenant as { financing_enabled?: boolean | null }).financing_enabled),
        hasBooking: Boolean((tenant as { calendly_url?: string | null }).calendly_url),
        tone: typeof brandConfig.tone === 'string' ? brandConfig.tone : null,
      },
      ALL_TEMPLATES,
    )

    return { success: true, data: recommendations }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function getAdminStats(): Promise<ActionResult<AdminStats>> {
  try {
    const supabase = getAdminClient()

    const countTenants = async (statuses: string[]) => {
      let queryStatuses = [...statuses]

      let result = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .in('status', queryStatuses)
        .is('deleted_at', null)

      if (result.error && isPendingReviewEnumError(result.error.message)) {
        queryStatuses = queryStatuses.filter((status) => status !== 'pending_review')
        result = await supabase
          .from('tenants')
          .select('id', { count: 'exact', head: true })
          .in('status', queryStatuses)
          .is('deleted_at', null)
      }

      if (result.error && parseMissingTenantColumn(result.error.message) === 'deleted_at') {
        result = await supabase
          .from('tenants')
          .select('id', { count: 'exact', head: true })
          .in('status', queryStatuses)

        if (result.error && isPendingReviewEnumError(result.error.message)) {
          queryStatuses = queryStatuses.filter((status) => status !== 'pending_review')
          result = await supabase
            .from('tenants')
            .select('id', { count: 'exact', head: true })
            .in('status', queryStatuses)
        }
      }

      if (result.error) throw new Error(result.error.message)
      return result.count ?? 0
    }

    const [pendingCount, activeCount, leadsRes] = await Promise.all([
      countTenants(['pending_review', 'onboarding']),
      countTenants(['active']),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
    ])

    if (leadsRes.error) {
      throw new Error(leadsRes.error.message)
    }

    return {
      success: true,
      data: {
        pendingCount,
        activeCount,
        totalLeads:   leadsRes.count   ?? 0,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Apply template to tenant site config
// Creates or updates tenant_site_config with the selected template
// ---------------------------------------------------------------------------

export async function applyTemplate(
  tenantId:     string,
  templateSlug: string
): Promise<ActionResult<void>> {
  'use server'
  try {
    const supabase = getAdminClient()

    // Look up template id from site_templates table
    const { data: template, error: tplError } = await supabase
      .from('site_templates')
      .select('id, default_layout_json')
      .eq('slug', templateSlug)
      .single()

    if (tplError || !template) {
      // Fallback: use slug as id (registry-only mode without DB templates)
      const { error: upsertError } = await supabase
        .from('tenant_site_config')
        .upsert(
          {
            tenant_id:            tenantId,
            template_id:          null,
            active_sections_json: [],
            updated_at:           new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
      if (upsertError) throw new Error(upsertError.message)
    } else {
      const { error: upsertError } = await supabase
        .from('tenant_site_config')
        .upsert(
          {
            tenant_id:            tenantId,
            template_id:          template.id,
            active_sections_json: [],   // empty = use template defaults
            updated_at:           new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
      if (upsertError) throw new Error(upsertError.message)
    }

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath('/_sites', 'layout')
    await saveTenantSiteVersion(tenantId, 'template_applied', `Applied template ${templateSlug}`)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export interface TenantSiteSettingsInput {
  metaTitle?: string | null
  metaDescription?: string | null
  ogImageUrl?: string | null
  customCss?: string | null
}

export async function updateTenantSiteSettings(
  tenantId: string,
  input: TenantSiteSettingsInput,
): Promise<ActionResult<void>> {
  'use server'
  try {
    const supabase = getAdminClient()

    const metaTitle = input.metaTitle?.trim() || null
    const metaDescription = input.metaDescription?.trim() || null
    const ogImageUrl = input.ogImageUrl?.trim() || null
    const customCss = input.customCss ?? null

    if (metaTitle && metaTitle.length > 160) {
      return { success: false, error: 'Meta title must be 160 characters or fewer.' }
    }

    if (metaDescription && metaDescription.length > 320) {
      return { success: false, error: 'Meta description must be 320 characters or fewer.' }
    }

    if (customCss && customCss.length > 12000) {
      return { success: false, error: 'Custom CSS exceeds 12000 character budget.' }
    }

    let activeSections: unknown[] = []
    const { data: existingConfig } = await supabase
      .from('tenant_site_config')
      .select('active_sections_json')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (Array.isArray((existingConfig as { active_sections_json?: unknown[] } | null)?.active_sections_json)) {
      activeSections = (existingConfig as { active_sections_json?: unknown[] }).active_sections_json ?? []
    }

    const { error } = await supabase
      .from('tenant_site_config')
      .upsert(
        {
          tenant_id: tenantId,
          active_sections_json: activeSections,
          meta_title: metaTitle,
          meta_description: metaDescription,
          og_image_url: ogImageUrl,
          custom_css: customCss,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      )

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath('/_sites', 'layout')
    revalidatePath(`/_preview/${tenantId}`)

    await saveTenantSiteVersion(tenantId, 'admin_site_settings_updated', 'Updated meta and site settings from command center')

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

function generateReviewToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

async function saveTenantSiteVersion(
  tenantId: string,
  source: string,
  summary?: string,
  options?: SaveTenantSiteVersionOptions,
): Promise<string | null> {
  try {
    const supabase = getAdminClient()
    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('template_id, active_sections_json, custom_css, meta_title, meta_description, og_image_url, client_selected_template_slug, client_selected_at, client_feedback_tone, client_feedback_cta_intensity, client_feedback_layout_preference, client_feedback_notes, client_feedback_submitted_at, client_mix_source_templates, client_mix_submitted_at, deployment_url, deployed_at, last_preview_at, site_templates(slug)')
      .eq('tenant_id', tenantId)
      .single()

    if (!siteConfig) return null

    const row = siteConfig as Record<string, unknown>
    const templateSlug = (row.site_templates as { slug?: string } | null | undefined)?.slug ?? null

    const snapshot = {
      template_id: row.template_id ?? null,
      active_sections_json: row.active_sections_json ?? [],
      custom_css: row.custom_css ?? null,
      meta_title: row.meta_title ?? null,
      meta_description: row.meta_description ?? null,
      og_image_url: row.og_image_url ?? null,
      client_selected_template_slug: row.client_selected_template_slug ?? null,
      client_selected_at: row.client_selected_at ?? null,
      client_feedback_tone: row.client_feedback_tone ?? null,
      client_feedback_cta_intensity: row.client_feedback_cta_intensity ?? null,
      client_feedback_layout_preference: row.client_feedback_layout_preference ?? null,
      client_feedback_notes: row.client_feedback_notes ?? null,
      client_feedback_submitted_at: row.client_feedback_submitted_at ?? null,
      client_mix_source_templates: row.client_mix_source_templates ?? [],
      client_mix_submitted_at: row.client_mix_submitted_at ?? null,
      deployment_url: row.deployment_url ?? null,
      deployed_at: row.deployed_at ?? null,
      last_preview_at: row.last_preview_at ?? null,
    }

    let lifecycleEventMeta: VariantLifecycleEventMeta | null = null
    if (isVariantLifecycleSource(source)) {
      const operator = await resolveLifecycleOperatorIdentity(source)
      const fallbackCategory = getDefaultReasonCategoryForSource(source)
      lifecycleEventMeta = {
        reasonCategory: normalizeReasonCategory(options?.lifecycleMeta?.reasonCategory, fallbackCategory),
        reasonText: normalizeLifecycleReason(options?.lifecycleMeta?.reasonText),
        actorType: operator.actorType,
        operatorId: operator.operatorId,
        operatorEmail: operator.operatorEmail,
        operatorRole: operator.operatorRole,
      }
    }

    const { data: inserted } = await supabase
      .from('tenant_site_versions')
      .insert({
        tenant_id: tenantId,
        change_source: source,
        summary: summary ?? null,
        template_slug: templateSlug,
        snapshot_json: lifecycleEventMeta
          ? {
            ...snapshot,
            lifecycle_event_meta: lifecycleEventMeta,
          }
          : snapshot,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    return (inserted as { id?: string } | null)?.id ?? null
  } catch {
    // Backward-safe: if migration not applied, skip version write.
    return null
  }
}

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

export async function rollbackTenantSiteVersion(
  tenantId: string,
  versionId: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const { data: versionRow, error: versionError } = await supabase
      .from('tenant_site_versions')
      .select('snapshot_json, template_slug')
      .eq('id', versionId)
      .eq('tenant_id', tenantId)
      .single()

    if (versionError || !versionRow) {
      return { success: false, error: versionError?.message ?? 'Version snapshot not found' }
    }

    const row = versionRow as { snapshot_json?: Record<string, unknown> | null; template_slug?: string | null }
    const snapshot = row.snapshot_json ?? {}

    let templateId = (snapshot.template_id as string | null | undefined) ?? null
    if (!templateId && row.template_slug) {
      const { data: template } = await supabase
        .from('site_templates')
        .select('id')
        .eq('slug', row.template_slug)
        .single()
      templateId = (template as { id?: string } | null)?.id ?? null
    }

    const payload: Record<string, unknown> = {
      template_id: templateId,
      active_sections_json: snapshot.active_sections_json ?? [],
      custom_css: snapshot.custom_css ?? null,
      meta_title: snapshot.meta_title ?? null,
      meta_description: snapshot.meta_description ?? null,
      og_image_url: snapshot.og_image_url ?? null,
      client_selected_template_slug: snapshot.client_selected_template_slug ?? null,
      client_selected_at: snapshot.client_selected_at ?? null,
      client_feedback_tone: snapshot.client_feedback_tone ?? null,
      client_feedback_cta_intensity: snapshot.client_feedback_cta_intensity ?? null,
      client_feedback_layout_preference: snapshot.client_feedback_layout_preference ?? null,
      client_feedback_notes: snapshot.client_feedback_notes ?? null,
      client_feedback_submitted_at: snapshot.client_feedback_submitted_at ?? null,
      client_mix_source_templates: snapshot.client_mix_source_templates ?? [],
      client_mix_submitted_at: snapshot.client_mix_submitted_at ?? null,
      deployment_url: snapshot.deployment_url ?? null,
      deployed_at: snapshot.deployed_at ?? null,
      last_preview_at: snapshot.last_preview_at ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('tenant_site_config')
      .update(payload)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await saveTenantSiteVersion(tenantId, 'rollback_applied', 'Rolled back to a previous site configuration version')

    revalidatePath('/admin/dashboard')
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath('/_sites', 'layout')
    revalidatePath(`/_preview/${tenantId}`)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// =============================================================================
// reorderVariantSections
// =============================================================================
// Reorders sections within a single site variant using a new ordered list of
// SectionId strings. All other section fields (enabled, config, content) are
// preserved exactly. The order values are rewritten as 1-based contiguous
// integers matching the supplied orderedIds sequence.
//
// This is a thin intent-specific wrapper around updateSiteVariant so the
// client component never ships raw SectionConfig objects over the wire.
// =============================================================================

export async function reorderVariantSections(
  tenantId:        string,
  variantIndex:    number,
  orderedIds:      SectionId[],
): Promise<ActionResult<void>> {
  try {
    if (!tenantId) return { success: false, error: 'Missing tenantId' }
    if (!Number.isInteger(variantIndex) || variantIndex < 1 || variantIndex > 3) {
      return { success: false, error: 'Variant index must be 1–3' }
    }
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return { success: false, error: 'orderedIds must be a non-empty array' }
    }

    // Detect duplicate section IDs
    const seen = new Set<string>()
    for (const id of orderedIds) {
      if (seen.has(id)) return { success: false, error: `Duplicate section id: ${id}` }
      seen.add(id)
    }

    // Fetch the current variant so we can preserve all non-order fields
    const variantsResult = await getSiteVariants(tenantId)
    if (!variantsResult.success || !variantsResult.data) {
      return { success: false, error: variantsResult.error ?? 'Failed to load variants' }
    }

    const variant = variantsResult.data.find((v) => v.variant_index === variantIndex)
    if (!variant) {
      return { success: false, error: `Variant ${variantIndex} not found for tenant ${tenantId}` }
    }

    // Build a lookup map: SectionId → existing SectionConfig
    const sectionMap = new Map<string, SectionConfig>(
      variant.sections_json.map((s) => [s.section, s]),
    )

    // Validate: every supplied id must exist in the current sections
    for (const id of orderedIds) {
      if (!sectionMap.has(id)) {
        return { success: false, error: `Section "${id}" does not exist in variant ${variantIndex}` }
      }
    }

    // Build the reordered list, assigning fresh 1-based order values
    const reordered: SectionConfig[] = orderedIds.map((id, index) => ({
      ...sectionMap.get(id)!,
      order: index + 1,
    }))

    // Any sections that were NOT in orderedIds are appended at the end
    // (safety net — should not happen in normal usage but prevents data loss)
    let tail = variant.sections_json.length + 1
    for (const section of variant.sections_json) {
      if (!seen.has(section.section)) {
        reordered.push({ ...section, order: tail++ })
      }
    }

    return updateSiteVariant(tenantId, variantIndex, { sections: reordered })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}