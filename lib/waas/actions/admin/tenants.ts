'use server'
import { revalidatePath } from 'next/cache'
import type { WaasTenant, WaasDomainRequest, WaasTenantStatus } from '@/lib/waas/types'
import type { TenantSiteConfig } from '@/lib/waas/templates/types'
import { getAdminClient, parseMissingTenantColumn, isPendingReviewEnumError } from './_shared'
import type { ActionResult } from './_shared'
export type { ActionResult } from './_shared'

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

export interface TenantDetailData {
  tenant:         WaasTenant
  domainRequests: WaasDomainRequest[]
  audit:          Record<string, unknown> | null
  siteConfig:     (TenantSiteConfig & { site_templates?: { slug: string } | null }) | null
  versions:       TenantSiteVersion[]
  deployments:    TenantDeploymentRecord[]
}

export interface TenantSearchFilters {
  query?:   string
  status?:  WaasTenantStatus | 'all'
  sortBy?:  'created_at' | 'business_name'
  sortDir?: 'asc' | 'desc'
}

export type BulkTenantAction = 'activate' | 'suspend'


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
      const brandConfigRecord = tenantRow.brand_config as unknown as Record<string, unknown> | undefined
      const domainWishlist = brandConfigRecord?.domain_wishlist
      if (Array.isArray(domainWishlist)) {
        resolvedDomainRequests = domainWishlist.map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>
          const domainName = typeof row.domain_name === 'string' ? row.domain_name : ''
          const extension = typeof row.extension === 'string' ? row.extension : '.com'
          const normalizedStatus = typeof row.status === 'string' ? row.status : 'requested'
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
          id:                      typeof row.id === 'string' ? row.id : '',
          deployed_by:             typeof row.deployed_by === 'string' ? row.deployed_by : 'admin_console',
          source_version_id:       typeof row.source_version_id === 'string' ? row.source_version_id : null,
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

export async function searchTenants(
  filters: TenantSearchFilters = {},
): Promise<ActionResult<AdminTenantListItem[]>> {
  try {
    const supabase = getAdminClient()
    const { query = '', status = 'all', sortBy = 'created_at', sortDir = 'desc' } = filters

    let q = supabase
      .from('tenants')
      .select('*')
      .is('deleted_at', null)
      .order(sortBy === 'business_name' ? 'slug' : 'created_at', { ascending: sortDir === 'asc' })

    if (status !== 'all') {
      q = q.eq('status', status)
    } else {
      q = q.in('status', ['pending_review', 'onboarding', 'active', 'suspended'])
    }

    const { data, error } = await q

    if (error) return { success: false, error: error.message }

    let tenants = (data ?? []) as WaasTenant[]

    if (query.trim()) {
      const q_lower = query.toLowerCase()
      tenants = tenants.filter((t) => {
        const bc = t.brand_config as { business_name?: string } | null
        const name   = (bc?.business_name ?? '').toLowerCase()
        const slug   = (t.slug ?? '').toLowerCase()
        const domain = (t.domain ?? t.subdomain ?? '').toLowerCase()
        return name.includes(q_lower) || slug.includes(q_lower) || domain.includes(q_lower)
      })
    }

    if (tenants.length === 0) return { success: true, data: [] }

    const tenantIds = tenants.map((t) => t.id)
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
      const tid = row.tenant_id as string | undefined
      if (!tid) continue
      siteConfigMap.set(tid, {
        client_review_token:           (row.client_review_token           as string | null | undefined) ?? null,
        client_selected_template_slug: (row.client_selected_template_slug as string | null | undefined) ?? null,
        client_selected_at:            (row.client_selected_at            as string | null | undefined) ?? null,
      })
    }

    return {
      success: true,
      data: tenants.map((t) => ({ ...t, ...siteConfigMap.get(t.id) })),
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Search failed' }
  }
}

export async function bulkUpdateTenantStatus(
  tenantIds: string[],
  action:    BulkTenantAction,
): Promise<ActionResult<{ updatedCount: number }>> {
  if (!tenantIds.length) return { success: false, error: 'No tenants selected.' }

  const newStatus: WaasTenantStatus = action === 'activate' ? 'active' : 'suspended'

  try {
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .in('id', tenantIds)
      .is('deleted_at', null)

    if (error) return { success: false, error: error.message }

    return { success: true, data: { updatedCount: tenantIds.length } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Bulk update failed' }
  }
}
