/**
 * PersonaRouter — manages two independent Playwright browser contexts,
 * one per persona (client + admin). Hot-swaps between them without logging out.
 *
 * This is the heart of the cross-persona handoff model.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import type { Persona, AdminCredentials, ClientCredentials, RunConfig } from '../types.js'

export interface PersonaContext {
  persona: Persona
  context: BrowserContext
  page: Page
}

export class PersonaRouter {
  private browser: Browser | null = null
  private contexts: Map<Persona, PersonaContext> = new Map()
  private activePersona: Persona | null = null

  async init(config: RunConfig): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    // Create both contexts upfront — they run in parallel, we just switch
    // which one the orchestrator is "speaking through" at any given step.
    await this.createClientContext(config.clientCredentials, config.baseUrl)
    await this.createAdminContext(config.adminCredentials, config.baseUrl)
  }

  /**
   * Get the Page for the given persona.
   * Switches active persona tracking but does NOT close the other context.
   */
  async getPage(persona: Persona): Promise<Page> {
    const ctx = this.contexts.get(persona)
    if (!ctx) throw new Error(`PersonaRouter: context for "${persona}" not initialised`)
    this.activePersona = persona
    return ctx.page
  }

  /** Current active persona */
  get active(): Persona | null {
    return this.activePersona
  }

  /** Take a screenshot on the given persona's page */
  async screenshot(persona: Persona, path: string): Promise<void> {
    const page = await this.getPage(persona)
    await page.screenshot({ path, fullPage: true })
  }

  /** Capture DOM snapshot (outer HTML) on the given persona's page */
  async domSnapshot(persona: Persona): Promise<string> {
    const page = await this.getPage(persona)
    return page.content()
  }

  async teardown(): Promise<void> {
    for (const ctx of this.contexts.values()) {
      await ctx.context.close()
    }
    if (this.browser) await this.browser.close()
    this.contexts.clear()
    this.browser = null
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async createClientContext(
    credentials: ClientCredentials,
    baseUrl: string,
  ): Promise<void> {
    if (!this.browser) throw new Error('Browser not initialised')
    const context = await this.browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1280, height: 900 },
      // Label context for Playwright trace / debugging
      extraHTTPHeaders: { 'x-qa-persona': 'client' },
    })
    const page = await context.newPage()

    // Navigate to the client edit portal using the reviewToken
    // The app reads the token from the URL path: /edit/[reviewToken]
    await page.goto(`/edit/${credentials.reviewToken}`)

    this.contexts.set('client', { persona: 'client', context, page })
  }

  private async createAdminContext(
    credentials: AdminCredentials,
    baseUrl: string,
  ): Promise<void> {
    if (!this.browser) throw new Error('Browser not initialised')
    const context = await this.browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { 'x-qa-persona': 'admin' },
    })
    const page = await context.newPage()

    // Navigate to admin login and authenticate
    await page.goto('/admin/login')
    await page.fill('[data-testid="admin-email"]', credentials.email)
    await page.fill('[data-testid="admin-password"]', credentials.password)
    await page.click('[data-testid="admin-login-submit"]')

    // Wait for redirect to admin dashboard
    await page.waitForURL(/\/admin(\/dashboard)?/, { timeout: 15_000 })

    this.contexts.set('admin', { persona: 'admin', context, page })
  }
}
