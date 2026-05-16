/**
 * ReportDispatcher — pushes a completed RunReport to all 3 delivery channels:
 *
 * 1. Supabase `qa` schema (qa_runs table) — persistent dashboard record
 * 2. Resend email to admin — immediate awareness
 * 3. GitHub Actions step summary — CI traceability
 *
 * Decision (Q5): All three, one HTML report, three push targets.
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ReportGenerator } from './ReportGenerator.js'
import { SupabaseAdapter } from '../adaptors/supabase/SupabaseAdapter.js'
import type { RunReport } from '../types.js'

export class ReportDispatcher {
  private readonly generator = new ReportGenerator()
  private readonly db = new SupabaseAdapter()

  async dispatch(report: RunReport, reportDir: string): Promise<void> {
    // Generate HTML once, push to all 3 targets
    const html = this.generator.generate(report)

    // Save HTML to evidence dir
    const htmlPath = path.join(reportDir, 'report.html')
    await fs.mkdir(reportDir, { recursive: true })
    await fs.writeFile(htmlPath, html, 'utf-8')
    console.log(`📄 Report HTML saved: ${htmlPath}`)

    // Dispatch all 3 channels in parallel — failures are logged, not thrown
    const results = await Promise.allSettled([
      this.pushToSupabase(report, html),
      this.sendEmail(report, html),
      this.postGitHubSummary(report),
    ])

    results.forEach((r, i) => {
      const channel = ['Supabase', 'Email', 'GitHub Summary'][i]
      if (r.status === 'rejected') {
        console.warn(`⚠️  ReportDispatcher: ${channel} failed — ${(r.reason as Error).message}`)
      } else {
        console.log(`✅ ReportDispatcher: ${channel} delivered`)
      }
    })
  }

  // ── 1. Supabase `qa` schema ──────────────────────────────────────────────

  private async pushToSupabase(report: RunReport, html: string): Promise<void> {
    await this.db.insert('qa_runs', {
      run_id:        report.runId,
      run_tag:       SupabaseAdapter.buildRunTag(report.runId),
      scenario:      report.scenario,
      mode:          report.mode,
      status:        report.status,
      started_at:    report.startedAt,
      completed_at:  report.completedAt,
      total_steps:   report.totalSteps,
      passed_steps:  report.passedSteps,
      finding_steps: report.findingSteps,
      findings:      JSON.stringify(report.findings),
      report_html:   html,
      critical_step: report.criticalFinding?.stepId ?? null,
    })
  }

  // ── 2. Resend email ──────────────────────────────────────────────────────

  private async sendEmail(report: RunReport, html: string): Promise<void> {
    const resendKey  = process.env.RESEND_API_KEY
    const adminEmail = process.env.QA_ADMIN_EMAIL_NOTIFY
    if (!resendKey || !adminEmail) {
      console.warn('[ReportDispatcher] RESEND_API_KEY or QA_ADMIN_EMAIL_NOTIFY not set — skipping email')
      return
    }

    const emojiMap: Record<string, string> = { pass: '✅', pass_with_findings: '⚠️', error: '❌', critical_halt: '🚨', running: '🔄' }
    const statusEmoji = emojiMap[report.status] ?? '❓'
    const subject = `${statusEmoji} QA Run ${report.status.replace(/_/g, ' ')} — ${report.scenario} (${report.runId.slice(0, 16)})`

    const emailBody = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;padding:24px;max-width:600px">
  <h2>${statusEmoji} QA Agent Run Complete</h2>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:6px 12px;font-weight:bold;background:#f8f8f8">Run ID</td><td style="padding:6px 12px"><code>${report.runId}</code></td></tr>
    <tr><td style="padding:6px 12px;font-weight:bold;background:#f8f8f8">Status</td><td style="padding:6px 12px">${statusEmoji} ${report.status}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:bold;background:#f8f8f8">Scenario</td><td style="padding:6px 12px">${report.scenario}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:bold;background:#f8f8f8">Steps</td><td style="padding:6px 12px">${report.passedSteps}/${report.totalSteps} passed</td></tr>
    <tr><td style="padding:6px 12px;font-weight:bold;background:#f8f8f8">Findings</td><td style="padding:6px 12px">${report.findings.length} (${report.findings.filter(f=>f.severity==='critical').length} critical, ${report.findings.filter(f=>f.severity==='error').length} error, ${report.findings.filter(f=>f.severity==='warning').length} warning)</td></tr>
    <tr><td style="padding:6px 12px;font-weight:bold;background:#f8f8f8">Completed</td><td style="padding:6px 12px">${report.completedAt.slice(0,19).replace('T',' ')} UTC</td></tr>
  </table>
  ${report.criticalFinding ? `
  <div style="background:#fdf2f8;border:2px solid #d946ef;border-radius:8px;padding:16px;margin-top:16px">
    <strong style="color:#701a75">🚨 Critical Halt at step: ${report.criticalFinding.stepId}</strong>
    <p style="color:#701a75;margin-top:8px">${report.criticalFinding.message}</p>
    <p style="color:#a855f7;font-size:12px;margin-top:8px">A GitHub Issue has been opened. The agent will not run again until it is closed.</p>
  </div>` : ''}
  <p style="margin-top:24px;color:#6b7280;font-size:13px">
    View the full report at <strong>/admin/qa-reports</strong> in the RankedCEO CRM dashboard.
  </p>
</body>
</html>`.trim()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'qa-agent@rankedceo.com',
        to: adminEmail,
        subject,
        html: emailBody,
      }),
    })

    if (!res.ok) throw new Error(`Resend API ${res.status}: ${await res.text()}`)
  }

  // ── 3. GitHub Actions summary ────────────────────────────────────────────

  private async postGitHubSummary(report: RunReport): Promise<void> {
    // GitHub Actions injects GITHUB_STEP_SUMMARY env var pointing to a file
    const summaryFile = process.env.GITHUB_STEP_SUMMARY
    if (!summaryFile) {
      console.log('[ReportDispatcher] Not in GitHub Actions — skipping summary')
      return
    }

    const emojiMap2: Record<string, string> = { pass: '✅', pass_with_findings: '⚠️', error: '❌', critical_halt: '🚨', running: '🔄' }
    const statusEmoji = emojiMap2[report.status] ?? '❓'
    const duration = this.formatDuration(report.startedAt, report.completedAt)

    const summary = `
## ${statusEmoji} QA Agent — ${report.scenario}

| Field | Value |
|-------|-------|
| **Run ID** | \`${report.runId}\` |
| **Status** | ${statusEmoji} ${report.status.replace(/_/g, ' ')} |
| **Mode** | ${report.mode} |
| **Steps** | ${report.passedSteps}/${report.totalSteps} passed |
| **Duration** | ${duration} |
| **Findings** | ${report.findings.length} total (${report.findings.filter(f=>f.severity==='critical').length} critical · ${report.findings.filter(f=>f.severity==='error').length} error · ${report.findings.filter(f=>f.severity==='warning').length} warning · ${report.findings.filter(f=>f.severity==='info').length} info) |
| **Completed** | ${report.completedAt.slice(0,19).replace('T',' ')} UTC |

${report.criticalFinding ? `### 🚨 Critical Halt\n**Step:** \`${report.criticalFinding.stepId}\`\n\n> ${report.criticalFinding.message}\n\nA GitHub Issue has been created. The agent will not run again until it is closed.\n` : ''}

${report.findings.length > 0 ? `### Findings\n\n| Step | Persona | Severity | Message |\n|------|---------|----------|---------|
${report.findings.map(f => `| \`${f.stepId}\` | ${f.persona} | ${f.severity.toUpperCase()} | ${f.message.slice(0, 80)}${f.message.length > 80 ? '…' : ''} |`).join('\n')}` : '### ✅ No findings'}
`.trim()

    await fs.appendFile(summaryFile, summary + '\n', 'utf-8')
  }

  private formatDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
  }
}
