'use server'
import { revalidatePath } from 'next/cache'
import type { WaasTenant, WaasDomainRequest, WaasTenantStatus } from '@/lib/waas/types'
import type { TenantSiteConfig, SectionConfig } from '@/lib/waas/templates/types'
import { getAdminClient, parseMissingTenantColumn, isPendingReviewEnumError, isMissingSchemaTable } from './_shared'
export type { ActionResult } from './_shared'

export interface AdminTenantListItem {
  id:           string
  businessName: string
  email:        string
  phone:        string
  industry:     string
  location:     string
  status:       WaasTenantStatus
  createdAt:    string
}


export interface ArchivedTenantListItem extends AdminTenantListItem {
  archivedAt:   string | null
  archivedBy:   string | null
  archiveNote:  string | null
  deletedAt:    string | null
}


export interface TenantSiteVersion {
  id:            string
  change_source: string
  summary:       string | null
  template_slug: string | null
  created_at:    string
}


export interface TenantDeploymentRecord {
  id:                      string
  deployed_by:             string
  source_version_id:       string | null
  deployment_payload_json: Record<string, unknown> | null
  created_at:              string
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
  query?:  string
  status?: WaasTenantStatus | 'all'
  limit?:  number
  offset?: number
}


export type BulkTenantAction = 'activate' | 'archive' | 'reset_to_onboarding'


export async function getAdminTenants(): Promise<AdminTenantListItem[]> {
  const supabase = getAdminClient()

  let query = supabase
    .from('tenants')
    .select('id, brand_config, status, created_at, submitted_by_email')
    .order('created_at', { ascending: false })
    .is('deleted_at', null)

  const { data, error } = await query

  if (error) {
    // Check for missing deleted_at column
    if (parseMissingTenantColumn(error.message) === 'deleted_at') {
      const fallbackQuery = supabase
        .from('tenants')
        .select('id, brand_config, status, created_at, submitted_by_email')
        .order('created_at', { ascending: false })
      const { data: fallbackData, error: fallbackError } = await fallbackQuery
      if (fallbackError) throw new Error(fallbackError.message)
      return mapTenantsToListItems(fallbackData ?? [])
    }
    throw new Error(error.message)
  }

  return mapTenantsToListItems(data ?? [])
}

function mapTenantsToListItems(rows: unknown[]): AdminTenantListItem[] {
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const bc = (row.brand_config as Record<string, unknown> | null) ?? {}
    const contact = (bc.contact as Record<string, unknown> | null) ?? {}
    return {
      id:           row.id           as string,
      businessName: typeof bc.business_name === 'string' ? bc.business_name : '—',
      email:        typeof contact.email     === 'string' ? contact.email    : typeof row.submitted_by_email === 'string' ? row.submitted_by_email : '—',
      phone:        typeof contact.phone     === 'string' ? contact.phone    : '—',
      industry:     typeof bc.industry       === 'string' ? bc.industry      : '—',
      location:     typeof bc.location       === 'string' ? bc.location      : '—',
      status:       (row.status as WaasTenantStatus) ?? 'onboarding',
      createdAt:    row.created_at  as string,
    }
  })
}


export async function archiveTenant(
  tenantId: string,
  archivedBy: string,
  note?: string,
): Promise<import('./_shared').ActionResult<void>> {
  const supabase = getAdminClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tenants')
    .update({
      status:       'archived',
      archived_at:  now,
      archived_by:  archivedBy,
      archive_note: note ?? null,
      updated_at:   now,
    })
    .eq('id', tenantId)
  if (error) {
    const col = parseMissingTenantColumn(error.message)
    if (col) return { success: false, error: `Column \`${col}\` is missing from the tenants table. Please apply the latest migration.` }
    return { success: false, error: error.message }
  }
  revalidatePath('/admin/dashboard')
  return { success: true }
}


export async function getRecentlyArchivedTenants(): Promise<import('./_shared').ActionResult<ArchivedTenantListItem[]>> {
  const supabase = getAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, brand_config, status, created_at, submitted_by_email, archived_at, archived_by, archive_note, deleted_at')
    .eq('status', 'archived')
    .gte('archived_at', cutoff)
    .order('archived_at', { ascending: false })
  if (error) {
    const col = parseMissingTenantColumn(error.message)
    if (col) return { success: false, error: `Column \`${col}\` is missing from the tenants table.` }
    return { success: false, error: error.message }
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  return {
    success: true,
    data: rows.map((row) => {
      const bc = (row.brand_config as Record<string, unknown> | null) ?? {}
      const contact = (bc.contact as Record<string, unknown> | null) ?? {}
      return {
        id:           row.id as string,
        businessName: typeof bc.business_name === 'string' ? bc.business_name : '—',
        email:        typeof contact.email === 'string' ? contact.email : typeof row.submitted_by_email === 'string' ? row.submitted_by_email : '—',
        phone:        typeof contact.phone === 'string' ? contact.phone : '—',
        industry:     typeof bc.industry === 'string' ? bc.industry : '—',
        location:     typeof bc.location === 'string' ? bc.location : '—',
        status:       (row.status as WaasTenantStatus) ?? 'archived',
        createdAt:    row.created_at as string,
        archivedAt:   (row.archived_at as string | null) ?? null,
        archivedBy:   (row.archived_by as string | null) ?? null,
        archiveNote:  (row.archive_note as string | null) ?? null,
        deletedAt:    (row.deleted_at as string | null) ?? null,
      }
    }),
  }
}


export async function restoreArchivedTenant(
  tenantId: string,
): Promise<import('./_shared').ActionResult<void>> {
  const supabase = getAdminClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tenants')
    .update({
      status:       'onboarding',
      archived_at:  null,
      archived_by:  null,
      archive_note: null,
      updated_at:   now,
    })
    .eq('id', tenantId)
    .eq('status', 'archived')
  if (error) {
    const col = parseMissingTenantColumn(error.message)
    if (col) return { success: false, error: `Column \`${col}\` is missing from the tenants table. Please apply the latest migration.` }
    return { success: false, error: error.message }
  }
  revalidatePath('/admin/dashboard')
  return { success: true }
}


export async function archiveDuplicatePendingAttempts(
  tenantId: string,
  keepTenantId: string,
  archivedBy: string,
): Promise<import('./_shared').ActionResult<{ archivedCount: number }>> {
  const supabase = getAdminClient()
  const now = new Date().toISOString()

  const { data: sourceTenant, error: sourceErr } = await supabase
    .from('tenants')
    .select('submitted_by_email, brand_config')
    .eq('id', tenantId)
    .single()

  if (sourceErr || !sourceTenant) return { success: false, error: sourceErr?.message ?? 'Source tenant not found' }

  const row = sourceTenant as { submitted_by_email: string | null; brand_config: Record<string, unknown> | null }
  const email = row.submitted_by_email?.toLowerCase().trim() ?? null
  const bc = row.brand_config ?? {}
  const contactEmail = typeof (bc.contact as Record<string, unknown> | null)?.email === 'string'
    ? ((bc.contact as Record<string, unknown>).email as string).toLowerCase().trim()
    : null

  const matchEmail = email ?? contactEmail
  if (!matchEmail) return { success: false, error: 'Source tenant has no email to match.' }

  let duplicatesQuery = supabase
    .from('tenants')
    .select('id, status')
    .neq('id', keepTenantId)
    .in('status', ['onboarding', 'pending_review'])
    .is('deleted_at', null)

  const { data: candidates, error: candidatesErr } = await duplicatesQuery
  if (candidatesErr) {
    const col = parseMissingTenantColumn(candidatesErr.message)
    if (col === 'deleted_at') {
      duplicatesQuery = supabase.from('tenants').select('id, status').neq('id', keepTenantId).in('status', ['onboarding', 'pending_review'])
      const { data: fallback, error: fbErr } = await duplicatesQuery
      if (fbErr) return { success: false, error: fbErr.message }
      const fallbackIds = (fallback ?? []).map((r: Record<string, unknown>) => r.id as string)
      if (!fallbackIds.length) return { success: true, data: { archivedCount: 0 } }
      const { data: emailMatches, error: emailErr } = await supabase.from('tenants').select('id, submitted_by_email, brand_config').in('id', fallbackIds)
      if (emailErr) return { success: false, error: emailErr.message }
      const matchIds = (emailMatches ?? []).filter((r: Record<string, unknown>) => {
        const rEmail = (r.submitted_by_email as string | null)?.toLowerCase().trim()
        const rBc = (r.brand_config as Record<string, unknown> | null) ?? {}
        const rContactEmail = typeof (rBc.contact as Record<string, unknown> | null)?.email === 'string' ? ((rBc.contact as Record<string, unknown>).email as string).toLowerCase().trim() : null
        return rEmail === matchEmail || rContactEmail === matchEmail
      }).map((r: Record<string, unknown>) => r.id as string)
      if (!matchIds.length) return { success: true, data: { archivedCount: 0 } }
      const { error: archiveErr } = await supabase.from('tenants').update({ status: 'archived', archived_at: now, archived_by: archivedBy, archive_note: 'Auto-archived duplicate pending attempt', updated_at: now }).in('id', matchIds)
      if (archiveErr) return { success: false, error: archiveErr.message }
      revalidatePath('/admin/dashboard')
      return { success: true, data: { archivedCount: matchIds.length } }
    }
    if (isPendingReviewEnumError(candidatesErr.message)) {
      duplicatesQuery = supabase.from('tenants').select('id, status').neq('id', keepTenantId).eq('status', 'onboarding').is('deleted_at', null)
      const { data: fallback2, error: fbErr2 } = await duplicatesQuery
      if (fbErr2) return { success: false, error: fbErr2.message }
      candidates.push(...(fallback2 ?? []))
    } else {
      return { success: false, error: candidatesErr.message }
    }
  }

  const candidateIds = (candidates ?? []).map((r: Record<string, unknown>) => r.id as string)
  if (!candidateIds.length) return { success: true, data: { archivedCount: 0 } }

  const { data: emailMatches2, error: emailErr2 } = await supabase.from('tenants').select('id, submitted_by_email, brand_config').in('id', candidateIds)
  if (emailErr2) return { success: false, error: emailErr2.message }

  const matchIds2 = (emailMatches2 ?? []).filter((r: Record<string, unknown>) => {
    const rEmail = (r.submitted_by_email as string | null)?.toLowerCase().trim()
    const rBc = (r.brand_config as Record<string, unknown> | null) ?? {}
    const rContactEmail = typeof (rBc.contact as Record<string, unknown> | null)?.email === 'string' ? ((rBc.contact as Record<string, unknown>).email as string).toLowerCase().trim() : null
    return rEmail === matchEmail || rContactEmail === matchEmail
  }).map((r: Record<string, unknown>) => r.id as string)

  if (!matchIds2.length) return { success: true, data: { archivedCount: 0 } }

  const { error: archiveErr2 } = await supabase.from('tenants').update({ status: 'archived', archived_at: now, archived_by: archivedBy, archive_note: 'Auto-archived duplicate pending attempt', updated_at: now }).in('id', matchIds2)
  if (archiveErr2) return { success: false, error: archiveErr2.message }

  revalidatePath('/admin/dashboard')
  return { success: true, data: { archivedCount: matchIds2.length } }
}


export async function getTenantDetail(tenantId: string): Promise<import('./_shared').ActionResult<TenantDetailData>> {
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
): Promise<import('./_shared').ActionResult<AdminTenantListItem[]>> {
  const supabase = getAdminClient()
  const { query = '', status = 'all', limit = 50, offset = 0 } = filters
  let q = supabase
    .from('tenants')
    .select('id, brand_config, status, created_at, submitted_by_email')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (status !== 'all') q = q.eq('status', status)
  if (query) q = q.or(`submitted_by_email.ilike.%${query}%`)
  const { data, error } = await q
  if (error) {
    const col = parseMissingTenantColumn(error.message)
    if (col === 'deleted_at') {
      let q2 = supabase.from('tenants').select('id, brand_config, status, created_at, submitted_by_email').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      if (status !== 'all') q2 = q2.eq('status', status)
      if (query) q2 = q2.or(`submitted_by_email.ilike.%${query}%`)
      const { data: d2, error: e2 } = await q2
      if (e2) return { success: false, error: e2.message }
      return { success: true, data: mapTenantsToListItems(d2 ?? []) }
    }
    return { success: false, error: error.message }
  }
  return { success: true, data: mapTenantsToListItems(data ?? []) }
}


export async function bulkUpdateTenantStatus(
  tenantIds: string[],
  action: BulkTenantAction,
  performedBy: string,
): Promise<import('./_shared').ActionResult<{ updatedCount: number }>> {
  const supabase = getAdminClient()
  const now = new Date().toISOString()
  const statusMap: Record<BulkTenantAction, WaasTenantStatus> = {
    activate:              'active',
    archive:               'archived',
    reset_to_onboarding:   'onboarding',
  }
  const newStatus = statusMap[action]
  const updatePayload: Record<string, unknown> = { status: newStatus, updated_at: now }
  if (action === 'archive') {
    updatePayload.archived_at  = now
    updatePayload.archived_by  = performedBy
    updatePayload.archive_note = 'Bulk archive'
  }
  const { error, count } = await supabase.from('tenants').update(updatePayload).in('id', tenantIds).select('id', { count: 'exact', head: true })
  if (error) {
    const col = parseMissingTenantColumn(error.message)
    if (col) return { success: false, error: `Column \`${col}\` is missing from the tenants table.` }
    return { success: false, error: error.message }
  }
  revalidatePath('/admin/dashboard')
  return { success: true, data: { updatedCount: count ?? tenantIds.length } }
}
