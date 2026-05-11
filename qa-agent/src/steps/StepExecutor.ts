/**
 * StepExecutor — executes a single ScenarioStep against the appropriate persona's page.
 * Returns a Finding or null (null = step passed cleanly).
 *
 * Every failure is caught here and returned as a Finding with the step's declared severity.
 * The EscalationEngine decides what to do with it.
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

export class StepExecutor {
  constructor(
    private readonly router: PersonaRouter,
    private readonly db: SupabaseAdapter,
    private readonly evidenceDir: string,
    private readonly runId: string,
  ) {}

  async execute(step: ScenarioStep): Promise<Finding | null> {
    try {
      await this.runStep(step)
      // Step passed — no finding
      return null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined

      const screenshotPath = await this.captureEvidence(step.persona, step.id)

      return {
        stepId: step.id,
        persona: step.persona,
        severity: step.severity,
        message,
        screenshotPath,
        timestamp: new Date().toISOString(),
        stack,
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async runStep(step: ScenarioStep): Promise<void> {
    switch (step.type) {
      case 'navigate':       return this.stepNavigate(step.persona, step.url)
      case 'click':          return this.stepClick(step.persona, step.selector)
      case 'fill':           return this.stepFill(step.persona, step.selector, step.value)
      case 'wait_for':       return this.stepWaitFor(step.persona, step.selector, step.timeout_ms)
      case 'assert_text':    return this.stepAssertText(step.persona, step.selector, step.contains)
      case 'assert_url':     return this.stepAssertUrl(step.persona, step.pattern)
      case 'assert_db':      return this.stepAssertDb(step.table, step.where, step.expected_count)
      case 'handoff':        return this.stepHandoff(step.from, step.to, step.message, step.handoff_timeout_ms)
      case 'pause':          return this.stepPause(step.duration_ms)
      default: {
        // TypeScript exhaustive check
        const _exhaustive: never = step
        throw new Error(`Unknown step type: ${(_exhaustive as ScenarioStep).type}`)
      }
    }
  }

  private async stepNavigate(persona: Persona, url: string): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.goto(url)
  }

  private async stepClick(persona: Persona, selector: string): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.click(selector)
  }

  private async stepFill(persona: Persona, selector: string, value: string): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.fill(selector, value)
  }

  private async stepWaitFor(persona: Persona, selector: string, timeoutMs = 10_000): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.waitForSelector(selector, { timeout: timeoutMs })
  }

  private async stepAssertText(persona: Persona, selector: string, contains: string): Promise<void> {
    const page = await this.router.getPage(persona)
    await page.waitForSelector(selector, { timeout: 10_000 })
    const text = await page.textContent(selector)
    if (!text?.includes(contains)) {
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
    // Handoff: log the transition, switch active persona context
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
}
