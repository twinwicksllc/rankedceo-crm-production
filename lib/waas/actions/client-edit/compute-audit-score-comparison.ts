// =============================================================================
// lib/waas/actions/client-edit/compute-audit-score-comparison.ts
// Pure helper functions and types for audit score comparison (Initiative 9).
//
// NOTE: This file does NOT have 'use server' so it can export synchronous
// pure functions (buildAuditScoreComparison, parseAuditSnapshot) without
// violating Next.js server-action requirements.
// =============================================================================

export interface AuditScoreSnapshot {
  auditId: string;
  targetUrl: string;
  overallScore: number;
  seoScore: number | null;
  mobileScore: number | null;
  performanceScore: number | null;
  completedAt: string | null;
}

export interface AuditScoreComparison {
  baseline: AuditScoreSnapshot;
  latest: AuditScoreSnapshot | null;
  delta: {
    overall: number;
    seo: number | null;
    mobile: number | null;
    performance: number | null;
  } | null;
  hasReAudit: boolean;
  totalAuditsCount: number;
}

export interface RawAuditRow {
  id: string;
  status: string;
  target_url: string;
  report_data: Record<string, unknown> | null;
  completed_at: string | null;
  audit_type?: string;
  created_at?: string;
}

export function parseAuditSnapshot(row: RawAuditRow): AuditScoreSnapshot | null {
  const summary = (row.report_data?.summary as Record<string, number> | null) ?? null;
  const overall = summary?.overall_score ?? null;
  if (overall === null) return null;

  return {
    auditId: row.id,
    targetUrl: row.target_url,
    overallScore: Math.round(overall),
    seoScore: summary?.seo_score != null ? Math.round(summary.seo_score) : null,
    mobileScore: summary?.mobile_score != null ? Math.round(summary.mobile_score) : null,
    performanceScore: summary?.performance_score != null ? Math.round(summary.performance_score) : null,
    completedAt: row.completed_at,
  };
}

export function buildAuditScoreComparison(
  completedAudits: RawAuditRow[],
  sourceAuditId: string | null,
  sourceAuditRow: RawAuditRow | null = null,
  exactTotalCount?: number,
): AuditScoreComparison | null {
  let baselineRow: RawAuditRow | null = null;

  if (sourceAuditId) {
    const foundInTenantAudits = completedAudits.find((a) => a.id === sourceAuditId);
    baselineRow = foundInTenantAudits ?? sourceAuditRow;
  }

  if (!baselineRow && completedAudits.length > 0) {
    baselineRow = completedAudits[0];
  }

  if (!baselineRow) return null;
  const selectedBaselineRow = baselineRow;

  const baselineSnapshot = parseAuditSnapshot(selectedBaselineRow);
  if (!baselineSnapshot) return null;

  const remainingAudits = completedAudits.filter((a) => a.id !== selectedBaselineRow.id);
  const latestRow = remainingAudits.length > 0
    ? remainingAudits[remainingAudits.length - 1]
    : null;
  const latestSnapshot = latestRow ? parseAuditSnapshot(latestRow) : null;

  let delta: AuditScoreComparison["delta"] = null;
  if (latestSnapshot) {
    delta = {
      overall: latestSnapshot.overallScore - baselineSnapshot.overallScore,
      seo:
        latestSnapshot.seoScore != null && baselineSnapshot.seoScore != null
          ? latestSnapshot.seoScore - baselineSnapshot.seoScore
          : null,
      mobile:
        latestSnapshot.mobileScore != null && baselineSnapshot.mobileScore != null
          ? latestSnapshot.mobileScore - baselineSnapshot.mobileScore
          : null,
      performance:
        latestSnapshot.performanceScore != null && baselineSnapshot.performanceScore != null
          ? latestSnapshot.performanceScore - baselineSnapshot.performanceScore
          : null,
    };
  }

  const computedTotal =
    completedAudits.length +
    (sourceAuditId &&
    !completedAudits.some((a) => a.id === sourceAuditId) &&
    sourceAuditRow
      ? 1
      : 0);

  return {
    baseline: baselineSnapshot,
    latest: latestSnapshot,
    delta,
    hasReAudit: latestSnapshot !== null,
    totalAuditsCount: exactTotalCount ?? computedTotal,
  };
}
