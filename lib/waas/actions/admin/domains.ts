'use server'
import { revalidatePath } from 'next/cache'
import type { WaasDomainRequest } from '@/lib/waas/types'
import { getAdminClient } from './_shared'
import type { ActionResult } from './_shared'

export type DomainWorkflowStatus =
  | 'requested'
  | 'under_review'
  | 'provisioning'
  | 'live'
  | 'rejected'


export interface AdminDomainRequest {
  id:              string
  tenantId:        string
  businessName:    string
  domainName:      string
  extension:       string
  fullDomain:      string
  priority:        number
  status:          string
  workflowStatus:  DomainWorkflowStatus
  notes:           string | null
  adminNotes:      string | null
  statusHistory:   DomainStatusHistoryEntry[]
  actionedAt:      string | null
  actionedBy:      string | null
  createdAt:       string
  updatedAt:       string
}


export interface DomainStatusHistoryEntry {
  workflowStatus: DomainWorkflowStatus
  changedBy:      string
  changedAt:      string
  note?:          string
}


export interface UpdateDomainRequestStatusArgs {
  requestId:      string
  workflowStatus: DomainWorkflowStatus
  adminNotes?:    string
  changedBy?:     string
}


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
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function getDomainRequests(opts: {
  workflowStatus?: DomainWorkflowStatus | 'all'
} = {}): Promise<ActionResult<AdminDomainRequest[]>> {
  try {
    const supabase = getAdminClient()
    const { workflowStatus = 'all' } = opts
    let q = supabase
      .from('domain_requests')
      .select(`id, tenant_id, domain_name, extension, full_domain, priority, status, workflow_status, notes, admin_notes, status_history, actioned_at, actioned_by, created_at, updated_at`)
      .order('created_at', { ascending: false })
    if (workflowStatus !== 'all') q = q.eq('workflow_status', workflowStatus)
    const { data, error } = await q
    if (error) return { success: false, error: error.message }
    const rows = (data ?? []) as Array<Record<string, unknown>>
    const tenantIds = [...new Set(rows.map((r) => r.tenant_id as string))]
    const { data: tenantRows } = await supabase.from('tenants').select('id, brand_config').in('id', tenantIds)
    const nameMap = new Map<string, string>()
    for (const tr of (tenantRows ?? []) as Array<{ id: string; brand_config: unknown }>) {
      const bc = tr.brand_config as { business_name?: string } | null
      nameMap.set(tr.id, bc?.business_name ?? tr.id)
    }
    return {
      success: true,
      data: rows.map((r) => ({
        id:             r.id             as string,
        tenantId:       r.tenant_id      as string,
        businessName:   nameMap.get(r.tenant_id as string) ?? '—',
        domainName:     r.domain_name    as string,
        extension:      r.extension      as string,
        fullDomain:     r.full_domain    as string,
        priority:       r.priority       as number,
        status:         r.status         as string,
        workflowStatus: (r.workflow_status ?? 'requested') as DomainWorkflowStatus,
        notes:          r.notes          as string | null,
        adminNotes:     r.admin_notes    as string | null,
        statusHistory:  (r.status_history ?? []) as DomainStatusHistoryEntry[],
        actionedAt:     r.actioned_at    as string | null,
        actionedBy:     r.actioned_by    as string | null,
        createdAt:      r.created_at     as string,
        updatedAt:      r.updated_at     as string,
      })),
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load domain requests' }
  }
}


export async function updateDomainRequestStatus(
  args: UpdateDomainRequestStatusArgs,
): Promise<ActionResult<void>> {
  const { requestId, workflowStatus, adminNotes, changedBy = 'admin' } = args
  try {
    const supabase = getAdminClient()
    const { data: currentRow, error: fetchErr } = await supabase
      .from('domain_requests')
      .select('workflow_status, status_history, admin_notes')
      .eq('id', requestId)
      .single()
    if (fetchErr || !currentRow) return { success: false, error: 'Domain request not found.' }
    const row = currentRow as { workflow_status: string; status_history: DomainStatusHistoryEntry[]; admin_notes: string | null }
    const historyEntry: DomainStatusHistoryEntry = { workflowStatus: row.workflow_status as DomainWorkflowStatus, changedBy, changedAt: new Date().toISOString() }
    const newHistory: DomainStatusHistoryEntry[] = [...(Array.isArray(row.status_history) ? row.status_history : []), historyEntry]
    const updatePayload: Record<string, unknown> = { workflow_status: workflowStatus, status_history: newHistory, actioned_at: new Date().toISOString(), actioned_by: changedBy }
    if (adminNotes !== undefined) updatePayload.admin_notes = adminNotes
    const { error } = await supabase.from('domain_requests').update(updatePayload).eq('id', requestId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Update failed' }
  }
}
