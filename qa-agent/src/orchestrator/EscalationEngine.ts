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
import { relocate } from '../self-healing/llm-relocate.js'

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
    const restartGateEnv = process.env.QA_RESTART_GATE?.trim().toLowerCase()
    const restartGateOverride =
      restartGateEnv === 'true' ? true : restartGateEnv === 'false' ? false : undefined

    if (restartGateEnv && restartGateOverride === undefined) {
      console.warn(
        `[EscalationEngine] QA_RESTART_GATE=${process.env.QA_RESTART_GATE} is invalid; expected "true" or "false". Falling back to mode default.`,
      )
    }

    // Default behavior: enforce restart gate for full runs, skip for smoke runs.
    const shouldCheckRestartGate = restartGateOverride ?? this.config.mode === 'full'
    if (!shouldCheckRestartGate) {
      console.log('[EscalationEngine] Restart gate disabled for smoke run.')
      return
    }

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
    const [, issueResult] = await Promise.allSettled([
      this.sendCriticalEmail(finding),
      this.createGitHubIssue(finding),
    ])

    // v1.5 self-healing hook — log prompt in v1, call LLM in v1.5
    // The GitHub Issue body contains the selfHealPayload JSON block.
    // In v1: relocate() logs the prompt and returns null.
    // In v1.5: set SELF_HEAL_PROVIDER=openai|anthropic + API key to activate.
    if (issueResult.status === 'fulfilled' && typeof issueResult.value === 'string') {
      const issueBody = issueResult.value
      try {
        const provider = (process.env.SELF_HEAL_PROVIDER ?? 'stub') as 'stub' | 'openai' | 'anthropic'
        const proposal = await relocate(issueBody, {
          provider,
          model: process.env.SELF_HEAL_MODEL,
          apiKey: provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY,
          minConfidence: parseFloat(process.env.SELF_HEAL_MIN_CONFIDENCE ?? '0.7'),
        })
        if (proposal?.canFix) {
          console.log(`[EscalationEngine] 🔧 Self-heal proposal (confidence: ${proposal.confidence}):`)
          console.log(`  Proposed selector: ${proposal.proposedSelector ?? proposal.proposedPattern}`)
          console.log(`  Reasoning: ${proposal.reasoning}`)
        }
      } catch (err) {
        console.warn('[EscalationEngine] Self-healing hook error (non-fatal):', err)
      }
    } else {
      console.log('[EscalationEngine] v1.5 self-healing hook ready — see qa-agent/src/self-healing/llm-relocate.ts')
    }
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

  private async createGitHubIssue(finding: Finding): Promise<string | null> {
    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPO ?? 'twinwicksllc/rankedceo-crm-production'
    if (!token) {
      console.warn('[EscalationEngine] GITHUB_TOKEN not set — skipping GitHub Issue creation')
      return null
    }

    /**
     * SelfHealPayload — structured JSON embedded in the issue body.
     * In v1.5, llm-relocate.ts reads this block via the HTML comment markers
     * and sends it to the LLM to attempt a selector fix.
     */
    const selfHealPayload = {
      runId: this.config.runId,
      scenario: this.config.scenarioPath,
      stepId: finding.stepId,
      persona: finding.persona,
      stepType: 'unknown', // populated from step metadata when StepExecutor passes it through in v1.5
      failedSelector: undefined as string | undefined,  // populated in v1.5 when StepExecutor passes selector through
      failedPattern: undefined as string | undefined,   // populated in v1.5 for assert_url failures
      intent: '(intent not yet passed through to EscalationEngine — v1.5 wires this from the step)',
      errorMessage: finding.message,
      failedAt: finding.timestamp,
      screenshotPath: finding.screenshotPath ?? null,
      domSnippet: null, // populated in v1.5 when StepExecutor captures DOM at failure point
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
> *This block is read by \`qa-agent/src/self-healing/llm-relocate.ts\` in v1.5.*
> *To activate: set SELF_HEAL_PROVIDER=openai and OPENAI_API_KEY. See docs/qa-agent/self-healing.md*

<!-- SELF_HEAL_PAYLOAD_START -->
\`\`\`json
${JSON.stringify(selfHealPayload, null, 2)}
\`\`\`
<!-- SELF_HEAL_PAYLOAD_END -->
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
      return null
    } else {
      const issue = (await res.json()) as { number: number; html_url: string }
      console.log(`[EscalationEngine] GitHub Issue #${issue.number} created: ${issue.html_url}`)
      // Return the issue body so the self-healing hook can extract the payload
      return issueBody
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
