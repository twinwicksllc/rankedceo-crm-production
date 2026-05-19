'use server'
import { revalidatePath } from 'next/cache'
import type { WaasTenant } from '@/lib/waas/types'
import { generateSiteVariants } from '@/lib/waas/services/generate-site-content'
import { getAdminClient, isMissingSchemaTable } from './_shared'
import type { ActionResult } from './_shared'
import { saveTenantSiteVersion, normalizeLifecycleReason } from './_versioning'
import type { VariantLifecycleReasonCategory } from './_versioning'
import { getTenantVariantStatuses, getVariantReviewReadiness, saveVariantHistorySnapshot } from './variants'
import { ensureClientReviewToken } from './client-review'
import type { VariantReviewReadinessReport } from './variants'

export async function unlockVariantsForEditing(
  tenantId: string,
  reasonCategory: VariantLifecycleReasonCategory = 'workflow_transition',
  reasonText?: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const statuses = await getTenantVariantStatuses(tenantId)
    if (statuses.includes('selected')) {
      return { success: false, error: 'Cannot unlock because a client selection already exists. Regenerate variants or clear selection first.' }
    }
    const { error } = await supabase
      .from('tenant_site_variants')
      .update({ status: 'generated', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('status', 'sent_to_review')
    if (error) {
      if (isMissingSchemaTable(error.message, 'tenant_site_variants')) return { success: false, error: 'Site variant storage is not available in this environment.' }
      return { success: false, error: error.message }
    }
    await saveTenantSiteVersion(tenantId, 'site_variants_unlocked_for_editing', 'Admin unlocked variants for editing', { lifecycleMeta: { reasonCategory, reasonText: normalizeLifecycleReason(reasonText) ?? null } })
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
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
    if (!normalizedReason || normalizedReason.length < 10) return { success: false, error: 'Provide a reopen reason of at least 10 characters.' }
    const statuses = await getTenantVariantStatuses(tenantId)
    if (!statuses.includes('selected')) {
      return { success: false, error: 'No selected variant exists. Use unlock when review is active without a final selection.' }
    }
    const { error: statusError } = await supabase
      .from('tenant_site_variants')
      .update({ status: 'generated', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .in('status', ['selected', 'sent_to_review'])
    if (statusError) {
      if (isMissingSchemaTable(statusError.message, 'tenant_site_variants')) return { success: false, error: 'Site variant storage is not available in this environment.' }
      return { success: false, error: statusError.message }
    }
    const { error: configError } = await supabase
      .from('tenant_site_config')
      .update({ client_selected_template_slug: null, client_selected_at: null, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
    if (configError && !isMissingSchemaTable(configError.message, 'tenant_site_config')) return { success: false, error: configError.message }
    await saveTenantSiteVersion(tenantId, 'site_variants_review_reopened', `Admin reopened review cycle. Reason: ${normalizedReason}`, { lifecycleMeta: { reasonCategory, reasonText: normalizedReason } })
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function generateAndStoreSiteVariants(
  tenantId: string,
  notes?: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const { data: tenant, error: tenantError } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
    if (tenantError || !tenant) return { success: false, error: tenantError?.message ?? 'Tenant not found' }
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
    const { error: upsertError } = await supabase.from('tenant_site_variants').upsert(payload, { onConflict: 'tenant_id,variant_index' })
    if (upsertError) {
      if (isMissingSchemaTable(upsertError.message, 'tenant_site_variants')) return { success: true }
      return { success: false, error: upsertError.message }
    }
    for (const variant of variants) {
      await saveVariantHistorySnapshot(tenantId, variant.variantIndex, `Snapshot after generating variant ${variant.variantIndex}`)
    }
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${tenantId}`)
    revalidatePath(`/_preview/${tenantId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}


export async function markVariantsSentToReview(tenantId: string): Promise<ActionResult<string>> {
  try {
    const supabase = getAdminClient()
    const statuses = await getTenantVariantStatuses(tenantId)
    if (statuses.includes('selected')) {
      return { success: false, error: 'Client selection already exists. Regenerate variants before starting a new review cycle.' }
    }
    if (statuses.includes('sent_to_review') && !statuses.includes('generated')) {
      return { success: false, error: 'Variants are already in client review. Unlock variants before sending again.' }
    }
    const tokenResult = await ensureClientReviewToken(tenantId)
    const reviewToken = tokenResult.data ?? tenantId
    const readiness = await getVariantReviewReadiness(tenantId)
    if (!readiness.success || !readiness.data) return { success: false, error: readiness.error ?? 'Unable to validate variant review readiness.' }
    if (!readiness.data.ready) return { success: false, error: readiness.data.issues[0] ?? 'Variants are not ready for client review.' }
    const { error } = await supabase
      .from('tenant_site_variants')
      .update({ status: 'sent_to_review', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('status', 'generated')
    if (error && !isMissingSchemaTable(error.message, 'tenant_site_variants')) return { success: false, error: error.message }
    await saveTenantSiteVersion(tenantId, 'site_variants_sent_to_review', 'Admin sent generated variants to client review', { lifecycleMeta: { reasonCategory: 'workflow_transition', reasonText: null } })
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    void import('@/lib/waas/services/notifications').then(({ sendTenantNotification }) => {
      void sendTenantNotification({ type: 'site_ready_for_review', tenantId, data: { reviewUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.rankedceo.com'}/edit/${reviewToken}` }, dedupKey: `site_ready_${tenantId}_${new Date().toISOString().slice(0, 10)}` })
    }).catch(() => {})
    return { success: true, data: reviewToken }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
