// =============================================================================
// lib/waas/services/notifications.ts
//
// Tenant lifecycle email notification service for Phase 6.4.
//
// Supports Resend (preferred) and SendGrid as email providers.
// Falls back to console.log in development / when no API key is configured.
//
// All sends are logged to the notification_log table regardless of provider
// for full audit trail. Deduplication prevents duplicate sends within a
// configurable window (default 24h).
//
// Usage:
//   import { sendTenantNotification } from '@/lib/waas/services/notifications'
//   await sendTenantNotification({
//     type:     'site_ready_for_review',
//     tenantId: tenant.id,
//     data:     { businessName: 'Acme Plumbing' },
//   })
//
// Phase 6.4
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import {
  renderEmailTemplate,
  type NotificationTemplateData,
} from "./email-templates";

export type { NotificationTemplateData };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | "site_ready_for_review" // Tenant: your designs are ready
  | "domain_status_update" // Tenant: domain status changed
  | "site_live" // Tenant: 🎉 your site is live
  | "approval_received" // Admin:  client approved variant N
  | "client_first_edit" // Admin (digest stub): client edited their site
  // Phase 8.3 — billing lifecycle
  | "subscription_activated" // Tenant: payment confirmed, plan is active
  | "payment_failed" // Tenant: payment failed, action required
  | "plan_changed" // Tenant: plan upgraded or downgraded
  // Task 4 — abandonment emails
  | "audit_abandoned_stage_1" // 1h: gentle reminder, show top opportunity
  | "audit_abandoned_stage_2" // 24h: value prop + scarcity angle
  | "audit_abandoned_stage_3" // 48h: social proof + limited-time offer
  | "audit_abandoned_stage_4" // 72h: final call, emphasize urgency
  // Task 9 — audit report ready (sent to requestor when audit completes)
  | "audit_report_ready";

export interface SendNotificationArgs {
  type: NotificationType;
  tenantId: string;
  data: NotificationTemplateData;
  /** Override recipient (default: pulled from tenant's brand_config.contact.email) */
  recipientEmail?: string;
  /** Dedup key — notification won't be resent if this key was used within dedupWindowHours */
  dedupKey?: string;
  dedupWindowHours?: number; // default 24
}

export interface NotificationResult {
  sent: boolean;
  skipped: boolean;
  provider: string;
  messageId: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Supabase admin client (lazy init)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("WaaS Supabase env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Provider: Resend
// ---------------------------------------------------------------------------

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string | null; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { messageId: null, error: "RESEND_API_KEY not set" };

  const fromEmail =
    process.env.NOTIFICATION_FROM_EMAIL ?? "noreply@rankedceo.com";

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });

    const json = (await resp.json()) as { id?: string; message?: string };

    if (!resp.ok) {
      return { messageId: null, error: json.message ?? `HTTP ${resp.status}` };
    }

    return { messageId: json.id ?? null };
  } catch (err) {
    return {
      messageId: null,
      error: err instanceof Error ? err.message : "Resend fetch failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Provider: SendGrid
// ---------------------------------------------------------------------------

async function sendViaSendGrid(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string | null; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { messageId: null, error: "SENDGRID_API_KEY not set" };

  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? "noreply@rankedceo.com";

  try {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }], subject: opts.subject }],
        from: { email: fromEmail },
        content: [{ type: "text/html", value: opts.html }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        messageId: null,
        error: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
      };
    }

    const messageId = resp.headers.get("X-Message-Id");
    return { messageId };
  } catch (err) {
    return {
      messageId: null,
      error: err instanceof Error ? err.message : "SendGrid fetch failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Deduplication check
// ---------------------------------------------------------------------------

async function isDuplicate(
  dedupKey: string,
  windowHours: number,
): Promise<boolean> {
  try {
    const supabase = getAdminClient();
    const windowAgo = new Date(
      Date.now() - windowHours * 60 * 60 * 1000,
    ).toISOString();

    const { data } = await supabase
      .from("notification_log")
      .select("id")
      .eq("dedup_key", dedupKey)
      .eq("status", "sent")
      .gte("created_at", windowAgo)
      .limit(1)
      .single();

    return Boolean(data);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Log to notification_log
// ---------------------------------------------------------------------------

async function logNotification(opts: {
  tenantId: string;
  recipientEmail: string;
  type: NotificationType;
  subject: string;
  templateData: NotificationTemplateData;
  status: "sent" | "failed" | "skipped";
  provider: string;
  providerMessageId: string | null;
  errorMessage?: string;
  dedupKey?: string;
}): Promise<void> {
  try {
    const supabase = getAdminClient();
    await supabase.from("notification_log").insert({
      tenant_id: opts.tenantId,
      recipient_email: opts.recipientEmail,
      notification_type: opts.type,
      subject: opts.subject,
      template_data: opts.templateData as Record<string, unknown>,
      status: opts.status,
      provider: opts.provider,
      provider_message_id: opts.providerMessageId,
      error_message: opts.errorMessage ?? null,
      dedup_key: opts.dedupKey ?? null,
    });
  } catch (logErr) {
    // Never let logging errors break the main flow
    console.error("[notifications] Failed to log notification:", logErr);
  }
}

// ---------------------------------------------------------------------------
// Resolve recipient email for a tenant
// ---------------------------------------------------------------------------

async function resolveTenantEmail(
  tenantId: string,
  override?: string,
): Promise<string | null> {
  if (override) return override;

  try {
    const supabase = getAdminClient();
    const { data } = await supabase
      .from("tenants")
      .select("brand_config")
      .eq("id", tenantId)
      .single();

    if (!data) return null;

    const bc = (data as { brand_config: Record<string, unknown> }).brand_config;
    const email = (bc?.contact as { email?: string } | null)?.email;
    return email ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main: sendTenantNotification
// ---------------------------------------------------------------------------

export async function sendTenantNotification(
  args: SendNotificationArgs,
): Promise<NotificationResult> {
  const {
    type,
    tenantId,
    data,
    recipientEmail: recipientOverride,
    dedupKey,
    dedupWindowHours = 24,
  } = args;

  // 1. Resolve recipient
  const recipientEmail = await resolveTenantEmail(tenantId, recipientOverride);

  if (!recipientEmail) {
    console.warn(
      `[notifications] No email for tenant ${tenantId} — skipping ${type}`,
    );
    return {
      sent: false,
      skipped: true,
      provider: "none",
      messageId: null,
      error: "No recipient email",
    };
  }

  // 2. Deduplication
  if (dedupKey) {
    const dupe = await isDuplicate(dedupKey, dedupWindowHours);
    if (dupe) {
      console.log(`[notifications] Skipping duplicate: ${dedupKey}`);
      await logNotification({
        tenantId,
        recipientEmail,
        type,
        subject: "[dedup skip]",
        templateData: data,
        status: "skipped",
        provider: "none",
        providerMessageId: null,
        dedupKey,
      });
      return { sent: false, skipped: true, provider: "none", messageId: null };
    }
  }

  // 3. Render template
  const { subject, html } = renderEmailTemplate(type, data);

  // 4. Send via available provider
  let provider = "log_only";
  let messageId: string | null = null;
  let sendError: string | undefined;

  if (process.env.RESEND_API_KEY) {
    provider = "resend";
    const result = await sendViaResend({ to: recipientEmail, subject, html });
    messageId = result.messageId;
    sendError = result.error;
  } else if (process.env.SENDGRID_API_KEY) {
    provider = "sendgrid";
    const result = await sendViaSendGrid({ to: recipientEmail, subject, html });
    messageId = result.messageId;
    sendError = result.error;
  } else {
    // Development fallback — log to console
    console.log(`[notifications] LOG ONLY — would send to ${recipientEmail}:`);
    console.log(`  Type:    ${type}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  HTML length: ${html.length} chars`);
  }

  const status = sendError ? "failed" : "sent";

  // 5. Log result
  await logNotification({
    tenantId,
    recipientEmail,
    type,
    subject,
    templateData: data,
    status,
    provider,
    providerMessageId: messageId,
    errorMessage: sendError,
    dedupKey,
  });

  if (sendError) {
    console.error(`[notifications] Send failed (${provider}): ${sendError}`);
  } else {
    console.log(
      `[notifications] Sent ${type} to ${recipientEmail} via ${provider}`,
    );
  }

  return {
    sent: status === "sent",
    skipped: false,
    provider,
    messageId,
    error: sendError,
  };
}

// ---------------------------------------------------------------------------
// sendAuditReportReadyEmail
// Sends the "your audit is ready" notification to the audit requestor.
// Used by /api/audit/run — does NOT require a tenant_id (prospect audits).
// ---------------------------------------------------------------------------

export interface AuditReportReadyArgs {
  recipientEmail: string;
  recipientName: string | null;
  auditId: string;
  targetDomain: string;
  score: number;
  grade: string;
  opportunities: string[];
  auditUrl: string;
  pdfUrl: string;
  nationalCompetitorNote?: string | null;
  /** Prevent duplicate sends (defaults to 72h window) */
  dedupWindowHours?: number;
}

export async function sendAuditReportReadyEmail(
  args: AuditReportReadyArgs,
): Promise<NotificationResult> {
  const {
    recipientEmail,
    recipientName,
    auditId,
    targetDomain,
    score,
    grade,
    opportunities,
    auditUrl,
    pdfUrl,
    nationalCompetitorNote,
    dedupWindowHours = 72,
  } = args;

  const dedupKey = `audit_report_ready:${auditId}`;

  // Deduplication
  const dupe = await isDuplicate(dedupKey, dedupWindowHours);
  if (dupe) {
    console.log(
      `[notifications] Skipping duplicate audit_report_ready for ${auditId}`,
    );
    return { sent: false, skipped: true, provider: "none", messageId: null };
  }

  // Render template
  const data: NotificationTemplateData = {
    requestorName: recipientName ?? undefined,
    targetDomain,
    auditScore: score,
    auditGrade: grade,
    topOpportunities: opportunities,
    auditUrl,
    pdfUrl,
    nationalCompetitorNote: nationalCompetitorNote ?? undefined,
  };
  const { subject, html } = renderEmailTemplate("audit_report_ready", data);

  // Send
  let provider = "log_only";
  let messageId: string | null = null;
  let sendError: string | undefined;

  if (process.env.RESEND_API_KEY) {
    provider = "resend";
    const result = await sendViaResend({ to: recipientEmail, subject, html });
    messageId = result.messageId;
    sendError = result.error;
  } else if (process.env.SENDGRID_API_KEY) {
    provider = "sendgrid";
    const result = await sendViaSendGrid({ to: recipientEmail, subject, html });
    messageId = result.messageId;
    sendError = result.error;
  } else {
    console.log(
      `[notifications] LOG ONLY — audit_report_ready for ${recipientEmail} auditId=${auditId}`,
    );
    console.log(`  Subject: ${subject}`);
  }

  const status = sendError ? "failed" : "sent";

  // Log
  try {
    const supabase = getAdminClient();
    await supabase.from("notification_log").insert({
      tenant_id: null,
      recipient_email: recipientEmail,
      notification_type: "audit_report_ready",
      subject,
      template_data: data as Record<string, unknown>,
      status,
      provider,
      provider_message_id: messageId,
      error_message: sendError ?? null,
      dedup_key: dedupKey,
    });
  } catch (logErr) {
    console.error("[notifications] Failed to log audit_report_ready:", logErr);
  }

  if (sendError) {
    console.error(
      `[notifications] audit_report_ready send failed (${provider}): ${sendError}`,
    );
  } else {
    console.log(
      `[notifications] Sent audit_report_ready to ${recipientEmail} via ${provider}`,
    );
  }

  return {
    sent: status === "sent",
    skipped: false,
    provider,
    messageId,
    error: sendError,
  };
}
