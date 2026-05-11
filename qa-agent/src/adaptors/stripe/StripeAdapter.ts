/**
 * StripeAdapter — handles billing interactions for the QA agent.
 *
 * Decision (Q3):
 *   - Smoke tests: mock mode (instant, no webhook round-trip)
 *   - Weekly full run: Stripe test mode with real card 4242 4242 4242 4242
 *
 * The adapter exposes a single `fillCheckoutForm` method that either:
 *   a) Fills the real Stripe Elements iframe with test card details (test mode)
 *   b) Immediately resolves without doing anything (mock mode)
 */

import type { Page } from '@playwright/test'

export type StripeAdapterMode = 'test' | 'mock'

export class StripeAdapter {
  constructor(private readonly mode: StripeAdapterMode) {}

  /**
   * Fill the Stripe checkout form on the given page.
   * In mock mode, this is a no-op — the billing server action is expected
   * to be bypassed at the API level when QA_BILLING_MOCK=true.
   */
  async fillCheckoutForm(page: Page): Promise<void> {
    if (this.mode === 'mock') {
      console.log('  [StripeAdapter] Mock mode — skipping real card entry')
      return
    }

    // Real Stripe Elements test card: 4242 4242 4242 4242
    // Stripe renders card fields inside iframes — we must frameLocator to reach them.
    console.log('  [StripeAdapter] Filling Stripe test card 4242...')

    const cardFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first()

    // Card number
    await cardFrame.locator('[placeholder*="Card number"]').fill('4242 4242 4242 4242')
    // Expiry
    await cardFrame.locator('[placeholder*="MM / YY"]').fill('12 / 30')
    // CVC
    await cardFrame.locator('[placeholder*="CVC"]').fill('123')
    // ZIP (if shown)
    try {
      await cardFrame.locator('[placeholder*="ZIP"]').fill('94102', { timeout: 3_000 })
    } catch {
      // ZIP field not always present
    }

    console.log('  [StripeAdapter] Card details filled.')
  }

  /**
   * Wait for the post-checkout webhook to update the DB.
   * Only relevant in test mode. In mock mode this is a no-op.
   */
  async waitForWebhook(timeoutMs = 60_000): Promise<void> {
    if (this.mode === 'mock') return
    console.log(`  [StripeAdapter] Waiting up to ${timeoutMs}ms for Stripe webhook...`)
    await new Promise(res => setTimeout(res, Math.min(timeoutMs, 5_000)))
    // The calling step's assert_db will verify the DB update arrived.
    console.log('  [StripeAdapter] Webhook wait complete.')
  }
}
