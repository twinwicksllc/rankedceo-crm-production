/**
 * StepExecutor — executes a single ScenarioStep against the appropriate persona's page.
 * Returns a Finding or null (null = step passed cleanly).
 *
 * Every failure is caught here and returned as a Finding with the step's declared severity.
 * The EscalationEngine decides what to do with it.
 *
 * Retry behaviour:
 *   If step.retries > 0, the step is retried up to that many times on failure.
 *   Each retry is preceded by a backoff that doubles per attempt (1s, 2s, 4s…).
 *   Only the final failure generates a Finding and captures evidence.
 *
 * Timeout behaviour:
 *   step.timeout_ms overrides the executor's DEFAULT_STEP_TIMEOUT for that step.
 *   Propagated to all selector-waiting calls (waitForSelector, etc.).
 */

import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import type {
  ScenarioStep,
  Finding,
  Persona,
} from '../types.js'
import type { PersonaRouter } from '../personas/PersonaRouter.js'
import type { SupabaseAdapter } from '../adaptors/supabase/SupabaseAdapter.js'

/** Default per-step timeout when no override is provided */
const DEFAULT_STEP_TIMEOUT_MS = 10_000

/** Base backoff in ms for retry attempts (doubles each attempt) */
const RETRY_BASE_BACKOFF_MS = 1_000

export class StepExecutor {
  constructor(
    private readonly router: PersonaRouter,
    private readonly db: SupabaseAdapter,
    private readonly evidenceDir: string,
    private readonly runId: string,
  ) {}

  async execute(step: ScenarioStep): Promise<Finding | null> {
    const maxAttempts = 1 + (step.retries ?? 0)
    let lastErr: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.runStep(step)
        // Step passed — no finding
        if (attempt > 1) {
          console.log(`  ♻️  Step ${step.id} passed on retry ${attempt - 1}`)
        }
        return null
      } catch (err) {
        lastErr = err
        if (attempt < maxAttempts) {
          const backoffMs = RETRY_BASE_BACKOFF_MS * Math.pow(2, attempt - 1)
          console.warn(
            `  ⚠️  Step ${step.id} failed (attempt ${attempt}/${maxAttempts}), retrying in ${backoffMs}ms — ${err instanceof Error ? err.message : String(err)}`
          )
          await new Promise(res => setTimeout(res, backoffMs))
        }
      }
    }

    // All attempts exhausted — capture evidence and return finding
    const message = lastErr instanceof Error ? lastErr.message : String(lastErr)
    const stack = lastErr instanceof Error ? lastErr.stack : undefined
    const screenshotPath = await this.captureEvidence(step.persona, step.id)
    const domSnippet = await this.captureDomSnippet(step.persona)

    return {
      stepId: step.id,
      persona: step.persona,
      severity: step.severity,
      message: maxAttempts > 1
        ? `[after ${maxAttempts} attempts] ${message}`
        : message,
      stepType: step.type,
      failedSelector: this.extractFailedSelector(step),
      failedPattern: this.extractFailedPattern(step),
      intent: step.intent,
      domSnippet,
      screenshotPath,
      timestamp: new Date().toISOString(),
      stack,
    }
  }

  // --- Private ---------------------------------------------------------------

  private async runStep(step: ScenarioStep): Promise<void> {
    // Per-step timeout: use step.timeout_ms if set, else DEFAULT
    const timeoutMs = step.timeout_ms ?? DEFAULT_STEP_TIMEOUT_MS

    switch (step.type) {
      case 'navigate':      return this.stepNavigate(step.persona, step.url)
      case 'click':         return this.stepClick(step.persona, step.selector)
      case 'fill':          return this.stepFill(step.persona, step.selector, step.value)
      case 'wait_for':      return this.stepWaitFor(step.persona, step.selector, timeoutMs)
      case 'wait_for_url':  return this.stepWaitForUrl(step.persona, step.pattern, timeoutMs)
      case 'assert_text':   return this.stepAssertText(step.persona, step.selector, step.contains, timeoutMs)
      case 'assert_url':    return this.stepAssertUrl(step.persona, step.pattern)
      case 'assert_db':     return this.stepAssertDb(step.table, step.where, step.expected_count)
      case 'handoff':       return this.stepHandoff(step.from, step.to, step.message, step.handoff_timeout_ms)
      case 'pause':         return this.stepPause(step.duration_ms)
      default: {
        // TypeScript exhaustive check
        const _exhaustive: never = step
        throw new Error(`Unknown step type: ${(_exhaustive as ScenarioStep).type}`)
      }
    }
  }

  private async stepNavigate(persona: Persona, url: string): Promise<void> {
    const page = await this.router.getPage(persona)
    // waitUntil:'load' fires after all resources are loaded.
    // Then wait for networkidle so Server Component streaming + Supabase
    // queries complete before the next step asserts on DOM content.
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  }

  private async stepClick(persona: Persona, selector: string): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.click(selector)
  }

  private async stepFill(persona: Persona, selector: string, value: string): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.fill(selector, value)
  }

  private async stepWaitFor(persona: Persona, selector: string, timeoutMs: number): Promise<void> {
    const page = await this.router.getPage(persona)
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs })
    } catch (err) {
      const currentUrl = page.url()
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`wait_for timeout for selector "${selector}" at "${currentUrl}": ${msg}`)
    }
  }

  /**
   * Wait for the page pathname to match a regex pattern.
   *
   * IMPORTANT: we match against pathname only (not full URL including query
   * string) to avoid false positives where the pattern appears in query params.
   *
   * We intentionally use waitForFunction(window.location.pathname) instead of
   * waitForURL default navigation waiting because SPA router.push transitions
   * can update pathname without a full "load" navigation event.
   */
  private async stepWaitForUrl(persona: Persona, pattern: string, timeoutMs: number): Promise<void> {
    const page = await this.router.getPage(persona)
    // Validate regex up-front so invalid patterns fail immediately
    const pathRegex = new RegExp(pattern)
    try {
      await page.waitForFunction(
        (regexSource) => new RegExp(regexSource).test(window.location.pathname),
        pathRegex.source,
        { timeout: timeoutMs },
      )
      // After URL settles, also wait for the page to finish loading server components
      await page.waitForLoadState('load', { timeout: timeoutMs })
      return
    } catch (firstErr) {
      // Fallback for flaky SPA transitions: if the pattern is a simple path,
      // navigate there directly and re-validate auth/state via URL match.
      const isSimplePath = pattern.startsWith('/') && !/[\^$()[\]{}|+*?]/.test(pattern)
      if (!isSimplePath) {
        throw firstErr
      }

      try {
        await page.goto(pattern, { waitUntil: 'load', timeout: timeoutMs })
        await page.waitForFunction(
          (regexSource) => new RegExp(regexSource).test(window.location.pathname),
          pathRegex.source,
          { timeout: timeoutMs },
        )
        await page.waitForLoadState('networkidle', { timeout: timeoutMs })
      } catch (fallbackErr) {
        const currentUrl = page.url()
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
        let loginErrorText = ''
        if (currentUrl.includes('/login')) {
          try {
            const alertText = await page
              .locator('[role="alert"], [data-testid="login-error"], .text-destructive')
              .first()
              .textContent({ timeout: 1000 })
            if (alertText?.trim()) {
              loginErrorText = ` Login error: ${alertText.trim()}`
            }
          } catch {
            // no visible login error element — keep default timeout message
          }
        }
        throw new Error(`wait_for_url timeout for pattern "${pattern}" at "${currentUrl}": ${msg}${loginErrorText}`)
      }
    }
  }

  private async stepAssertText(
    persona: Persona,
    selector: string,
    contains: string,
    timeoutMs: number,
  ): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.waitForSelector(selector, { timeout: timeoutMs })
    const text = await page.textContent(selector)
    if (contains !== '' && !text?.includes(contains)) {
      throw new Error(
        `assert_text failed on "${selector}": expected to contain "${contains}", got "${text ?? '(null)'}"`
      )
    }
  }

  private async stepAssertUrl(persona: Persona, pattern: string): Promise<void> {
    const page = await this.router.getPage(persona)
    const url = page.url()
    const re = new RegExp(pattern)
    if (!re.test(url)) {
      throw new Error(`assert_url failed: pattern "${pattern}" did not match "${url}"`)
    }
  }

  private async stepAssertDb(
    table: string,
    where: Record<string, unknown>,
    expectedCount: number,
  ): Promise<void> {
    const count = await this.db.countRows(table, where)
    if (count !== expectedCount) {
      throw new Error(
        `assert_db failed on "${table}": expected ${expectedCount} row(s) matching ${JSON.stringify(where)}, found ${count}`
      )
    }
  }

  private async stepHandoff(
    from: Persona,
    to: Persona,
    message: string,
    timeoutMs = 30_000,
  ): Promise<void> {
    // Handoff: log the transition, switch active persona context.
    // In v1 this is synchronous — we just switch the active page.
    // In v1.5 this could involve async signals between parallel runners.
    console.log(`  🔄 Handoff: ${from} → ${to} — ${message}`)
    await this.router.getPage(to)
    // Brief stabilisation pause after context switch
    await new Promise(res => setTimeout(res, Math.min(timeoutMs, 1_000)))
  }

  private async stepPause(durationMs: number): Promise<void> {
    await new Promise(res => setTimeout(res, durationMs))
  }

  private async captureEvidence(persona: Persona, stepId: string): Promise<string | undefined> {
    try {
      const filename = `${this.runId}_${persona}_${stepId}_${Date.now()}.png`
      const screenshotPath = path.join(this.evidenceDir, filename)
      await fs.mkdir(this.evidenceDir, { recursive: true })
      await this.router.screenshot(persona, screenshotPath)
      return screenshotPath
    } catch {
      // Don't let evidence capture failure mask the original error
      return undefined
    }
  }

  private async captureDomSnippet(persona: Persona): Promise<string | undefined> {
    try {
      const page = await this.router.getPage(persona)
      const bodyHtml = await page.evaluate(() => document.body?.outerHTML ?? '')
      if (bodyHtml) {
        // Keep payload small enough for issue body + LLM context.
        return bodyHtml.slice(0, 4000)
      }

      const html = await this.router.domSnapshot(persona)
      return html.slice(0, 4000)
    } catch {
      return undefined
    }
  }

  private extractFailedSelector(step: ScenarioStep): string | undefined {
    switch (step.type) {
      case 'click':
      case 'fill':
      case 'wait_for':
      case 'assert_text':
        return step.selector
      default:
        return undefined
    }
  }

  private extractFailedPattern(step: ScenarioStep): string | undefined {
    switch (step.type) {
      case 'wait_for_url':
      case 'assert_url':
        return step.pattern
      default:
        return undefined
    }
  }
}
