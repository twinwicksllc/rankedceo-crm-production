# RankedCEO QA Agent

A persona-aware, scenario-driven automated QA system for the RankedCEO WaaS platform. The agent runs Playwright-backed end-to-end tests across two browser contexts simultaneously (admin and client), records findings with severity tags, generates standalone HTML reports, and delivers results via three channels: Supabase, Resend email, and GitHub Actions step summaries.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Run Modes](#run-modes)
- [Severity Taxonomy](#severity-taxonomy)
- [Critical Halt & Restart Gate](#critical-halt--restart-gate)
- [Directory Structure](#directory-structure)

---

## Architecture Overview

```
qa-agent/
├── src/
│   ├── types.ts                  # Core types: Persona, Step variants, Finding, RunReport
│   ├── cli.ts                    # Entry point — parses args, builds RunConfig, calls Orchestrator
│   ├── orchestrator/
│   │   ├── Orchestrator.ts       # Main run loop: gate → load → execute → dispatch
│   │   ├── EscalationEngine.ts   # Severity routing, critical halt, GitHub Issue creation
│   │   └── ScenarioLoader.ts     # YAML → Zod validation → typed Scenario
│   ├── steps/
│   │   └── StepExecutor.ts       # Executes individual steps with retry + timeout support
│   ├── personas/
│   │   └── PersonaRouter.ts      # Dual Playwright contexts (admin + client)
│   ├── adaptors/
│   │   ├── supabase/SupabaseAdapter.ts  # Supabase qa schema queries
│   │   ├── stripe/StripeAdapter.ts      # Stripe test / mock mode
│   │   └── email/EmailAdapter.ts        # Resend test / skip mode
│   └── reporting/
│       ├── ReportGenerator.ts    # Standalone dark-theme HTML report
│       └── ReportDispatcher.ts   # 3-channel delivery: Supabase + Resend + GitHub Summary
└── scenarios/
    ├── smoke.yaml                # 23-step smoke (every PR)
    ├── full_lifecycle.yaml       # 44-step full lifecycle (weekly)
    ├── edge_01_auth_failure.yaml # Auth edge cases (smoke + full)
    ├── edge_02_billing_error.yaml# Billing / declined card (full only)
    ├── edge_03_empty_state.yaml  # Zero-data rendering (smoke + full)
    ├── edge_04_webhook_timeout.yaml # Webhook delay / idempotency (full only)
    └── canary_prod_readonly.yaml # Production read-only canary (smoke)
```

The **Orchestrator** is the central coordinator. It checks the restart gate (open GitHub Issues labeled `qa-critical-halt`), loads the chosen YAML scenario via `ScenarioLoader`, initialises a `PersonaRouter` (dual Playwright contexts), then runs each step through `StepExecutor`. The `EscalationEngine` receives every finding and fires notifications on `critical` severity. At the end, `ReportDispatcher` pushes results to all three channels.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` or `--base-url` | ✅ | Base URL to test against (e.g. `https://qa.rankedceo.com`) |
| `QA_ADMIN_EMAIL` | ✅ | Admin user email for the admin Playwright context |
| `QA_ADMIN_PASSWORD` | ✅ | Admin user password |
| `QA_CLIENT_REVIEW_TOKEN` | ✅ | A valid review token for the client Playwright context |
| `QA_SUPABASE_URL` | ✅ in CI | QA Supabase project URL dedicated to QA runs |
| `QA_SUPABASE_SERVICE_ROLE_KEY` | ✅ in CI | QA Supabase service role key (full access to `qa` schema) |
| `SUPABASE_URL` | ✅ (runtime fallback) | Supabase project URL consumed by the adapter |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (runtime fallback) | Service role key consumed by the adapter |
| `RESEND_API_KEY` | ✅ | Resend API key for report email delivery |
| `QA_REPORT_TO_EMAIL` | ✅ | Email address to receive QA run reports |
| `GITHUB_TOKEN` | ✅ in CI | GitHub token for critical halt issue creation and restart gate |
| `GITHUB_REPO` | ✅ in CI | `owner/repo` string (e.g. `twinwicksllc/rankedceo-crm-production`) |
| `BILLING_MOCK` | optional | Set to `true` to skip real Stripe test mode (auto-set in smoke mode) |

### Secrets setup in GitHub

All variables above (except `BILLING_MOCK`) are stored as GitHub Actions secrets under `Settings → Secrets and variables → Actions`. The workflows reference them via `${{ secrets.VARIABLE_NAME }}`.

---

## Running Locally

**Prerequisites:** Node 20+ (24+ recommended), `npm install` completed in the `qa-agent/` directory, Playwright browsers installed (`npx playwright install --with-deps chromium`).

### Smoke run (no Stripe, no email)

```bash
cd qa-agent
BILLING_MOCK=true \
QA_ADMIN_EMAIL=admin@example.com \
QA_ADMIN_PASSWORD=yourpassword \
QA_CLIENT_REVIEW_TOKEN=your-token \
QA_SUPABASE_URL=https://xxx.supabase.co \
QA_SUPABASE_SERVICE_ROLE_KEY=xxx \
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
RESEND_API_KEY=re_xxx \
QA_REPORT_TO_EMAIL=you@example.com \
GITHUB_TOKEN=ghp_xxx \
GITHUB_REPO=twinwicksllc/rankedceo-crm-production \
npx tsx src/cli.ts --scenario scenarios/smoke.yaml --mode smoke
```

### Full lifecycle run (Stripe test mode)

```bash
cd qa-agent
# BILLING_MOCK not set → Stripe test mode activates
QA_ADMIN_EMAIL=admin@example.com \
# ... (other env vars) ...
npx tsx src/cli.ts --scenario scenarios/full_lifecycle.yaml --mode full
```

### Running an edge case scenario

```bash
npx tsx src/cli.ts --scenario scenarios/edge_01_auth_failure.yaml --mode smoke
npx tsx src/cli.ts --scenario scenarios/edge_03_empty_state.yaml --mode full
```

### Running the production canary

> ⚠️ The canary runs against **live production**. Always set `BILLING_MOCK=true`.
> Use a dedicated read-only review token that belongs to a canary test account.

```bash
BILLING_MOCK=true \
# BASE_URL should point to https://app.rankedceo.com
npx tsx src/cli.ts --scenario scenarios/canary_prod_readonly.yaml --mode smoke
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Run passed (with or without informational findings) |
| `1` | Run ended with `error` or `critical_halt` status |

---

## GitHub Actions Workflows

### `qa-smoke.yml` — every PR

Triggers on every pull request to `main`. Runs the smoke scenario against the Vercel preview URL deployed for that PR. Posts the result as a PR comment via `gh pr comment`. Uses `BILLING_MOCK=true` so no Stripe calls are made.

### `qa-weekly.yml` — Monday 06:00 UTC

Triggers on a cron schedule (`0 6 * * 1`). Runs the full lifecycle scenario against `https://qa.rankedceo.com` with Stripe test mode enabled. Appends a markdown summary to the GitHub Actions step summary (visible in the Actions UI run detail). Also dispatches an HTML report email via Resend.

---

## Run Modes

| Mode | Triggered by | Stripe | Email | Scenarios |
|---|---|---|---|---|
| `smoke` | Every PR | Mocked | Skipped | `smoke.yaml`, `edge_01`, `edge_03`, `canary_prod_readonly` |
| `full` | Weekly cron (Monday) | Test mode (4242…) | Resend test mode | All scenarios |

The `modes:` field in each YAML scenario file controls which modes the scenario is eligible to run in. The CLI's `--mode` flag selects the run mode; the `Orchestrator` enforces compatibility.

---

## Severity Taxonomy

| Level | Behaviour | Example |
|---|---|---|
| `info` | Logged only, run continues | Navigation step, persona handoff |
| `warning` | Logged + counted, run continues | Non-critical UI element missing |
| `error` | Logged + counted, run continues, status becomes `pass_with_findings` | Form element not found |
| `critical` | Run halts immediately, Resend email fired, GitHub Issue opened | Redirect after failed auth, portal down in production |

The `EscalationEngine` governs this behaviour. Only one `critical` finding is needed to trigger a halt.

---

## Critical Halt & Restart Gate

When a `critical` finding is recorded:

1. `EscalationEngine.fireCriticalNotifications()` runs in parallel:
   - Sends an email via Resend to `QA_REPORT_TO_EMAIL` with step details and `intent` context
   - Creates a GitHub Issue on `GITHUB_REPO` with label `qa-critical-halt`, the full finding, and a `selfHealPayload` JSON block (v1.5 LLM hook)

2. The run halts with status `critical_halt`. Exit code is `1`.

3. **Before the next automated run can start**, `EscalationEngine.checkRestartGate()` queries the GitHub API for open issues with label `qa-critical-halt`. If any exist, the run is blocked with a `RestartGateError`. The gate is cleared by closing the GitHub Issue manually after the fix is deployed.

This ensures the QA agent never silently retries past a known-critical failure.

---

## Directory Structure

```
qa-agent/
├── package.json          # Dependencies: playwright, js-yaml, zod, @supabase/supabase-js
├── tsconfig.json         # TypeScript config (ESNext, module resolution node)
├── src/                  # TypeScript source
│   └── ...
├── scenarios/            # YAML scenario files
│   └── ...
└── evidence/             # Screenshot + DOM snapshot output (gitignored)
    └── {runId}/
        └── {persona}_{stepId}_{ts}.png
```

The `evidence/` directory is created at runtime and is gitignored. Screenshots are referenced in the HTML report as relative paths — when viewing a local report, open it from the `evidence/` parent directory so the image links resolve correctly.
