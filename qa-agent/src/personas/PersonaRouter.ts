/**
 * PersonaRouter — manages two independent Playwright browser contexts,
 * one per persona (client + admin). Hot-swaps between them without logging out.
 *
 * This is the heart of the cross-persona handoff model.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type {
  Persona,
  AdminCredentials,
  ClientCredentials,
  RunConfig,
} from "../types.js";

export interface PersonaContext {
  persona: Persona;
  context: BrowserContext;
  page: Page;
}

interface AdminAuthStateSnapshot {
  origin: string;
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
  localStorage: Array<{ key: string; value: string }>;
  sessionStorage: Array<{ key: string; value: string }>;
}

export class PersonaRouter {
  private browser: Browser | null = null;
  private contexts: Map<Persona, PersonaContext> = new Map();
  private activePersona: Persona | null = null;
  private adminCredentials: AdminCredentials | null = null;
  private adminAuthSnapshot: AdminAuthStateSnapshot | null = null;
  private baseUrl: string | null = null;

  private readonly adminStorageStatePath = path.resolve(
    process.cwd(),
    "evidence",
    "auth-state.admin.json",
  );

  async init(config: RunConfig): Promise<void> {
    this.adminCredentials = config.adminCredentials;
    this.baseUrl = config.baseUrl;
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Create all three contexts upfront — they run in parallel, we just switch
    // which one the orchestrator is "speaking through" at any given step.
    await this.createClientContext(config.clientCredentials, config.baseUrl);
    await this.createAdminContext(config.adminCredentials, config.baseUrl);
    await this.createEnduserContext(config.clientCredentials, config.baseUrl);
  }

  /**
   * Get the Page for the given persona.
   * Switches active persona tracking but does NOT close the other context.
   */
  async getPage(persona: Persona): Promise<Page> {
    const ctx = this.contexts.get(persona);
    if (!ctx)
      throw new Error(
        `PersonaRouter: context for "${persona}" not initialised`,
      );
    this.activePersona = persona;
    return ctx.page;
  }

  /** Current active persona */
  get active(): Persona | null {
    return this.activePersona;
  }

  /** Take a screenshot on the given persona's page */
  async screenshot(persona: Persona, path: string): Promise<void> {
    const page = await this.getPage(persona);
    await page.screenshot({ path, fullPage: true });
  }

  /** Capture DOM snapshot (outer HTML) on the given persona's page */
  async domSnapshot(persona: Persona): Promise<string> {
    const page = await this.getPage(persona);
    return page.content();
  }

  async teardown(): Promise<void> {
    for (const ctx of this.contexts.values()) {
      await ctx.context.close();
    }
    if (this.browser) await this.browser.close();
    this.contexts.clear();
    this.adminCredentials = null;
    this.adminAuthSnapshot = null;
    this.baseUrl = null;
    this.browser = null;
  }

  /**
   * Capture admin cookies + web storage so auth can be re-hydrated after
   * persona context switching.
   */
  async snapshotAdminSession(): Promise<void> {
    const page = await this.getPage("admin");
    const adminCtx = this.contexts.get("admin");
    if (!adminCtx) {
      throw new Error("PersonaRouter: admin context not initialised");
    }

    const currentPath = new URL(page.url()).pathname;
    if (!currentPath.startsWith("/admin")) {
      return;
    }

    await this.assertAdminStorageToken(page);

    const origin = new URL(page.url()).origin;
    const storage = await page.evaluate(() => ({
      localStorage: Object.entries(window.localStorage).map(([key, value]) => ({
        key,
        value,
      })),
      sessionStorage: Object.entries(window.sessionStorage).map(
        ([key, value]) => ({ key, value }),
      ),
    }));
    const cookies = await adminCtx.context.cookies(origin);

    this.adminAuthSnapshot = {
      origin,
      cookies,
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
    };

    await fs.mkdir(path.dirname(this.adminStorageStatePath), {
      recursive: true,
    });
    await adminCtx.context.storageState({ path: this.adminStorageStatePath });
  }

  /**
   * Pre-flight verification before protected admin navigations.
   * Ensures auth cookie/token state exists, or rehydrates it from auth-state.
   */
  async preflightAdminSession(): Promise<void> {
    const page = await this.getPage("admin");
    const hasAuthState = await this.hasAdminCookieOrToken(page);

    if (!hasAuthState) {
      const rehydrated = await this.rehydrateAdminSession();
      if (!rehydrated) {
        throw new Error(
          "Admin preflight failed: missing auth cookie/token and auth-state rehydrate failed",
        );
      }
    }

    // Explicit token verification requested by QA policy.
    await this.assertAdminStorageToken(page);
  }

  /**
   * Ensure admin persona has an active authenticated session.
   * If middleware redirects to /login, perform credentialed login once
   * and re-open /admin/dashboard.
   */
  async ensureAdminSession(): Promise<void> {
    // Best-effort pre-flight: if auth state is already valid this exits early.
    // If the preflight throws (no cookies/tokens and no rehydration possible)
    // we fall through to the full navigate + credential-login path below so
    // that a missed or failed login step earlier in the scenario does not
    // permanently block all subsequent admin navigations.
    try {
      await this.preflightAdminSession();
    } catch (preflightErr) {
      console.warn(
        `[PersonaRouter] Preflight check failed — proceeding to full login flow: ${preflightErr instanceof Error ? preflightErr.message : String(preflightErr)}`,
      );
    }

    const page = await this.getPage("admin");

    await this.gotoWithRetry(page, "/admin/dashboard", {
      waitUntil: "load",
      timeout: 30_000,
    });
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    const firstPathname = new URL(page.url()).pathname;
    if (!firstPathname.startsWith("/login")) {
      await this.assertAdminStorageToken(page);
      await this.snapshotAdminSession();
      return;
    }

    console.warn(
      "[PersonaRouter] Admin session missing after handoff; attempting auth-state rehydrate",
    );

    const restored = await this.rehydrateAdminSession();
    if (restored) {
      await this.gotoWithRetry(page, "/admin/dashboard", {
        waitUntil: "load",
        timeout: 30_000,
      });
      await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
      const restoredPathname = new URL(page.url()).pathname;
      if (restoredPathname.startsWith("/admin/dashboard")) {
        await this.assertAdminStorageToken(page);
        await this.snapshotAdminSession();
        return;
      }
      console.warn(
        "[PersonaRouter] Rehydrated auth-state did not recover session; falling back to credential login",
      );
    }

    if (!this.adminCredentials) {
      throw new Error(
        "PersonaRouter: admin credentials are not available for re-authentication",
      );
    }

    console.warn(
      "[PersonaRouter] Rehydrate path failed, attempting credential login",
    );

    await this.performAdminLogin(page, this.adminCredentials);

    await this.gotoWithRetry(page, "/admin/dashboard", {
      waitUntil: "load",
      timeout: 30_000,
    });
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    const finalPathname = new URL(page.url()).pathname;
    if (!finalPathname.startsWith("/admin/dashboard")) {
      throw new Error(
        `Admin re-authentication did not land on /admin/dashboard (current: ${page.url()})`,
      );
    }
    await this.assertAdminStorageToken(page);
    await this.snapshotAdminSession();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Retry a page navigation with exponential backoff for transient network errors.
   * Handles DNS resolution failures, connection timeouts, etc.
   */
  private async gotoWithRetry(
    page: any,
    url: string,
    options?: any,
    maxAttempts: number = 3,
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `[PersonaRouter] Navigating to ${url} (attempt ${attempt}/${maxAttempts})`,
        );
        return await page.goto(url, options);
      } catch (err: any) {
        lastError = err;
        const isNetworkError =
          err.message?.includes("ERR_NAME_NOT_RESOLVED") ||
          err.message?.includes("ERR_CONNECTION_REFUSED") ||
          err.message?.includes("ERR_NETWORK_CHANGED") ||
          err.message?.includes("net::");

        if (isNetworkError && attempt < maxAttempts) {
          const delayMs = Math.pow(2, attempt - 1) * 1000; // exponential backoff: 1s, 2s, 4s
          console.warn(
            `[PersonaRouter] Network error on attempt ${attempt}: ${err.message}. Retrying in ${delayMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error("Navigation failed after max retries");
  }

  private async createClientContext(
    credentials: ClientCredentials,
    baseUrl: string,
  ): Promise<void> {
    if (!this.browser) throw new Error("Browser not initialised");
    const context = await this.browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1280, height: 900 },
      // Label context for Playwright trace / debugging
      extraHTTPHeaders: { "x-qa-persona": "client" },
    });
    const page = await context.newPage();

    // Navigate to the client edit portal using the reviewToken
    // The app reads the token from the URL path: /edit/[reviewToken]
    // Use retry logic to handle transient network issues
    await this.gotoWithRetry(page, `/edit/${credentials.reviewToken}`);

    this.contexts.set("client", { persona: "client", context, page });
  }

  private async createAdminContext(
    credentials: AdminCredentials,
    baseUrl: string,
  ): Promise<void> {
    if (!this.browser) throw new Error("Browser not initialised");
    const context = await this.browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-qa-persona": "admin" },
    });
    const page = await context.newPage();

    // Capture page-level console errors for debugging
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error")
        pageErrors.push(`[console.error] ${msg.text()}`);
    });

    // Navigate to admin login
    // The page is 'use client' wrapped in <Suspense fallback={<Skeleton/>}>.
    // waitUntil:'load' fires quickly; we then wait for networkidle to let
    // Supabase auth.getSession() complete before asserting the form exists.
    await this.gotoWithRetry(page, "/login?next=/admin/dashboard&adminOnly=1", {
      waitUntil: "load",
      timeout: 30_000,
    });
    // Wait for form selectors to become visible — use faster 'domcontentloaded' check
    // instead of 'networkidle' to avoid timeout in dev containers where background
    // requests may never fully idle (analytics, WebSockets, etc.)
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
    } catch {
      // Fallback: don't block on network idle, continue to form selectors
      console.warn(
        "[PersonaRouter] domcontentloaded timeout — retrying with form selector",
      );
    }

    // Wait up to 90s total for the email input to appear.
    // Use [data-testid="admin-email"] first; fall back to input#email / input[type="email"]
    // in case data-testid was stripped by the SWC compiler in a production build.
    // (Next.js SWC strips data-testid by default — fixed in next.config.js but
    //  fallback ensures old deployments still work.)
    const emailSelector =
      '[data-testid="admin-email"], input#email, input[type="email"][autocomplete="email"]';
    try {
      await page.waitForSelector(emailSelector, {
        state: "visible",
        timeout: 15_000,
      });
    } catch (err) {
      // Full diagnostics on timeout
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const screenshotPath = `evidence/login-failure-${ts}.png`;
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        /* ignore */
      }
      const bodyHtml = await page
        .evaluate(() => document.body?.innerHTML?.slice(0, 3000) ?? "(empty)")
        .catch(() => "(eval failed)");
      console.error(`\n📸 Login page screenshot: ${screenshotPath}`);
      console.error(`🔍 URL: ${page.url()}`);
      console.error(`🐛 Page errors:\n${pageErrors.join("\n") || "(none)"}`);
      console.error(`📄 Body HTML (3000 chars):\n${bodyHtml}\n`);
      throw err;
    }
    // Do NOT fill or submit the login form here.
    // The QA scenario (full_lifecycle.yaml) owns the admin login steps so that
    // the form submission is covered by the test. Pre-filling / submitting here
    // would create a second, redundant sign-in that interferes with the scenario's
    // own login attempt and causes the second signInWithPassword call to fail to
    // propagate the session to the subsequent RSC navigation.
    //
    // The scenario will fill email/password, click submit, and wait for the URL
    // to change to /admin/dashboard using the `wait_for_url` step type.
    console.log(
      `[PersonaRouter] ✅ Admin context ready — login page loaded, scenario will sign in`,
    );

    this.contexts.set("admin", { persona: "admin", context, page });
  }

  private async createEnduserContext(
    credentials: ClientCredentials,
    baseUrl: string,
  ): Promise<void> {
    if (!this.browser) throw new Error("Browser not initialised");
    const context = await this.browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1024, height: 768 }, // Smaller viewport for typical non-tech-savvy user (older screen)
      // Label context for Playwright trace / debugging
      extraHTTPHeaders: { "x-qa-persona": "enduser" },
    });
    const page = await context.newPage();

    // Navigate to the client edit portal using the reviewToken
    // The enduser uses the same portal as the client, but we test for UX clarity
    // and obvious CTAs rather than advanced features.
    // Use retry logic to handle transient network issues
    await this.gotoWithRetry(page, `/edit/${credentials.reviewToken}`);

    this.contexts.set("enduser", { persona: "enduser", context, page });
  }

  private async createAdminContextFromStorageState(
    baseUrl: string,
  ): Promise<void> {
    if (!this.browser) throw new Error("Browser not initialised");

    const previousAdmin = this.contexts.get("admin");
    if (previousAdmin) {
      await previousAdmin.context.close();
      this.contexts.delete("admin");
    }

    const context = await this.browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-qa-persona": "admin" },
      storageState: this.adminStorageStatePath,
    });
    const page = await context.newPage();
    this.contexts.set("admin", { persona: "admin", context, page });
  }

  private async performAdminLogin(
    page: Page,
    credentials: AdminCredentials,
  ): Promise<void> {
    const emailSelector =
      '[data-testid="admin-email"], input#email, input[type="email"][autocomplete="email"]';
    const passwordSelector =
      '[data-testid="admin-password"], input#password, input[type="password"]';
    const submitSelector =
      '[data-testid="admin-login-submit"], button[type="submit"]';

    await page.waitForSelector(emailSelector, {
      state: "visible",
      timeout: 20_000,
    });
    await page.fill(emailSelector, credentials.email);
    await page.fill(passwordSelector, credentials.password);
    await page.click(submitSelector);

    await page.waitForFunction(
      () => window.location.pathname.startsWith("/admin/dashboard"),
      { timeout: 45_000 },
    );
  }

  private async assertAdminStorageToken(page: Page): Promise<void> {
    const tokenState = await page.evaluate(() => {
      const local = Object.entries(window.localStorage);
      const session = Object.entries(window.sessionStorage);
      let hasLocal = false;
      for (const [key, value] of local) {
        const keyMatch =
          /auth-token|access_token|refresh_token|supabase|sb-/i.test(key);
        const valueMatch =
          /access_token|refresh_token|"sub"|"expires_at"/i.test(String(value));
        if (keyMatch || valueMatch) {
          hasLocal = true;
          break;
        }
      }

      let hasSession = false;
      for (const [key, value] of session) {
        const keyMatch =
          /auth-token|access_token|refresh_token|supabase|sb-/i.test(key);
        const valueMatch =
          /access_token|refresh_token|"sub"|"expires_at"/i.test(String(value));
        if (keyMatch || valueMatch) {
          hasSession = true;
          break;
        }
      }

      return {
        hasLocal,
        hasSession,
      };
    });

    if (!tokenState.hasLocal && !tokenState.hasSession) {
      throw new Error(
        `Admin auth token not found in web storage at ${page.url()} (localStorage/sessionStorage empty or missing auth keys)`,
      );
    }
  }

  private async hasAdminCookieOrToken(page: Page): Promise<boolean> {
    const adminCtx = this.contexts.get("admin");
    if (!adminCtx) {
      return false;
    }

    const currentUrl = page.url();
    const origin = currentUrl
      ? `${new URL(currentUrl).origin}/`
      : `${this.baseUrl ?? ""}`;
    const cookies = origin
      ? await adminCtx.context.cookies(origin)
      : await adminCtx.context.cookies();
    const hasAuthCookie = cookies.some((cookie) =>
      /sb-|supabase|auth|access|refresh/i.test(cookie.name),
    );

    const hasStorageToken = await page.evaluate(() => {
      const local = Object.entries(window.localStorage);
      const session = Object.entries(window.sessionStorage);
      for (const [key, value] of [...local, ...session]) {
        const keyMatch =
          /auth-token|access_token|refresh_token|supabase|sb-/i.test(key);
        const valueMatch =
          /access_token|refresh_token|"sub"|"expires_at"/i.test(String(value));
        if (keyMatch || valueMatch) return true;
      }
      return false;
    });

    return hasAuthCookie || hasStorageToken;
  }

  /**
   * Dedicated helper requested by QA to rehydrate admin session from persisted
   * auth-state.json before protected route navigation.
   */
  private async rehydrateAdminSession(): Promise<boolean> {
    if (!this.baseUrl) {
      return false;
    }

    try {
      await fs.access(this.adminStorageStatePath);
    } catch {
      // Fallback to in-memory snapshot if file was not generated yet.
      const page = await this.getPage("admin");
      return this.restoreAdminAuthSnapshot(page);
    }

    try {
      await this.createAdminContextFromStorageState(this.baseUrl);
      const page = await this.getPage("admin");

      // Load same-origin doc so local/session storage is accessible.
      await this.gotoWithRetry(page, "/login?next=/admin/dashboard&adminOnly=1", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      // Explicit pre-navigation token verification.
      await this.assertAdminStorageToken(page);
      return true;
    } catch (err) {
      console.warn(
        `[PersonaRouter] rehydrateAdminSession failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  private async restoreAdminAuthSnapshot(page: Page): Promise<boolean> {
    if (!this.adminAuthSnapshot) {
      return false;
    }

    const adminCtx = this.contexts.get("admin");
    if (!adminCtx) {
      return false;
    }

    try {
      if (this.adminAuthSnapshot.cookies.length > 0) {
        await adminCtx.context.addCookies(this.adminAuthSnapshot.cookies);
      }

      await this.gotoWithRetry(page, `${this.adminAuthSnapshot.origin}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      await page.evaluate((snapshot) => {
        window.localStorage.clear();
        window.sessionStorage.clear();

        for (const { key, value } of snapshot.localStorage) {
          window.localStorage.setItem(key, value);
        }
        for (const { key, value } of snapshot.sessionStorage) {
          window.sessionStorage.setItem(key, value);
        }
      }, this.adminAuthSnapshot);

      await this.assertAdminStorageToken(page);
      return true;
    } catch (err) {
      console.warn(
        `[PersonaRouter] Failed to restore admin auth snapshot: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
