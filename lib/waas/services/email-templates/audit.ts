// lib/waas/services/email-templates/audit.ts
//
// Audit report ready — sent to the prospect/requestor when their SEO audit
// finishes processing. Includes score, grade, top 3 opportunities, and a
// deep link back to the full interactive report.

import type { NotificationTemplateData } from "./types";
import { wrapLayout } from "./layout";

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#16a34a"; // green-600
    case "B":
      return "#2563eb"; // blue-600
    case "C":
      return "#d97706"; // amber-600
    case "D":
      return "#ea580c"; // orange-600
    default:
      return "#dc2626"; // red-600 (F)
  }
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Great — you're ahead of most local competitors.";
  if (score >= 65)
    return "Good foundation — a few key improvements could move the needle.";
  if (score >= 50)
    return "Average — there are real opportunities being left on the table.";
  if (score >= 35)
    return "Below average — competitors are likely outranking you right now.";
  return "Critical — your site is missing out on significant organic traffic.";
}

export function auditReportReady(data: NotificationTemplateData): {
  subject: string;
  html: string;
} {
  const name = data.requestorName
    ? `, ${data.requestorName.split(" ")[0]}`
    : "";
  const domain = data.targetDomain ?? "your site";
  const score = data.auditScore ?? 0;
  const grade = data.auditGrade ?? "F";
  const opportunities = data.topOpportunities ?? [];
  const auditUrl = data.auditUrl ?? "#";
  const pdfUrl = data.pdfUrl ?? "#";
  const gColor = gradeColor(grade);
  const nationalCompetitorNote = data.nationalCompetitorNote;

  const subject = `Your SEO audit for ${domain} is ready 📊`;

  const opportunityRows = opportunities
    .slice(0, 3)
    .map(
      (opp, i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
          <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${i === 0 ? "#fee2e2" : i === 1 ? "#fef3c7" : "#dbeafe"};color:${i === 0 ? "#dc2626" : i === 1 ? "#d97706" : "#2563eb"};font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:10px;">
            ${i + 1}
          </span>
        </td>
        <td style="padding:10px 0 10px 4px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;line-height:1.5;">
          ${opp}
        </td>
      </tr>
    `,
    )
    .join("");

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">
      Your audit is ready${name}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
      We've finished analysing <strong>${domain}</strong> against your competitors.
    </p>

    <!-- Score card -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:0 0 24px;display:flex;align-items:center;gap:20px;">
      <div style="display:inline-block;">
        <div style="width:72px;height:72px;border-radius:50%;border:4px solid ${gColor};display:flex;align-items:center;justify-content:center;background:#ffffff;text-align:center;line-height:64px;">
          <span style="font-size:28px;font-weight:800;color:${gColor};display:block;line-height:64px;width:64px;text-align:center;">${grade}</span>
        </div>
      </div>
      <div>
        <div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1;">${score}<span style="font-size:16px;font-weight:600;color:#94a3b8;">/100</span></div>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">Overall SEO Score</div>
        <div style="font-size:12px;color:${gColor};font-weight:600;margin-top:4px;">${scoreLabel(score)}</div>
      </div>
    </div>

    ${
      opportunities.length > 0
        ? `
    <!-- Opportunities -->
    <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0f172a;">
      Top ${Math.min(opportunities.length, 3)} opportunities we found:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${opportunityRows}
    </table>
    `
        : ""
    }

    ${
      nationalCompetitorNote
        ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin:0 0 24px;">
      <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
        🌍 ${nationalCompetitorNote}
      </p>
    </div>
    `
        : ""
    }

    <!-- Primary CTA -->
    <div style="text-align:center;margin:0 0 16px;">
      <a href="${auditUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.2px;">
        View Full Report →
      </a>
    </div>

    <!-- Secondary CTA -->
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${pdfUrl}"
         style="display:inline-block;color:#2563eb;font-size:13px;font-weight:600;text-decoration:none;border:1px solid #bfdbfe;padding:9px 22px;border-radius:8px;">
        📄 Download PDF Report
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      Your interactive report is live for 30 days. After that, run a fresh audit to get updated data.
    </p>
  `;

  return {
    subject,
    html: wrapLayout(
      content,
      `Your ${domain} SEO audit scored ${score}/100 — view your full report`,
    ),
  };
}
