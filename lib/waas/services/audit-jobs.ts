// =============================================================================
// lib/waas/services/audit-jobs.ts
// Background job runner for SEO audits (Initiative 6)
//
// Encapsulates the full audit pipeline: engine call, result save, notifications.
// Dispatched asynchronously via Next.js after() so the HTTP request doesn't wait.
// Called by:
//   - POST /api/audit/run (prospect audits)
//   - deploySite() in admin/deploy.ts (tenant re-audits for before/after comparison)
// =============================================================================

import { updateAuditRecord } from "@/lib/waas/supabase";
import type { WaasAuditUpdate } from "@/lib/waas/supabase";
import { runFullAudit } from "./audit-engine";
import { extractDomain } from "./serper";
import { buildAuditReportPath } from "@/lib/waas/utils/audit-report-url";
import { sendAuditReportReadyEmail } from "./notifications";

export interface RunAuditJobParams {
  targetUrl: string;
  competitorUrls: string[];
  industry: string | null;
  location: string | null;
  requestorName: string | null;
  requestorEmail: string | null;
  requestorPhone: string | null;
  requestorCompany: string | null;
}

// ---------------------------------------------------------------------------
// Notify admin of manual review needed (async — fire and forget)
// ---------------------------------------------------------------------------
async function notifyAdminAuditFailure(
  auditId: string,
  targetUrl: string,
  reason: string,
): Promise<void> {
  try {
    await updateAuditRecord(auditId, {
      admin_notified: true,
      admin_notified_at: new Date().toISOString(),
    });

    const sendgridKey = process.env.SENDGRID_API_KEY;
    const adminEmail = process.env.WAAS_ADMIN_EMAIL ?? "darrick@rankedceo.com";

    if (!sendgridKey) {
      console.log(
        `[Audit Jobs] SendGrid not configured. Manual review needed for audit ${auditId}: ${targetUrl}`,
      );
      return;
    }

    const domain = extractDomain(targetUrl);
    const auditUrl = `${process.env.NEXT_PUBLIC_APP_URL_PROD ?? "https://crm.rankedceo.com"}/waas/audits/${auditId}`;

    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: adminEmail, name: "Darrick" }],
            subject: `⚠️ Manual Audit Required: ${domain}`,
          },
        ],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL ?? "noreply@rankedceo.com",
          name: "RankedCEO Audit System",
        },
        content: [
          {
            type: "text/html",
            value: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #DC2626;">⚠️ Manual Audit Required</h2>
              <p>An audit could not be completed automatically and requires your review.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold; width: 140px;">Audit ID</td><td style="padding: 8px;">${auditId}</td></tr>
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold;">Target URL</td><td style="padding: 8px;"><a href="${targetUrl}">${targetUrl}</a></td></tr>
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold;">Reason</td><td style="padding: 8px; color: #DC2626;">${reason}</td></tr>
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold;">Time</td><td style="padding: 8px;">${new Date().toLocaleString()}</td></tr>
              </table>
              <a href="${auditUrl}" style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Review Audit →
              </a>
            </div>
          `,
          },
        ],
      }),
    });

    console.log(
      `[Audit Jobs] Admin notified at ${adminEmail} for audit ${auditId}`,
    );
  } catch (err) {
    console.error("[Audit Jobs] Failed to notify admin:", err);
  }
}

// ---------------------------------------------------------------------------
// Main job: run full audit, save results, send notifications
// Called by after() from POST /api/audit/run or deploySite()
// ---------------------------------------------------------------------------
export async function runAuditJob(
  auditId: string,
  params: RunAuditJobParams,
): Promise<void> {
  const startTime = Date.now();

  try {
    // Set status to running and record start time
    await updateAuditRecord(auditId, {
      status: "running",
      started_at: new Date().toISOString(),
    });

    console.log(`[Audit Jobs] Starting audit ${auditId}...`);

    // ── Run the audit engine ─────────────────────────────────────────
    let engineResult;
    try {
      engineResult = await runFullAudit(
        params.targetUrl,
        params.competitorUrls,
        params.industry,
        params.location,
      );
    } catch (engineErr) {
      console.error(`[Audit Jobs] Engine error for audit ${auditId}:`, engineErr);

      await updateAuditRecord(auditId, {
        status: "failed",
        error_message: String(engineErr).slice(0, 500),
        manual_review: true,
        manual_review_note: `Engine exception: ${String(engineErr).slice(0, 300)}`,
      });

      await notifyAdminAuditFailure(
        auditId,
        params.targetUrl,
        String(engineErr),
      );

      return;
    }

    // ── Save results to Supabase ────────────────────────────────────────
    const updatePayload: WaasAuditUpdate = {
      status: engineResult.manualReview ? "failed" : "completed",
      report_data: engineResult.reportData,
      completed_at: engineResult.manualReview ? null : new Date().toISOString(),
      seo_provider: engineResult.provider,
      keywords_used: engineResult.keywordsUsed,
      location_detected: engineResult.locationDetected,
      manual_review: engineResult.manualReview,
      manual_review_note: engineResult.manualReviewNote,
    };

    if (params.requestorEmail)
      updatePayload.requestor_email = String(params.requestorEmail);
    if (params.requestorName)
      updatePayload.requestor_name = String(params.requestorName);
    if (params.requestorPhone)
      updatePayload.requestor_phone = String(params.requestorPhone);
    if (params.requestorCompany)
      updatePayload.requestor_company = String(params.requestorCompany);

    await updateAuditRecord(auditId, updatePayload);

    if (engineResult.manualReview) {
      await notifyAdminAuditFailure(
        auditId,
        params.targetUrl,
        engineResult.manualReviewNote ?? "Unknown",
      );
    }

    // ── Send "audit ready" email to requestor (if successful) ────────────
    if (!engineResult.manualReview && params.requestorEmail) {
      const reportPath = buildAuditReportPath(auditId, {
        requestorCompany: params.requestorCompany,
        requestorName: params.requestorName,
        targetUrl: params.targetUrl,
      });
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL_PROD ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "https://crm.rankedceo.com";
      const fullReportUrl = `${baseUrl}${reportPath}`;
      const fullPdfUrl = `${baseUrl}/api/audit/${auditId}/pdf`;

      const summary = engineResult.reportData.summary;
      const score = summary
        ? Math.round(
            summary.performance_score * 0.4 +
              summary.seo_score * 0.3 +
              summary.mobile_score * 0.2 +
              summary.accessibility_score * 0.1,
          )
        : 0;
      const grade =
        ((engineResult.reportData as Record<string, unknown>)
          .grade as string) ?? "F";
      const opps = (engineResult.reportData.opportunities ?? [])
        .slice(0, 3)
        .map(
          (o: { title?: string; description?: string }) =>
            o.title ?? o.description ?? "",
        );
      const targetDom = extractDomain(params.targetUrl);
      const nationalCompetitorNote =
        ((engineResult.reportData as Record<string, unknown>)
          .gap_analysis as { nationalCompetitorNote?: string } | undefined)
          ?.nationalCompetitorNote ?? null;
      const createAccountUrl = `${baseUrl}/audit/${auditId}/create-account`;

      sendAuditReportReadyEmail({
        recipientEmail: String(params.requestorEmail),
        recipientName: params.requestorName,
        auditId,
        targetDomain: targetDom,
        score,
        grade,
        opportunities: opps,
        auditUrl: fullReportUrl,
        pdfUrl: fullPdfUrl,
        nationalCompetitorNote,
        createAccountUrl,
      }).catch((err) =>
        console.error(
          `[Audit Jobs] audit_report_ready email failed for audit ${auditId}:`,
          err,
        ),
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[Audit Jobs] Audit ${auditId} completed in ${elapsed}ms (p95_measurement)`,
    );
  } catch (err) {
    console.error(`[Audit Jobs] Unhandled exception for audit ${auditId}:`, err);
    // Attempt to mark as failed
    try {
      await updateAuditRecord(auditId, {
        status: "failed",
        error_message: String(err).slice(0, 500),
      });
    } catch (updateErr) {
      console.error(`[Audit Jobs] Failed to mark audit ${auditId} as failed:`, updateErr);
    }
  }
}
