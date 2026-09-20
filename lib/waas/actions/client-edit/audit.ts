"use server";

import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";
import {
  buildAuditScoreComparison,
  type AuditScoreSnapshot,
  type AuditScoreComparison,
  type RawAuditRow,
} from "./compute-audit-score-comparison";

export type { AuditScoreSnapshot, AuditScoreComparison, RawAuditRow };

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
        auditType: row.audit_type ?? "prospect",
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
 * Pure data loader for tenant audit score comparison.
 * Can be called directly when tenantId & sourceAuditId are already known
 * to avoid duplicate token resolutions and tenant table reads.
 */
export async function loadTenantAuditScoreComparison(
  tenantId: string,
  sourceAuditId: string | null,
): Promise<AuditScoreComparison | null> {
  const supabase = getAdminClient();

  // Bounded query: fetch total count + earliest completed + latest 2 completed
  const [
    { count: totalCount },
    { data: earliestRows },
    { data: latestRows },
  ] = await Promise.all([
    supabase
      .from("audits")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "completed"),
    supabase
      .from("audits")
      .select("id, status, target_url, report_data, completed_at, audit_type, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("completed_at", { ascending: true })
      .limit(1),
    supabase
      .from("audits")
      .select("id, status, target_url, report_data, completed_at, audit_type, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(2),
  ]);

  // Combine rows maintaining uniqueness
  const rowsMap = new Map<string, RawAuditRow>();
  for (const row of (earliestRows ?? []) as unknown as RawAuditRow[]) {
    rowsMap.set(row.id, row);
  }
  for (const row of (latestRows ?? []) as unknown as RawAuditRow[]) {
    rowsMap.set(row.id, row);
  }

  // Sort completed audits chronologically
  const candidateAudits = Array.from(rowsMap.values()).sort((a, b) => {
    const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return timeA - timeB;
  });

  let sourceRow: RawAuditRow | null = null;
  if (sourceAuditId && !rowsMap.has(sourceAuditId)) {
    const { data } = await supabase
      .from("audits")
      .select("id, status, target_url, report_data, completed_at, audit_type, created_at")
      .eq("id", sourceAuditId)
      .eq("status", "completed")
      .maybeSingle();
    sourceRow = data as unknown as RawAuditRow | null;
  }

  return buildAuditScoreComparison(
    candidateAudits,
    sourceAuditId,
    sourceRow,
    (totalCount ?? 0) + (sourceRow && !rowsMap.has(sourceRow.id) ? 1 : 0),
  );
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
    const { data: tenantRow, error: tenantError } = await supabase
      .from("tenants")
      .select("source_audit_id")
      .eq("id", tenantId)
      .single();

    if (tenantError) {
      return { success: false, error: tenantError.message };
    }

    const sourceAuditId =
      (tenantRow as { source_audit_id: string | null } | null)?.source_audit_id ?? null;

    const data = await loadTenantAuditScoreComparison(tenantId, sourceAuditId);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load audit score comparison",
    };
  }
}
