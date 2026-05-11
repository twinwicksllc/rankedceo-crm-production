/**
 * EscalationEngine — enforces the severity taxonomy.
 *
 * info     → log, continue
 * warning  → log, continue
 * error    → record finding, continue
 * critical → record finding, halt run, fire notifications
 *
 * On critical halt:
 *   1. Sends email via Resend
 *   2. Creates GitHub Issue with label `qa-critical-halt`
 *   3. Throws CriticalHaltError to stop the orchestrator
 *
 * Before starting a run, checks GitHub for any open `qa-critical-halt` issues
 * and refuses to run if one exists (restart gate).
 *
 * v1.5 self-healing hook: the GitHub Issue body contains a structured
 * JSON payload that the LLM can read to attempt a fix.
 */

import type { Finding, Severity, RunConfig } from '../types.js'

export class CriticalHaltError extends Error {
  constructor(
    public readonly finding: Finding,
    public readonly runId: string,
  ) {
    super(`[CRITICAL HALT] ${finding.message}`)
    this.name = 'CriticalHaltError'
  }
}

export class RestartGateError extends Error {
  constructor(public readonly issueNumber: number, public readonly issueUrl: string) {
    super(
      `QA agent blocked: open critical-halt issue #${issueNumber} must be closed before running.\n` +
        `Issue: ${issueUrl}`,
    )
    this.name = 'RestartGateError'
  }
}

export class EscalationEngine {
  private findings: Finding[] = []

  constructor(
    private readonly config: RunConfig,
    private readonly evidenceDir: string,
  ) {}

  /**
   * Check GitHub for open `qa-critical-halt` issues.
   * Must be called before the run starts.
   */
  async checkRestartGate(): Promise<void> {
    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPO ?? 'twinwicksllc/rankedceo-crm-production'
    if (!token) {
      console.warn('[EscalationEngine] GITHUB_TOKEN not set — skipping restart gate check')
      return
    }

    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues?labels=qa-critical-halt&state=open`,
      { headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } },
    )

    if (!res.ok) {
      console.warn(`[EscalationEngine] GitHub API returned ${res.status} — skipping gate check`)
      return
    }

    const issues = (await res.json()) as Array<{ number: number; html_url: string }>
    if (issues.length > 0) {
      throw new RestartGateError(issues[0].number, issues[0].html_url)
    }
  }

  /**
   * Record a finding. If critical, fires notifications and throws CriticalHaltError.
   */
  async record(finding: Finding): Promise<void> {
    this.findings.push(finding)

    const prefix = this.severityPrefix(finding.severity)
    console.log(`${prefix} [${finding.persona}] ${finding.stepId}: ${finding.message}`)

    if (finding.severity === 'critical') {
      await this.fireCriticalNotifications(finding)
      throw new CriticalHaltError(finding, this.config.runId)
    }
  }

  getFindings(): Finding[] {
    return [...this.findings]
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private severityPrefix(severity: Severity): string {
    switch (severity) {
      case 'info':    return '  ℹ️ '
      case 'warning': return '  ⚠️ '
      case 'error':   return '  ❌'
      case 'critical':return '  🚨'
    }
  }

  private async fireCriticalNotifications(finding: Finding): Promise<void> {
    console.error('🚨 CRITICAL HALT — firing notifications...')
    await Promise.allSettled([
      this.sendCriticalEmail(finding),
      this.createGitHubIssue(finding),
    ])
  }

  private async sendCriticalEmail(finding: Finding): Promise<void> {
    const resendKey = process.env.RESEND_API_KEY
    const adminEmail = process.env.QA_ADMIN_EMAIL
    if (!resendKey || !adminEmail) {
      console.warn('[EscalationEngine] RESEND_API_KEY or QA_ADMIN_EMAIL not set — skipping email')
      return
    }

    const body = {
      from: 'qa-agent@rankedceo.com',
      to: adminEmail,
      subject: `🚨 QA Agent Critical Halt — Run ${this.config.runId}`,
      html: this.buildCriticalEmailHtml(finding),
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error(`[EscalationEngine] Resend API error: ${res.status}`)
    } else {
      console.log('[EscalationEngine] Critical halt email sent.')
    }
  }

  private async createGitHubIssue(finding: Finding): Promise<void> {
    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPO ?? 'twinwicksllc/rankedceo-crm-production'
    if (!token) {
      console.warn('[EscalationEngine] GITHUB_TOKEN not set — skipping GitHub Issue creation')
      return
    }

    /**
     * v1.5 self-healing hook:
     * The structured JSON payload at the bottom of the issue body is what
     * the LLM will read in v1.5 to understand the failure context and
     * attempt a self-heal. The interface is designed now; the LLM is wired later.
     */
    const selfHealPayload = {
      runId: this.config.runId,
      stepId: finding.stepId,
      persona: finding.persona,
      message: finding.message,
      scenarioPath: this.config.scenarioPath,
      evidenceDir: this.evidenceDir,
      screenshotPath: finding.screenshotPath ?? null,
      stack: finding.stack ?? null,
      // v1.5: LLM reads this and attempts to fix the selector / flow
      selfHealHook: 'NOT_WIRED_YET',
    }

    const issueBody = `
## 🚨 QA Agent Critical Halt

**Run ID:** \`${this.config.runId}\`
**Mode:** \`${this.config.mode}\`
**Scenario:** \`${this.config.scenarioPath}\`
**Step:** \`${finding.stepId}\`
**Persona:** \`${finding.persona}\`
**Timestamp:** ${finding.timestamp}

### Error Message
\`\`\`
${finding.message}
\`\`\`

${finding.stack ? `### Stack Trace\n\`\`\`\n${finding.stack}\n\`\`\`\n` : ''}

### What to do
1. Review the error above and the screenshot in the evidence vault
2. Fix the issue in the app or the test scenario
3. **Close this issue** — the QA agent will not run again until this issue is closed
4. Re-trigger the weekly run or push a PR to run the smoke suite

---

### Self-Healing Payload (v1.5)
> *This block is used by the LLM self-healing layer in v1.5. Do not edit manually.*

\`\`\`json
${JSON.stringify(selfHealPayload, null, 2)}
\`\`\`
`.trim()

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `🚨 QA Critical Halt — ${finding.stepId} (run ${this.config.runId})`,
        body: issueBody,
        labels: ['qa-critical-halt'],
      }),
    })

    if (!res.ok) {
      console.error(`[EscalationEngine] GitHub issue creation failed: ${res.status}`)
    } else {
      const issue = (await res.json()) as { number: number; html_url: string }
      console.log(`[EscalationEngine] GitHub Issue #${issue.number} created: ${issue.html_url}`)
    }
  }

  private buildCriticalEmailHtml(finding: Finding): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #1a1a1a; padding: 24px;">
  <h2 style="color: #dc2626;">🚨 QA Agent Critical Halt</h2>
  <table style="border-collapse: collapse; width: 100%;">
    <tr><td style="padding: 6px 12px; font-weight: bold;">Run ID</td><td style="padding: 6px 12px;"><code>${this.config.runId}</code></td></tr>
    <tr><td style="padding: 6px 12px; font-weight: bold;">Mode</td><td style="padding: 6px 12px;">${this.config.mode}</td></tr>
    <tr><td style="padding: 6px 12px; font-weight: bold;">Step</td><td style="padding: 6px 12px;"><code>${finding.stepId}</code></td></tr>
    <tr><td style="padding: 6px 12px; font-weight: bold;">Persona</td><td style="padding: 6px 12px;">${finding.persona}</td></tr>
    <tr><td style="padding: 6px 12px; font-weight: bold;">Timestamp</td><td style="padding: 6px 12px;">${finding.timestamp}</td></tr>
  </table>
  <h3>Error</h3>
  <pre style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 4px;">${finding.message}</pre>
  ${finding.stack ? `<h3>Stack</h3><pre style="background: #f8f8f8; padding: 12px; border-radius: 4px; font-size: 12px;">${finding.stack}</pre>` : ''}
  <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
    The QA agent will not run again until the corresponding GitHub Issue is closed.<br/>
    Check <code>/admin/qa-reports</code> for the full run report.
  </p>
</body>
</html>
    `.trim()
  }
}
