// =============================================================================
// POST /api/audit/[auditId]/create-tenant
// Create a tenant from a completed audit (prospect → customer conversion)
// Idempotent: returns existing tenant if already created from this audit
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createWaasClient, getWaasAdminClient } from "@/lib/waas/supabase";
import { ensureClientReviewToken } from "@/lib/waas/actions/admin";
import { sendTenantNotification, sendAuditReportReadyEmail } from "@/lib/waas/services/notifications";
import type { WaasTenantInsert } from "@/lib/waas/supabase";
import type { WaasTenant } from "@/lib/waas/types";

interface CreateTenantResponse {
  tenantId: string;
  reviewToken: string;
  existing?: boolean; // true if tenant already existed for this audit
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ auditId: string }> },
): Promise<NextResponse<CreateTenantResponse | { error: string }>> {
  try {
    const { auditId } = await context.params;

    if (!auditId || typeof auditId !== "string") {
      return NextResponse.json(
        { error: "Invalid auditId" },
        { status: 400 },
      );
    }

    const supabase = createWaasClient();
    const adminClient = getWaasAdminClient();

    // ── Fetch audit record ──────────────────────────────────────────────────
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("*")
      .eq("id", auditId)
      .single();

    if (auditError || !audit) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 },
      );
    }

    const auditRow = audit as Record<string, unknown>;
    const requestorEmail = (auditRow.requestor_email as string | null) ?? null;
    const requestorName = (auditRow.requestor_name as string | null) ?? null;
    const industry = (auditRow.industry as string | null) ?? null;
    const location = (auditRow.location_detected as string | null) ?? null;

    if (!requestorEmail) {
      return NextResponse.json(
        { error: "Audit has no requestor email; cannot create tenant" },
        { status: 400 },
      );
    }

    // ── Check if tenant already exists for this audit ─────────────────────
    const { data: existingTenant } = await adminClient
      .from("tenants")
      .select("id")
      .eq("source_audit_id", auditId)
      .maybeSingle();

    if (existingTenant) {
      // Tenant already created from this audit — get its review token
      const existingId = (existingTenant as { id: string }).id;
      const { data: configRow } = await adminClient
        .from("tenant_site_config")
        .select("client_review_token")
        .eq("tenant_id", existingId)
        .maybeSingle();

      const reviewToken = (configRow as { client_review_token?: string } | null)
        ?.client_review_token ?? null;

      if (!reviewToken) {
        const tokenResult = await ensureClientReviewToken(existingId);
        if (!tokenResult.success || !tokenResult.data) {
          return NextResponse.json(
            { error: "Failed to generate review token" },
            { status: 500 },
          );
        }
        return NextResponse.json({
          tenantId: existingId,
          reviewToken: tokenResult.data,
          existing: true,
        });
      }

      return NextResponse.json({
        tenantId: existingId,
        reviewToken,
        existing: true,
      });
    }

    // ── Check if auth user exists for requestor email ────────────────────
    const authClient = await createAuthClient();
    const { data: existingUser } = await authClient.auth.admin.listUsers();
    const userExists = existingUser?.users.some(
      (u) => u.email?.toLowerCase() === requestorEmail.toLowerCase(),
    );

    // ── Create new tenant ───────────────────────────────────────────────
    const insert: WaasTenantInsert = {
      legal_name: requestorName ?? null,
      source_audit_id: auditId,
      submitted_by_email: requestorEmail,
      status: "onboarding",
      onboarding_step: 1,
      brand_config: {
        seo: {
          service_area: location ?? null,
          target_keywords: [],
          key_phrases: [],
        },
        content: {},
        assets: {},
        inspiration: { urls: null },
        functionality: {
          contact_form: true,
          booking: false,
          gallery: false,
          ecommerce: false,
          blog: false,
        },
      },
      created_at: new Date().toISOString(),
    };

    const { data: newTenant, error: createError } = await adminClient
      .from("tenants")
      .insert(insert)
      .select("id")
      .single();

    if (createError || !newTenant) {
      console.error("[create-tenant] Failed to create tenant:", createError);
      return NextResponse.json(
        { error: "Failed to create tenant" },
        { status: 500 },
      );
    }

    const tenantId = (newTenant as { id: string }).id;

    // ── Generate review token ───────────────────────────────────────────
    const tokenResult = await ensureClientReviewToken(tenantId);
    if (!tokenResult.success || !tokenResult.data) {
      console.error("[create-tenant] Failed to generate review token");
      return NextResponse.json(
        { error: "Failed to generate review token" },
        { status: 500 },
      );
    }
    const reviewToken = tokenResult.data;

    // ── Send notifications (fire-and-forget) ────────────────────────────

    // 1. Send regular "audit_report_ready" email
    const reportPath = `/audit/${auditId}`;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL_PROD ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://crm.rankedceo.com";
    const fullReportUrl = `${baseUrl}${reportPath}`;
    const fullPdfUrl = `${baseUrl}/api/audit/${auditId}/pdf`;

    const reportData = (auditRow.report_data as Record<string, unknown>) ?? {};
    const summary = (reportData.summary as Record<string, unknown>) ?? {};
    const score = summary.overall_score as number | undefined
      ? Math.round((summary.overall_score as number) * 100) / 100
      : 0;
    const grade = (reportData.grade as string) ?? "F";
    const opportunities = ((reportData.opportunities as Array<{ title?: string; description?: string }> | undefined) ?? [])
      .slice(0, 3)
      .map((o) => o.title ?? o.description ?? "");
    const nationalCompetitorNote =
      ((reportData.gap_analysis as { nationalCompetitorNote?: string } | undefined)
        ?.nationalCompetitorNote) ?? null;

    sendAuditReportReadyEmail({
      recipientEmail: requestorEmail,
      recipientName: requestorName,
      auditId,
      targetDomain: (auditRow.target_url as string) ?? "your site",
      score,
      grade,
      opportunities,
      auditUrl: fullReportUrl,
      pdfUrl: fullPdfUrl,
      nationalCompetitorNote,
    }).catch((err) =>
      console.error("[create-tenant] audit_report_ready email failed:", err),
    );

    // 2. Send "onboarding_started" notification email
    sendTenantNotification({
      type: "onboarding_started",
      tenantId,
      data: {
        businessName: requestorName ?? undefined,
        reviewUrl: `${baseUrl}/onboarding/1?tenantId=${tenantId}`,
      },
      recipientEmail: requestorEmail,
      dedupKey: `onboarding_started:${tenantId}`,
      dedupWindowHours: 24,
    }).catch((err) =>
      console.error("[create-tenant] onboarding_started email failed:", err),
    );

    // If auth user doesn't exist, send them an invite/welcome email
    if (!userExists) {
      sendTenantNotification({
        type: "account_created",
        tenantId,
        data: {
          businessName: requestorName ?? undefined,
          reviewUrl: `${baseUrl}/audit/auth/confirm?next=/onboarding/1?tenantId=${tenantId}`,
        },
        recipientEmail: requestorEmail,
        dedupKey: `account_created:${tenantId}`,
        dedupWindowHours: 24,
      }).catch((err) =>
        console.error("[create-tenant] account_created email failed:", err),
      );
    }

    return NextResponse.json({
      tenantId,
      reviewToken,
    });
  } catch (err) {
    console.error("[create-tenant] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
