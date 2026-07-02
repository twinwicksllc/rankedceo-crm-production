// lib/waas/services/email-templates/billing.ts

import { wrapLayout } from "./layout";
import type { NotificationTemplateData } from "./types";

// ---------------------------------------------------------------------------
// Template: subscription_activated  (Phase 8.3)
// ---------------------------------------------------------------------------

export function subscriptionActivated(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.businessName ?? "Your business";
  const planLabel = data.planLabel ?? "your plan";
  const interval = data.planInterval ?? "";
  const price = data.planPrice ?? "";
  const portalUrl = data.portalUrl ?? "#";

  const subject = `✅ Your ${planLabel} plan is now active — welcome aboard!`;

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Payment confirmed ✅
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Thank you! Your <strong>${planLabel}</strong> subscription for
      <strong>${name}</strong> is now active${interval ? ` on ${interval} billing` : ""}.
      ${price ? `You'll be billed <strong>${price}</strong>.` : ""}
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">
            Your active plan
          </p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#15803d;">${planLabel}</p>
          ${interval ? `<p style="margin:4px 0 0;font-size:13px;color:#166534;">${interval} billing${price ? ` · ${price}` : ""}</p>` : ""}
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 8px;font-size:13px;color:#475569;line-height:1.6;">
      You can manage your subscription, update your payment method, or view invoices at any time from your portal.
    </p>

    <div style="margin-top:16px;text-align:center;">
      <a href="${portalUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Manage Billing →
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapLayout(
      content,
      `Your ${planLabel} plan is active — all features are now unlocked.`,
    ),
  };
}

// ---------------------------------------------------------------------------
// Template: payment_failed  (Phase 8.3)
// ---------------------------------------------------------------------------

export function paymentFailed(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.businessName ?? "Your business";
  const planLabel = data.planLabel ?? "your plan";
  const portalUrl = data.portalUrl ?? "#";

  const subject = `⚠️ Payment issue with your ${planLabel} plan — action required`;

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Payment failed ⚠️
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      We were unable to process your payment for the <strong>${planLabel}</strong> plan
      on <strong>${name}</strong>. Please update your payment method as soon as possible
      to avoid any interruption to your service.
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">
            Action required
          </p>
          <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">
            Update your payment method to keep your <strong>${planLabel}</strong> plan active.
            If payment isn't resolved within a few days, your plan may be downgraded.
          </p>
        </td>
      </tr>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="${portalUrl}"
         style="display:inline-block;background:#dc2626;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Update Payment Method →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
      Need help? Reply to this email or contact support@rankedceo.com
    </p>
  `;

  return {
    subject,
    html: wrapLayout(
      content,
      `Action needed: payment failed for your ${planLabel} plan.`,
    ),
  };
}

// ---------------------------------------------------------------------------
// Template: plan_changed  (Phase 8.3)
// ---------------------------------------------------------------------------

export function planChanged(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.businessName ?? "Your business";
  const oldPlan = data.oldPlanLabel ?? "your previous plan";
  const newPlan = data.newPlanLabel ?? "your new plan";
  const interval = data.planInterval ?? "";
  const price = data.planPrice ?? "";
  const portalUrl = data.portalUrl ?? "#";

  // Determine direction
  const planOrder: Record<string, number> = {
    hosting: 0,
    hosting_only: 1,
    standard: 2,
    premium: 3,
  };
  const oldRank = planOrder[oldPlan.toLowerCase()] ?? 0;
  const newRank = planOrder[newPlan.toLowerCase()] ?? 0;
  const isUpgrade = newRank >= oldRank;

  const emoji = isUpgrade ? "🚀" : "📝";
  const verb = isUpgrade ? "upgraded" : "updated";
  const subject = `${emoji} Your plan has been ${verb} to ${newPlan}`;

  const accentColor = isUpgrade ? "#2563eb" : "#64748b";
  const bgColor = isUpgrade ? "#eff6ff" : "#f8fafc";
  const borderColor = isUpgrade ? "#93c5fd" : "#e2e8f0";
  const textColor = isUpgrade ? "#1d4ed8" : "#334155";

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Your plan has been ${verb} ${emoji}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      The plan for <strong>${name}</strong> has changed from
      <strong>${oldPlan}</strong> to <strong>${newPlan}</strong>.
      ${interval ? `You are now on ${interval} billing.` : ""}
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.5px;">
            Your new plan
          </p>
          <p style="margin:0;font-size:18px;font-weight:700;color:${textColor};">${newPlan}</p>
          ${interval ? `<p style="margin:4px 0 0;font-size:13px;color:${textColor};">${interval} billing${price ? ` · ${price}` : ""}</p>` : ""}
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 8px;font-size:13px;color:#475569;line-height:1.6;">
      Your new plan features are effective immediately. View your invoices or manage
      your subscription in the billing portal.
    </p>

    <div style="margin-top:16px;text-align:center;">
      <a href="${portalUrl}"
         style="display:inline-block;background:${accentColor};color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        View Billing Details →
      </a>
    </div>
  `;

  return { subject, html: wrapLayout(content) };
}
