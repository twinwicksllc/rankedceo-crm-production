"use server";

import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";

// =============================================================================
// Phase 8.4 & Initiative 9 — Audit History & Before/After Comparison
//
// Returns a list of completed audits for the tenant (sourced from audits table),
// and computes before/after comparison between the baseline audit (source_audit_id
// or earliest completed audit) and the latest completed audit.
// =============================================================================

export interface TenantAuditHistoryItem {
  id: string;
  status: string;
  targetUrl: string;
  overallScore: number | null;
  seoScore: number | null;
  mobileScore: number | null;
  performanceScore: number | null;
  completedAt: string | null;
  reportUrl: string;
  auditType: string;
}

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
  audit_type: string;
  created_at: string;
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

  const totalCount = completedAudits.length +
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
    totalAuditsCount: totalCount,
  };
}

export async function getTenantAuditHistory(
  reviewToken: string,
): Promise<ActionResult<TenantAuditHistoryItem[]>> {
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { tenantId } = sessionResult.session;

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("audits")
      .select("id, status, target_url, report_data, completed_at, audit_type, created_at")
      .eq("tenant_id", tenantId)
      .in("status", ["completed", "failed"])
      .order("completed_at", { ascending: false })
      .limit(20);

    if (error) return { success: false, error: error.message };

    const items: TenantAuditHistoryItem[] = (
      (data ?? []) as unknown as RawAuditRow[]
    ).map((row) => {
      const summary =
        (row.report_data?.summary as Record<string, number> | null) ?? null;
      return {
        id: row.id,
        status: row.status,
        targetUrl: row.target_url,
        overallScore: summary?.overall_score != null ? Math.round(summary.overall_score) : null,
        seoScore: summary?.seo_score != null ? Math.round(summary.seo_score) : null,
        mobileScore: summary?.mobile_score != null ? Math.round(summary.mobile_score) : null,
        performanceScore: summary?.performance_score != null ? Math.round(summary.performance_score) : null,
        completedAt: row.completed_at,
        reportUrl: `/audit/${row.id}`,
        auditType: row.audit_type,
      };
    });

    return { success: true, data: items };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load audit history",
    };
  }
}

/**
 * Initiative 9: Close the loop with a before/after audit score.
 * Compares the initial/baseline audit (e.g. source_audit_id or earliest completed audit)
 * with the latest completed re-audit for this tenant.
 */
export async function getAuditScoreComparison(
  reviewToken: string,
): Promise<ActionResult<AuditScoreComparison | null>> {
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { tenantId } = sessionResult.session;

  try {
    const supabase = getAdminClient();

    // Fetch tenant's source_audit_id and all completed audits for this tenant
    const [{ data: tenantRow }, { data: auditsData, error: auditsError }] = await Promise.all([
      supabase
        .from("tenants")
        .select("source_audit_id")
        .eq("id", tenantId)
        .single(),
      supabase
        .from("audits")
        .select("id, status, target_url, report_data, completed_at, audit_type, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .order("completed_at", { ascending: true }),
    ]);

    if (auditsError) {
      return { success: false, error: auditsError.message };
    }

    const completedAudits = (auditsData ?? []) as unknown as RawAuditRow[];
    const sourceAuditId =
      (tenantRow as { source_audit_id: string | null } | null)?.source_audit_id ?? null;

    let sourceRow: RawAuditRow | null = null;
    if (sourceAuditId && !completedAudits.some((a) => a.id === sourceAuditId)) {
      const { data } = await supabase
        .from("audits")
        .select("id, status, target_url, report_data, completed_at, audit_type, created_at")
        .eq("id", sourceAuditId)
        .eq("status", "completed")
        .maybeSingle();
      sourceRow = data as unknown as RawAuditRow | null;
    }

    return {
      success: true,
      data: buildAuditScoreComparison(completedAudits, sourceAuditId, sourceRow),
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load audit score comparison",
    };
  }
}
