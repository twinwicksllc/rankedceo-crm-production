/**
 * ReportGenerator — builds a standalone HTML report from a RunReport.
 *
 * The generated HTML is:
 *   - Self-contained (no external dependencies, inline CSS)
 *   - Offline-viewable (open in any browser without a server)
 *   - Persona-aware (swimlane view: client steps | admin steps)
 *   - Severity-colour-coded (info/warning/error/critical)
 *   - Screenshot-linked (relative paths to evidence/ dir)
 */

import type { RunReport, Finding, Severity } from "../types.js";

const SEVERITY_COLOR: Record<
  Severity,
  { bg: string; border: string; text: string; badge: string }
> = {
  info: { bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1", badge: "#0ea5e9" },
  warning: {
    bg: "#fffbeb",
    border: "#fde68a",
    text: "#92400e",
    badge: "#f59e0b",
  },
  error: {
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#9f1239",
    badge: "#f43f5e",
  },
  critical: {
    bg: "#fdf2f8",
    border: "#f5d0fe",
    text: "#701a75",
    badge: "#d946ef",
  },
};

const STATUS_COLOR: Record<string, string> = {
  pass: "#10b981",
  pass_with_findings: "#f59e0b",
  error: "#f43f5e",
  critical_halt: "#d946ef",
  running: "#6366f1",
};

export class ReportGenerator {
  generate(report: RunReport): string {
    const statusColor = STATUS_COLOR[report.status] ?? "#6b7280";
    const duration = this.formatDuration(report.startedAt, report.completedAt);
    const clientFindings = report.findings.filter(
      (f) => f.persona === "client",
    );
    const adminFindings = report.findings.filter((f) => f.persona === "admin");

    const bySeverity = {
      critical: report.findings.filter((f) => f.severity === "critical"),
      error: report.findings.filter((f) => f.severity === "error"),
      warning: report.findings.filter((f) => f.severity === "warning"),
      info: report.findings.filter((f) => f.severity === "info"),
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QA Report — ${report.runId}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.5; }
    .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    /* Header */
    .header { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px 32px; margin-bottom: 24px; }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .run-title { font-size: 22px; font-weight: 700; color: #f1f5f9; }
    .run-id { font-size: 12px; color: #64748b; font-family: monospace; margin-top: 4px; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-top: 24px; }
    .meta-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 14px 16px; }
    .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 4px; }
    .meta-value { font-size: 18px; font-weight: 700; color: #f1f5f9; }
    .meta-sub { font-size: 11px; color: #64748b; }
    /* Sections */
    .section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    /* Severity summary */
    .severity-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .sev-chip { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; border: 1px solid; }
    .sev-count { font-size: 20px; font-weight: 800; }
    .sev-label { font-size: 12px; font-weight: 500; }
    /* Swimlanes */
    .swimlanes { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 700px) { .swimlanes { grid-template-columns: 1fr; } }
    .lane { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; }
    .lane-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .lane-title.client { color: #818cf8; }
    .lane-title.admin  { color: #34d399; }
    .no-findings { font-size: 12px; color: #475569; padding: 8px 0; }
    /* Finding cards */
    .finding { border-radius: 6px; border: 1px solid; padding: 12px 14px; margin-bottom: 8px; }
    .finding-header { display: flex; align-items: center; gap-8px; justify-content: space-between; margin-bottom: 6px; }
    .finding-step { font-size: 11px; font-family: monospace; font-weight: 600; }
    .finding-time { font-size: 10px; color: #64748b; }
    .finding-msg { font-size: 12px; line-height: 1.5; word-break: break-word; }
    .finding-stack { font-size: 10px; font-family: monospace; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 8px; margin-top: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: #94a3b8; }
    .finding-screenshot { margin-top: 8px; }
    .finding-screenshot a { font-size: 11px; color: #60a5fa; text-decoration: none; }
    .finding-screenshot a:hover { text-decoration: underline; }
    /* Critical halt banner */
    .critical-banner { background: #2d0a3e; border: 2px solid #d946ef; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .critical-banner-title { font-size: 16px; font-weight: 700; color: #f0abfc; margin-bottom: 8px; }
    .critical-banner-body { font-size: 13px; color: #d946ef; }
    /* Footer */
    .footer { text-align: center; font-size: 11px; color: #334155; margin-top: 32px; padding-top: 16px; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="run-title">QA Agent Run Report</div>
        <div class="run-id">Run ID: ${report.runId}</div>
      </div>
      <div class="status-badge">${this.statusEmoji(report.status)} ${report.status.replace(/_/g, " ").toUpperCase()}</div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Scenario</div>
        <div class="meta-value" style="font-size:14px">${this.esc(report.scenario)}</div>
        <div class="meta-sub">${report.mode} mode</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Steps</div>
        <div class="meta-value">${report.passedSteps}<span style="font-size:14px;color:#64748b">/${report.totalSteps}</span></div>
        <div class="meta-sub">passed</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Findings</div>
        <div class="meta-value">${report.findings.length}</div>
        <div class="meta-sub">${report.findingSteps} step(s) with issues</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Duration</div>
        <div class="meta-value">${duration}</div>
        <div class="meta-sub">${report.startedAt.slice(0, 19).replace("T", " ")} UTC</div>
      </div>
    </div>
  </div>

  ${
    report.status === "critical_halt" && report.criticalFinding
      ? `
  <!-- ── Critical Halt Banner ─────────────────────────────────────────── -->
  <div class="critical-banner">
    <div class="critical-banner-title">🚨 Critical Halt — Run stopped at step: ${this.esc(report.criticalFinding.stepId)}</div>
    <div class="critical-banner-body">${this.esc(report.criticalFinding.message)}</div>
    <div style="margin-top:10px;font-size:11px;color:#a855f7">
      A GitHub Issue has been created and an email notification sent to the admin.
      The QA agent will not run again until the issue is closed.
    </div>
  </div>`
      : ""
  }

  <!-- ── Severity Summary ───────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-title">📊 Findings by Severity</div>
    <div class="severity-row">
      ${(["critical", "error", "warning", "info"] as Severity[])
        .map((sev) => {
          const c = SEVERITY_COLOR[sev];
          const count = bySeverity[sev].length;
          return `<div class="sev-chip" style="background:${c.bg};border-color:${c.border}">
          <div class="sev-count" style="color:${c.badge}">${count}</div>
          <div class="sev-label" style="color:${c.text}">${sev.toUpperCase()}</div>
        </div>`;
        })
        .join("")}
    </div>
  </div>

  <!-- ── Persona Swimlanes ──────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-title">👥 Findings by Persona</div>
    <div class="swimlanes">
      <div class="lane">
        <div class="lane-title client">🧑 Client (${clientFindings.length} finding${clientFindings.length !== 1 ? "s" : ""})</div>
        ${
          clientFindings.length === 0
            ? '<div class="no-findings">✅ No findings</div>'
            : clientFindings.map((f) => this.renderFinding(f)).join("")
        }
      </div>
      <div class="lane">
        <div class="lane-title admin">🛡️ Admin (${adminFindings.length} finding${adminFindings.length !== 1 ? "s" : ""})</div>
        ${
          adminFindings.length === 0
            ? '<div class="no-findings">✅ No findings</div>'
            : adminFindings.map((f) => this.renderFinding(f)).join("")
        }
      </div>
    </div>
  </div>

  ${
    report.findings.length > 0
      ? `
  <!-- ── All Findings ───────────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-title">🔍 All Findings (${report.findings.length})</div>
    ${report.findings.map((f) => this.renderFinding(f, true)).join("")}
  </div>`
      : ""
  }

  <div class="footer">
    Generated by RankedCEO QA Agent · Run ${this.esc(report.runId)} · ${report.completedAt.slice(0, 19).replace("T", " ")} UTC
  </div>

</div>
</body>
</html>`;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private renderFinding(f: Finding, showPersona = false): string {
    const c = SEVERITY_COLOR[f.severity];
    return `
    <div class="finding" style="background:${c.bg};border-color:${c.border}">
      <div class="finding-header">
        <span class="finding-step" style="color:${c.text}">${showPersona ? `[${f.persona}] ` : ""}${this.esc(f.stepId)}</span>
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${c.badge}22;color:${c.badge}">${f.severity.toUpperCase()}</span>
      </div>
      <div class="finding-time" style="margin-bottom:4px">${f.timestamp.slice(0, 19).replace("T", " ")} UTC</div>
      <div class="finding-msg" style="color:${c.text}">${this.esc(f.message)}</div>
      ${f.stack ? `<div class="finding-stack">${this.esc(f.stack.slice(0, 800))}</div>` : ""}
      ${f.screenshotPath ? `<div class="finding-screenshot">📸 <a href="${this.esc(f.screenshotPath)}" target="_blank">View screenshot</a></div>` : ""}
    </div>`;
  }

  private statusEmoji(status: string): string {
    const map: Record<string, string> = {
      pass: "✅",
      pass_with_findings: "⚠️",
      error: "❌",
      critical_halt: "🚨",
      running: "🔄",
    };
    return map[status] ?? "❓";
  }

  private formatDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
