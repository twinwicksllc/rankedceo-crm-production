"use server";

import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";

// =============================================================================
// Phase 8.4 — getTenantAuditHistory
//
// Returns a list of completed audits for the tenant (sourced from audits table).
// Used by the Audit History tab in the tenant portal.
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
      .select("id, status, target_url, report_data, completed_at, audit_type")
      .eq("tenant_id", tenantId)
      .in("status", ["completed", "failed"])
      .order("completed_at", { ascending: false })
      .limit(20);

    if (error) return { success: false, error: error.message };

    const items: TenantAuditHistoryItem[] = (
      (data ?? []) as Array<{
        id: string;
        status: string;
        target_url: string;
        report_data: Record<string, unknown> | null;
        completed_at: string | null;
        audit_type: string;
      }>
    ).map((row) => {
      const summary =
        (row.report_data?.summary as Record<string, number> | null) ?? null;
      return {
        id: row.id,
        status: row.status,
        targetUrl: row.target_url,
        overallScore: summary?.overall_score ?? null,
        seoScore: summary?.seo_score ?? null,
        mobileScore: summary?.mobile_score ?? null,
        performanceScore: summary?.performance_score ?? null,
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
