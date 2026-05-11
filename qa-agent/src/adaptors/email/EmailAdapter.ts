/**
 * EmailAdapter — verifies transactional email delivery via Resend's logs API.
 *
 * Decision (Q4):
 *   - Smoke tests: skip email verification entirely
 *   - Weekly full run: Resend test mode — agent verifies delivery via Resend logs API
 *
 * In test mode, Resend logs emails without delivering them to real inboxes.
 * The adapter polls the Resend logs API to confirm the email was logged.
 */

export type EmailAdapterMode = 'resend_test' | 'skip'

export interface EmailVerification {
  to: string
  subjectContains: string
  /** How long to wait for the email to appear in Resend logs */
  timeoutMs?: number
}

export class EmailAdapter {
  constructor(private readonly mode: EmailAdapterMode) {}

  /**
   * Verify that an email was sent.
   * In skip mode, always resolves immediately (passes).
   * In resend_test mode, polls Resend logs API.
   */
  async verifyEmailSent(verification: EmailVerification): Promise<void> {
    if (this.mode === 'skip') {
      console.log(`  [EmailAdapter] Skip mode — not verifying email to ${verification.to}`)
      return
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY not set — cannot verify email delivery')

    const { to, subjectContains, timeoutMs = 30_000 } = verification
    const deadline = Date.now() + timeoutMs
    const pollIntervalMs = 2_000

    console.log(`  [EmailAdapter] Polling Resend logs for email to ${to} (subject: "${subjectContains}")...`)

    while (Date.now() < deadline) {
      const found = await this.pollResendLogs(apiKey, to, subjectContains)
      if (found) {
        console.log(`  [EmailAdapter] ✅ Email confirmed in Resend logs.`)
        return
      }
      await new Promise(res => setTimeout(res, pollIntervalMs))
    }

    throw new Error(
      `EmailAdapter: email to "${to}" with subject containing "${subjectContains}" not found in Resend logs after ${timeoutMs}ms`
    )
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async pollResendLogs(apiKey: string, to: string, subjectContains: string): Promise<boolean> {
    const res = await fetch('https://api.resend.com/emails?limit=20', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      console.warn(`  [EmailAdapter] Resend API ${res.status} — will retry`)
      return false
    }

    const data = (await res.json()) as { data: Array<{ to: string[]; subject: string }> }
    return data.data.some(
      email =>
        email.to.includes(to) &&
        email.subject.toLowerCase().includes(subjectContains.toLowerCase()),
    )
  }
}
