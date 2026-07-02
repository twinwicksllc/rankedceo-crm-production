/**
 * Self-healing types — v1 stub, v1.5 activation
 *
 * These types define the payload embedded in every critical-halt GitHub Issue
 * and the proposal the LLM returns when asked to re-derive a broken selector.
 *
 * In v1:  selfHealPayload is stored in the Issue body. llm-relocate.ts logs it.
 * In v1.5: llm-relocate.ts sends it to an LLM and returns a SelfHealProposal.
 */

// ─── Payload (embedded in GitHub Issue body on critical halt) ─────────────────

export interface SelfHealPayload {
  /** Run that produced this payload */
  runId: string;
  /** Scenario file name */
  scenario: string;
  /** Step that critically failed */
  stepId: string;
  /** Persona that was active when the step failed */
  persona: "admin" | "client";
  /** Step type (navigate, click, fill, assert_text, assert_url, assert_db, handoff, pause) */
  stepType: string;
  /** The selector that failed, if applicable */
  failedSelector?: string;
  /** The URL pattern that failed, if applicable */
  failedPattern?: string;
  /** The intent annotation from the YAML — tells the LLM what the step was trying to accomplish */
  intent: string;
  /** The error message from the failure */
  errorMessage: string;
  /** ISO timestamp of the failure */
  failedAt: string;
  /** Path to the screenshot captured at failure time */
  screenshotPath?: string;
  /**
   * DOM snapshot excerpt — the outerHTML of the area near the failed selector.
   * Truncated to ~4000 chars so it fits in an LLM context window.
   * In v1.5, populated by StepExecutor.captureEvidence() when a step fails.
   */
  domSnippet?: string;
}

// ─── Proposal (returned by LLM in v1.5) ──────────────────────────────────────

export interface SelfHealProposal {
  /** Whether the LLM believes it can suggest a fix */
  canFix: boolean;
  /** Confidence score 0.0–1.0 — only apply automatically if > 0.85 */
  confidence: number;
  /** Proposed replacement selector, if applicable */
  proposedSelector?: string;
  /** Proposed replacement URL pattern, if applicable */
  proposedPattern?: string;
  /** Human-readable explanation of why the original selector broke */
  reasoning: string;
  /**
   * Suggested YAML patch — the complete replacement step block.
   * Can be applied directly by a developer or via automated PR.
   */
  yamlPatch?: string;
  /** LLM model used to generate this proposal */
  model: string;
  /** Tokens consumed by this inference */
  tokensUsed?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SelfHealConfig {
  /**
   * LLM provider to use.
   * In v1.5, wire to 'openai' or 'anthropic'.
   * Default: 'stub' (logs prompt, returns null)
   */
  provider: "stub" | "openai" | "anthropic";
  /** Model name — e.g. 'gpt-4o', 'claude-3-5-sonnet-20241022' */
  model?: string;
  /** API key — from env var in production */
  apiKey?: string;
  /**
   * Minimum confidence threshold to include a proposal in the GitHub Issue comment.
   * Proposals below this threshold are discarded.
   * Default: 0.7
   */
  minConfidence?: number;
}
