// lib/waas/services/email-templates/leads.ts
//
// Template: tenant_lead_received. Sent to the business owner when a visitor
// uses the contact form on their website.
//
// Every lead field is typed by an anonymous visitor, so each one is escaped
// before it goes into the HTML. (The other templates interpolate trusted
// values and do not escape.)

import { wrapLayout } from "./layout";
import type { NotificationTemplateData } from "./types";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, valueHtml: string): string {
  return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;">${label}</p>
          <p style="margin:0;font-size:14px;color:#0f172a;line-height:1.5;">${valueHtml}</p>
        </td>
      </tr>`;
}

export function tenantLeadReceived(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const business = escapeHtml(data.businessName ?? "your business");
  const name = escapeHtml(data.leadName ?? "Someone");
  const email = data.leadEmail ? escapeHtml(data.leadEmail) : null;
  const phone = data.leadPhone ? escapeHtml(data.leadPhone) : null;
  const message = data.leadMessage
    ? escapeHtml(data.leadMessage).replace(/\n/g, "<br />")
    : null;
  const service = data.leadService ? escapeHtml(data.leadService) : null;
  const page = data.leadPageUrl ? escapeHtml(data.leadPageUrl) : null;

  // Header-safe: no line breaks, and visitor text cannot add recipients.
  const subjectName = (data.leadName ?? "Someone").replace(/[\r\n]+/g, " ").slice(0, 60);
  const subject = `New lead from your website: ${subjectName}`;

  const rows = [
    email
      ? row("Email", `<a href="mailto:${email}" style="color:#2563eb;">${email}</a>`)
      : "",
    phone ? row("Phone", phone) : "",
    service ? row("Service", service) : "",
    message ? row("Message", message) : "",
    page ? row("Sent from", page) : "",
  ].join("");

  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">
      New lead for ${business}
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      <strong>${name}</strong> just sent a message through the contact form on your website.
      Reply soon: leads contacted within the hour are far more likely to book.
    </p>
    <table role="presentation" width="100%">${rows}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#475569;">
      You can also see every lead in your RankedCEO portal under the Leads tab.
    </p>
  `;

  // The preview text is inserted into the HTML by wrapLayout, so escape it too.
  return {
    subject,
    html: wrapLayout(content, `New lead: ${escapeHtml(subjectName)}`),
  };
}
