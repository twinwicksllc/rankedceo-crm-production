// lib/waas/services/email-templates/onboarding.ts
//
// Onboarding-related email templates for tenant creation and account setup

import type { NotificationTemplateData } from "./types";
import { wrapLayout } from "./layout";

export function onboardingStarted(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.requestorName
    ? `, ${data.requestorName.split(" ")[0]}`
    : "";
  const businessName = data.businessName ?? "your business";
  const reviewUrl = data.reviewUrl ?? "#";

  const subject = `Let's build your website${name}`;

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
      Your account is ready${name}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
      We've created your account and you're ready to start building your website. Let's get started with some quick questions about ${businessName}.
    </p>

    <!-- Info box -->
    <div style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#0c4a6e;">
        <strong>💡 What to expect:</strong> We'll walk you through 5 quick steps to gather your brand info, then build a custom website in seconds. No design experience needed.
      </p>
    </div>

    <!-- Primary CTA -->
    <div style="text-align:center;margin:0 0 16px;">
      <a href="${reviewUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.2px;">
        Start Building →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      This link expires in 30 days. You can always log back in to continue building anytime.
    </p>
  `;

  return {
    subject,
    html: wrapLayout(content, "Your account is ready — let's build your website"),
  };
}

export function accountCreated(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.requestorName
    ? `, ${data.requestorName.split(" ")[0]}`
    : "";
  const reviewUrl = data.reviewUrl ?? "#";

  const subject = `Welcome to RankedCEO${name}`;

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
      Welcome${name}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
      We've created your RankedCEO account. Click below to sign in and complete your setup.
    </p>

    <!-- Primary CTA -->
    <div style="text-align:center;margin:0 0 16px;">
      <a href="${reviewUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.2px;">
        Sign In →
      </a>
    </div>

    <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;text-align:center;">
      Prefer Google? You'll see that option on the next screen.
    </p>
  `;

  return {
    subject,
    html: wrapLayout(content, "Your RankedCEO account is ready"),
  };
}
