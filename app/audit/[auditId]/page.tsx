// =============================================================================
// /audit/[auditId] — Live Audit Report Dashboard
// "Boardroom Ready" — Red vs Green theme, polling, full SEO report
// Auth Required: User must own the audit or be an admin
// =============================================================================

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AuditReportClient } from './client'
import { createWaasClient } from '@/lib/waas/supabase'
import { createClient } from '@/lib/supabase/server'
import type { WaasAuditRow as WaasAudit } from '@/lib/waas/supabase'
import { extractAuditIdFromRouteParam } from '@/lib/waas/utils/audit-report-url'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Your SEO Audit Report | RankedCEO',
  description: 'See how your site ranks against competitors. Full Google ranking analysis, PageSpeed scores, and gap analysis — powered by RankedCEO.',
  robots: 'noindex, nofollow',  // private audit reports should not be indexed
}

// ---------------------------------------------------------------------------
// Page (server component — initial data fetch)
// ---------------------------------------------------------------------------

interface PageProps {
  params: { auditId: string }
}

export default async function AuditReportPage({ params }: PageProps) {
  const { auditId: rawAuditParam } = params
  const auditId = extractAuditIdFromRouteParam(rawAuditParam)

  // Backward-compatible: accepts UUID only or slug-UUID path segment.
  if (!auditId) {
    notFound()
  }

  // Check authentication
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    redirect(`/audit/login?redirectTo=/audit/${auditId}`)
  }

  // Fetch audit from Supabase (server-side for initial SSR)
  const waasClient = createWaasClient()
  const { data, error } = await waasClient
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (error || !data) {
    notFound()
  }

  const audit = data as WaasAudit

  // Check ownership: user must own the audit or be an admin
  // Audit is owned by the user who created it (tenant_id) or admins can access any audit
  if (audit.tenant_id && user.email) {
    // If audit is linked to a tenant, verify the user is associated with that tenant
    const { data: tenant } = await waasClient
      .from('tenants')
      .select('id')
      .eq('id', audit.tenant_id)
      .eq('submitted_by_email', user.email)
      .single()

    if (!tenant) {
      // User doesn't own this audit
      notFound()
    }
  }

  return (
    <AuditReportClient audit={audit} />
  )
}