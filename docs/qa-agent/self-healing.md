# QA Agent — Self-Healing Guide

This document explains the self-healing architecture built into the QA agent, how it works in v1 (stub mode), and how to activate it in v1.5 with a real LLM.

---

## Table of Contents

- [What self-healing is](#what-self-healing-is)
- [v1 Architecture (current)](#v1-architecture-current)
- [selfHealPayload Schema](#selfhealpayload-schema)
- [Activating v1.5 (LLM wired)](#activating-v15-llm-wired)
- [How the LLM prompt is constructed](#how-the-llm-prompt-is-constructed)
- [Reviewing and applying proposals](#reviewing-and-applying-proposals)
- [Security considerations](#security-considerations)
- [Roadmap](#roadmap)

---

## What self-healing is

QA automation breaks when the UI changes — a renamed `data-testid`, a new redirect URL, or a component that was moved. Instead of silently failing until a developer notices, the QA agent embeds enough context in every critical-halt GitHub Issue for an LLM to:

1. Understand _what_ the failing step was trying to do (via the `intent:` field)
2. Understand _what_ selector or pattern failed (from the error message)
3. See _what the DOM looked like_ at the time of failure (from the DOM snapshot)
4. Propose a replacement selector or YAML patch

This is the v1.5 self-healing loop.

---

## v1 Architecture (current)

In v1, the self-healing infrastructure is fully scaffolded but the LLM call is a stub.

### Flow on critical halt

```
Step fails (severity: critical)
    ↓
EscalationEngine.record(finding)
    ↓
EscalationEngine.fireCriticalNotifications(finding)
    ├── sendCriticalEmail()         → Resend email to QA_ADMIN_EMAIL
    └── createGitHubIssue()         → GitHub Issue with:
            - Error details
            - Screenshot path
            - selfHealPayload JSON (between HTML comment markers)
            - Returns issueBody string
    ↓
relocate(issueBody, { provider: 'stub' })
    └── Extracts selfHealPayload from issue body
    └── Constructs LLM prompt
    └── Logs prompt to stdout
    └── Returns null (no LLM call)
```

The critical-halt GitHub Issue contains the payload. An operator can read it, understand the failure, and apply a manual fix.

### Viewing the stub output

When a critical halt fires locally, you'll see output like:

```
[llm-relocate] ── v1 STUB ───────────────────────────────────────
[llm-relocate] Self-healing hook is ready. To activate, set:
[llm-relocate]   SELF_HEAL_PROVIDER=openai
[llm-relocate]   OPENAI_API_KEY=sk-...
[llm-relocate] See docs/qa-agent/self-healing.md for full guide.

[llm-relocate] Constructed LLM prompt (would be sent in v1.5):
────────────────────────────────────────────────────────────
You are a QA automation engineer specialising in Playwright test repair.
...
```

---

## selfHealPayload Schema

Every critical-halt GitHub Issue body contains this JSON block, wrapped in HTML comment markers so `llm-relocate.ts` can extract it programmatically:

````
<!-- SELF_HEAL_PAYLOAD_START -->
```json
{
  "runId": "20240115_060142_a3f9b2",
  "scenario": "qa-agent/scenarios/smoke.yaml",
  "stepId": "client_assert_portal_loads",
  "persona": "client",
  "stepType": "wait_for",
  "failedSelector": "[data-testid='client-portal-root']",
  "failedPattern": null,
  "intent": "The client portal root div is the outermost wrapper of portal-shell.tsx...",
  "errorMessage": "Timeout 10000ms exceeded waiting for [data-testid='client-portal-root']",
  "failedAt": "2024-01-15T06:03:14.721Z",
  "screenshotPath": "qa-agent/evidence/20240115.../client_client_assert_portal_loads_1705298594.png",
  "domSnippet": "<div class=\"portal-wrapper\">\n  <nav>...</nav>\n  ..."
}
````

<!-- SELF_HEAL_PAYLOAD_END -->

````

### Field reference

| Field | Description |
|---|---|
| `runId` | Unique run identifier |
| `scenario` | Path to the YAML scenario file |
| `stepId` | The step ID that failed |
| `persona` | Which browser context was active |
| `stepType` | Step type (navigate, click, fill, etc.) |
| `failedSelector` | The CSS selector that timed out or could not be found |
| `failedPattern` | The URL regex pattern that did not match (for assert_url steps) |
| `intent` | The `intent:` field from the YAML step — describes what the step was trying to accomplish |
| `errorMessage` | The Playwright or assertion error message |
| `failedAt` | ISO timestamp |
| `screenshotPath` | Path to the screenshot captured at failure |
| `domSnippet` | Truncated outerHTML near the failed selector (populated in v1.5) |

> **Note:** In v1, `stepType`, `failedSelector`, `failedPattern`, `intent`, and `domSnippet` are not fully populated from the step metadata (they contain placeholder values). These fields will be fully populated in v1.5 when `StepExecutor` passes the full step object through to `EscalationEngine`.

---

## Activating v1.5 (LLM wired)

### Prerequisites

- Node.js 20+ (24+ recommended for GitHub Actions)
- An OpenAI or Anthropic API key
- The `qa-agent/` dependencies installed (`npm install`)

### Step 1 — Add the LLM SDK dependency

For OpenAI:
```bash
cd qa-agent && npm install openai
````

For Anthropic:

```bash
cd qa-agent && npm install @anthropic-ai/sdk
```

### Step 2 — Set environment variables

```bash
# Choose your provider
export SELF_HEAL_PROVIDER=openai          # or: anthropic
export OPENAI_API_KEY=sk-...              # if using OpenAI
export ANTHROPIC_API_KEY=sk-ant-...      # if using Anthropic

# Optional tuning
export SELF_HEAL_MODEL=gpt-4o            # default: gpt-4o
export SELF_HEAL_MIN_CONFIDENCE=0.75     # default: 0.7 — proposals below this are ignored
```

Add these to your GitHub Actions secrets if you want self-healing on CI.

### Step 3 — Uncomment the SDK call in llm-relocate.ts

Open `qa-agent/src/self-healing/llm-relocate.ts` and find the `callLlm()` function. The OpenAI and Anthropic implementations are fully written as comments — uncomment the block for your chosen provider and remove the TODO comment.

**OpenAI example:**

```typescript
// BEFORE (v1):
// TODO v1.5: Replace this comment with the actual OpenAI SDK call:
//
// import OpenAI from 'openai'
// const client = new OpenAI({ apiKey: config.apiKey })
// ...

// AFTER (v1.5):
import OpenAI from "openai";
const client = new OpenAI({ apiKey: config.apiKey });
const response = await client.chat.completions.create({
  model: config.model ?? "gpt-4o",
  messages: [{ role: "user", content: prompt }],
  response_format: { type: "json_object" },
});
const raw = JSON.parse(response.choices[0].message.content ?? "{}");
return {
  ...raw,
  model: config.model ?? "gpt-4o",
  tokensUsed: response.usage?.total_tokens,
};
```

### Step 4 — Populate step metadata in EscalationEngine

In v1.5, update `EscalationEngine.createGitHubIssue()` to receive the full step object (not just the finding) so that `stepType`, `failedSelector`, `failedPattern`, and `intent` are populated from the YAML step definition.

### Step 5 — Populate DOM snapshots in StepExecutor

In v1.5, update `StepExecutor.captureEvidence()` to also capture `page.innerHTML('body')` (truncated to ~4000 chars) and pass it through to the finding's `domSnapshot` field. Wire this into `selfHealPayload.domSnippet`.

---

## How the LLM prompt is constructed

The prompt in `llm-relocate.ts` → `buildPrompt()` includes:

1. **Step metadata** — type, ID, persona, scenario, error message
2. **The failed selector or URL pattern**
3. **The intent annotation** — explains what the step was trying to find, in plain English written by the scenario author
4. **The DOM snippet** — a slice of the page HTML near the failure point
5. **Instructions** — asks the LLM for a JSON response matching `SelfHealProposal`

The LLM is instructed to prefer `data-testid` selectors and to return a confidence score. Proposals with confidence below `SELF_HEAL_MIN_CONFIDENCE` are discarded.

---

## Reviewing and applying proposals

When self-healing is active, after a critical halt you'll see:

```
[EscalationEngine] 🔧 Self-heal proposal (confidence: 0.92):
  Proposed selector: [data-testid='portal-root-v2']
  Reasoning: The data-testid attribute was renamed from client-portal-root to portal-root-v2 in the latest deploy. The DOM snippet shows the new attribute value.
```

The full proposal including `yamlPatch` is in the GitHub Issue comment (added automatically in v1.5).

### Applying a proposal

1. Review the proposal in the GitHub Issue comment
2. If the confidence is ≥ 0.85 and the reasoning is sound, apply the `yamlPatch` to the relevant YAML scenario file
3. Run `npx tsx test-all-scenarios.ts` to validate the patched scenario
4. Commit the fix to a feature branch and open a PR
5. Once the PR merges and the fix is confirmed, close the `qa-critical-halt` GitHub Issue to unblock automated runs

### Automated PR creation (future)

In a future sprint, the self-healing loop can be extended to automatically open a GitHub PR with the `yamlPatch` applied, allowing a developer to review and merge with a single click.

---

## Security considerations

**API keys:** Never commit `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to the repository. Store them as GitHub Actions secrets and access via `process.env`.

**LLM output:** Never apply a self-heal proposal automatically without human review. The `minConfidence` threshold is a quality filter, not a trust gate. An LLM can propose a valid-looking selector that passes the test while actually pointing at a different element. Always verify proposals against the actual UI.

**DOM snapshots:** The DOM snippet sent to the LLM may contain application data (client names, email addresses, etc.). Review your LLM provider's data retention policy before enabling self-healing in environments with real user data. Consider enabling self-healing only in the QA staging environment, not against production canary runs.

**GitHub token scope:** The `GITHUB_TOKEN` used by the QA agent needs `issues: write` permission to create critical-halt issues. It does not need repository write access for v1. For the future PR-creation feature, it would need `pull-requests: write` and `contents: write`.

---

## Roadmap

| Version      | Feature                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1 (current) | Stub — logs prompt, no LLM call. selfHealPayload embedded in every critical-halt Issue.                                                            |
| v1.5         | Uncomment LLM SDK call, populate stepType/selector/intent/domSnippet from StepExecutor. LLM proposal logged to console and added as Issue comment. |
| v2           | Automated PR creation with yamlPatch applied. Developer approval workflow. Confidence-gated auto-merge.                                            |
| v2.5         | Multi-step context: send the last N steps (not just the failing step) to give the LLM flow context.                                                |
