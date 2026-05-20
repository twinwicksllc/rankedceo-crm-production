import type { AuditReportData } from '@/lib/waas/types'
import { getRawClient } from './_shared'

// ---------------------------------------------------------------------------
// Audit Data Extraction Helper
// Fetches audit and pre-fills brand_config with keywords, competitors, etc.
// ---------------------------------------------------------------------------

export async function extractAuditDataForPreFill(
  auditId: string | null | undefined,
): Promise<{ audit_enhancements: Record<string, unknown> | null }> {
  if (!auditId) return { audit_enhancements: null }

  try {
    const supabase = getRawClient()
    const { data: audit } = await supabase
      .from('audits')
      .select('report_data')
      .eq('id', auditId)
      .single()

    if (!audit) return { audit_enhancements: null }

    const report = (audit as { report_data: unknown } | null)?.report_data as AuditReportData | null
    if (!report) return { audit_enhancements: null }

    const enhancements: Record<string, unknown> = {}

    // Extract keywords from rankings
    if (report.rankings && Array.isArray(report.rankings) && report.rankings.length > 0) {
      const keywords = report.rankings.slice(0, 5).map((r) => r.keyword)
      enhancements.keywords_from_audit = keywords
    }

    // Extract location and industry from provider_meta
    if (report.provider_meta) {
      if (report.provider_meta.keyword_detected_location) {
        enhancements.detected_location = report.provider_meta.keyword_detected_location
      }
      if (report.provider_meta.keyword_detected_industry) {
        enhancements.detected_industry = report.provider_meta.keyword_detected_industry
      }
    }

    // Extract competitors for "interesting sites" reference
    if (report.competitors && Array.isArray(report.competitors) && report.competitors.length > 0) {
      const competitors_data = report.competitors.map((c) => ({
        url: c.url,
        domain_authority: c.domain_authority,
        keywords_ranking: c.keywords_ranking,
        top_keywords: c.top_keywords || [],
      }))
      enhancements.competitors_from_audit = competitors_data
    }

    // Store page speed metrics for builder recommendations
    if (report.page_speed) {
      enhancements.page_speed_from_audit = report.page_speed
    }

    // Store audit scores for reference
    if (report.summary) {
      enhancements.audit_scores = {
        overall: report.summary.overall_score,
        performance: report.summary.performance_score,
        seo: report.summary.seo_score,
        mobile: report.summary.mobile_score,
        accessibility: report.summary.accessibility_score,
      }
    }

    return { audit_enhancements: Object.keys(enhancements).length > 0 ? enhancements : null }
  } catch (err) {
    console.error('Error extracting audit data:', err)
    return { audit_enhancements: null }
  }
}
