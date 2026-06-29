/**
 * Core types for the RankedCEO QA Agent
 * Persona-aware, severity-gated, self-healing-ready
 */

// ─── Personas ────────────────────────────────────────────────────────────────

export type Persona = 'client' | 'admin' | 'enduser'

/**
 * Persona descriptions:
 * - 'admin': Full platform admin with all permissions (dashboard, QA, billing)
 * - 'client': Tech-savvy client using the web builder portal (/edit/[token])
 * - 'enduser': Non-tech-savvy client testing UX clarity, obvious CTAs, and
 *   "what do I do next" guidance. Expects simple, obvious navigation.
 */

export interface PersonaConfig {
  persona: Persona
  /** For client: the reviewToken. For admin: the admin credentials. */
  credentials: ClientCredentials | AdminCredentials
}

export interface ClientCredentials {
  type: 'client'
  reviewToken: string
  /** Email used if magic-link flow needs to be exercised */
  email?: string
}

export interface AdminCredentials {
  type: 'admin'
  email: string
  password: string
}

// ─── Severity ────────────────────────────────────────────────────────────────

/**
 * info    — informational, always continues
 * warning — something unexpected but not blocking, always continues
 * error   — test step failed, continues unless escalated
 * critical — halts run immediately, emails admin, opens GitHub Issue
 */
export type Severity = 'info' | 'warning' | 'error' | 'critical'

// ─── Scenario DSL ────────────────────────────────────────────────────────────

export interface Scenario {
  id: string
  name: string
  description?: string
  /** Which run modes this scenario applies to */
  modes: RunMode[]
  /** Whether Stripe test adapter is required */
  requires_stripe?: boolean
  /** Whether Resend test adapter is required */
  requires_email?: boolean
  steps: ScenarioStep[]
}

export type RunMode = 'smoke' | 'full'

export type ScenarioStep =
  | NavigateStep
  | ClickStep
  | FillStep
  | WaitForStep
  | AssertTextStep
  | AssertUrlStep
  | AssertDbStep
  | HandoffStep
  | PauseStep
  | WaitForUrlStep

interface BaseStep {
  id: string
  persona: Persona
  description?: string
  severity: Severity
  /**
   * v1.5 self-healing stub — describes the intent of this step so the LLM
   * can re-derive a selector if the UI changes.
   * Populated now, wired to LLM later.
   */
  intent?: string
  /**
   * Number of times to retry this step on failure before recording a finding.
   * Defaults to 0 (no retry). Use sparingly — prefer fixing flaky selectors.
   */
  retries?: number
  /**
   * Per-step timeout override in milliseconds.
   * Overrides the executor's default timeout for this specific step.
   */
  timeout_ms?: number
}

export interface NavigateStep extends BaseStep {
  type: 'navigate'
  url: string
}

export interface ClickStep extends BaseStep {
  type: 'click'
  selector: string
}

export interface FillStep extends BaseStep {
  type: 'fill'
  selector: string
  value: string
}

export interface WaitForStep extends BaseStep {
  type: 'wait_for'
  selector: string
  /** timeout in ms, defaults to 10000 */
  timeout_ms?: number
}

export interface AssertTextStep extends BaseStep {
  type: 'assert_text'
  selector: string
  contains: string
}

export interface AssertUrlStep extends BaseStep {
  type: 'assert_url'
  pattern: string
}

export interface AssertDbStep extends BaseStep {
  type: 'assert_db'
  /** Supabase table in `qa` schema */
  table: string
  /** Filter conditions */
  where: Record<string, unknown>
  /** Expected row count */
  expected_count: number
}

export interface HandoffStep extends BaseStep {
  type: 'handoff'
  /** Persona whose action triggers this handoff */
  from: Persona
  /** Persona who must act next */
  to: Persona
  /** Human-readable description of what to hand off */
  message: string
  /** ms to wait for the receiving persona's context to be ready */
  handoff_timeout_ms?: number
}

export interface PauseStep extends BaseStep {
  type: 'pause'
  /** ms to pause — use sparingly */
  duration_ms: number
}

export interface WaitForUrlStep extends BaseStep {
  type: 'wait_for_url'
  /**
   * Regex pattern to match against the full page URL.
   * Evaluation: `new RegExp(pattern).test(page.url())`
   * Example: "/admin/dashboard$"
   */
  pattern: string
}

// ─── Run ─────────────────────────────────────────────────────────────────────

export type RunStatus = 'running' | 'pass' | 'pass_with_findings' | 'error' | 'critical_halt'

export interface RunConfig {
  runId: string
  mode: RunMode
  scenarioPath: string
  baseUrl: string
  /** Admin credentials for the admin persona */
  adminCredentials: AdminCredentials
  /** Client credentials for the client persona */
  clientCredentials: ClientCredentials
  /** If true, use Stripe test adapter; if false, mock billing */
  stripeTestMode: boolean
  /** If true, use Resend test adapter; if false, skip email assertions */
  emailTestMode: boolean
}

// ─── Findings ────────────────────────────────────────────────────────────────

export interface Finding {
  stepId: string
  persona: Persona
  severity: Severity
  message: string
  /** Scenario step type at failure time */
  stepType?: ScenarioStep['type']
  /** Failed selector for selector-based steps */
  failedSelector?: string
  /** Failed URL pattern for URL assertion/wait steps */
  failedPattern?: string
  /** Scenario-authored intent text */
  intent?: string
  /** Truncated DOM HTML snapshot captured at failure point */
  domSnippet?: string
  screenshotPath?: string
  domSnapshotPath?: string
  dbSnapshot?: Record<string, unknown>
  timestamp: string
  /** Stack trace if available */
  stack?: string
}

export interface RunReport {
  runId: string
  scenario: string
  mode: RunMode
  startedAt: string
  completedAt: string
  status: RunStatus
  findings: Finding[]
  /** Total step count */
  totalSteps: number
  /** Steps that passed */
  passedSteps: number
  /** Steps that had findings */
  findingSteps: number
  /** The critical finding if status is critical_halt */
  criticalFinding?: Finding
}
