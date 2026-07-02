// lib/waas/services/email-templates/lifecycle.ts

import { wrapLayout } from "./layout";
import type { NotificationTemplateData } from "./types";

// ---------------------------------------------------------------------------
// Template: site_ready_for_review
// ---------------------------------------------------------------------------

export function siteReadyForReview(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.businessName ?? "Your business";
  const reviewUrl = data.reviewUrl ?? "#";

  const subject = `Your ${name} website designs are ready to review 🎨`;

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Your designs are ready! 🎨
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi there, great news — we've created <strong>3 website designs</strong>
      for <strong>${name}</strong>. Log in to review them, pick your favourite,
      and make any final edits before we go live.
    </p>

    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
            What to do next
          </p>
          <ol style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.8;">
            <li>View your 3 website designs</li>
            <li>Pick the design you like best</li>
            <li>Customise text, images, and colours</li>
            <li>Click <strong>Approve &amp; Publish</strong></li>
          </ol>
        </td>
      </tr>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="${reviewUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;
                text-decoration:none;padding:12px 28px;border-radius:8px;">
        Review My Designs →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
      This link is unique to you — don't share it with others.
    </p>
  `;

  return {
    subject,
    html: wrapLayout(
      content,
      "Your 3 website designs are ready — click to review and approve.",
    ),
  };
}

// ---------------------------------------------------------------------------
// Template: domain_status_update
// ---------------------------------------------------------------------------

export function domainStatusUpdate(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const domain = data.domain ?? "your domain";
  const domainStatus = data.domainStatus ?? "under review";
  const adminNotes = data.adminNotes;

  const subject = `Update on your domain: ${domain}`;

  const statusDescriptions: Record<string, string> = {
    under_review: "Our team is currently reviewing your domain request.",
    provisioning:
      "We're provisioning your domain — this usually takes 24–48 hours.",
    live: "Your domain is live and connected to your website!",
    rejected: "Unfortunately, we weren't able to fulfil this domain request.",
  };

  const description =
    statusDescriptions[domainStatus] ??
    "There's an update on your domain request.";

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      Domain update: <span style="font-family:monospace;">${domain}</span>
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      ${description}
    </p>

    ${
      adminNotes
        ? `
    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f8fafc;border-left:3px solid #2563eb;padding:12px 16px;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:13px;color:#334155;font-style:italic;">${adminNotes}</p>
        </td>
      </tr>
    </table>
    `
        : ""
    }

    <p style="margin:20px 0 0;font-size:13px;color:#475569;">
      Questions? Reply to this email and we'll be happy to help.
    </p>
  `;

  return { subject, html: wrapLayout(content) };
}

// ---------------------------------------------------------------------------
// Template: site_live
// ---------------------------------------------------------------------------

export function siteLive(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.businessName ?? "Your business";
  const domain = data.domain;

  const subject = `🎉 Your ${name} website is live!`;

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
      🎉 Your website is live!
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Congratulations — <strong>${name}</strong> is now live and ready for customers!
    </p>

    ${
      domain
        ? `
    <table role="presentation" width="100%">
      <tr>
        <td style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#16a34a;text-transform:uppercase;">
            Your website
          </p>
          <a href="https://${domain}"
             style="font-size:17px;font-weight:700;color:#15803d;text-decoration:none;font-family:monospace;">
            ${domain}
          </a>
        </td>
      </tr>
    </table>
    `
        : ""
    }

    <p style="margin:20px 0 0;font-size:13px;color:#475569;line-height:1.6;">
      Share your new website with your customers, add it to your Google Business
      Profile, and start getting more enquiries online.
    </p>
  `;

  return {
    subject,
    html: wrapLayout(content, `${name} is now live — see your new website!`),
  };
}
