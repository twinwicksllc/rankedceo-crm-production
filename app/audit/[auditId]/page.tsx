// =============================================================================
// /audit/[auditId] — Live Audit Report Dashboard
// "Boardroom Ready" — Red vs Green theme, polling, full SEO report
// =============================================================================

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AuditReportClient } from './client'
import { createWaasClient } from '@/lib/waas/supabase'
import type { WaasAuditRow as WaasAudit } from '@/lib/waas/supabase'

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
  const { auditId } = params

  // Basic UUID validation — prevent unnecessary DB round trips
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(auditId)) {
    notFound()
  }

  // Fetch audit from Supabase (server-side for initial SSR)
  const supabase = createWaasClient()
  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (error || !data) {
    notFound()
  }

  const audit = data as WaasAudit

  return (
    <AuditReportClient audit={audit} />
  )
}