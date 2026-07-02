# RankedCEO Autonomous QA Agent — Full Hybrid Plan

**Status:** Planning only — no development started
**Target repo:** `twinwicksllc/rankedceo-crm-production`
**Main at:** `73bb25c`
**Author:** SuperNinja
**Date:** 2026-05-11

---

## 1. Executive Summary

A hybrid autonomous QA agent that:

1. **Runs a deterministic core suite** driven by a YAML scenario catalogue (built first, always runs)
2. **Switches seamlessly between Client and Admin personas** within a single test run (critical requirement)
3. **Continues through non-critical failures**, collecting findings and presenting a consolidated report at the end (critical requirement)
4. **Halts immediately on critical errors** and refuses to resume until explicitly instructed (critical requirement)
5. **Is architected from day one to plug in an LLM self-healing layer later** (planned-for, not built)

The output is a **single HTML report per run**, delivered to the admin, containing pass/fail counts, timelines of actions per persona, screenshots per step, database state snapshots, and highlighted findings grouped by severity.

---

## 2. Guiding Principles

| Principle                                      | Implication                                                                                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Determinism first, intelligence later**      | All v1 behaviour is scripted. LLM hooks exist as stubs we can fill in later.                                                                                                                 |
| **Persona-aware from the core**                | Every step declares its persona. The runtime maintains two independent browser contexts (one per persona) and hot-swaps between them by switching the active context, not by logging out.    |
| **Fail-soft by default, fail-hard when asked** | Every assertion has a `severity` field. Only `critical` stops the run.                                                                                                                       |
| **Report to admin, not to console**            | The final deliverable is the HTML report attached via admin dashboard link. Raw logs are secondary.                                                                                          |
| **Idempotent & cleanup-safe**                  | Every run creates tenants with a traceable prefix (`qa_agent_YYYYMMDD_HHMMSS_`) so they can be archived after the run.                                                                       |
| **Zero human input mid-run**                   | If a step would need human input (e.g. real Stripe card, real domain purchase), it must have a pre-configured test adapter. Otherwise the step is marked `skipped_no_adapter` and continues. |

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    qa-agent/  (new repo or monorepo package)         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐   ┌──────────────────┐   ┌───────────────────┐│
│  │  scenarios/     │ → │   Orchestrator   │ → │   Persona Router  ││
│  │   *.yaml        │   │  (Node/TS)       │   │  (client / admin) ││
│  └─────────────────┘   └──────────────────┘   └───────────────────┘│
│                                │                         │          │
│                                ▼                         ▼          │
│                        ┌──────────────┐          ┌──────────────┐   │
│                        │  Step Runner │          │  Browser Pool│   │
│                        │  (executes)  │◄────────►│  (2 contexts)│   │
│                        └──────────────┘          └──────────────┘   │
│                                │                         │          │
│           ┌────────────────────┼─────────────────────────┤          │
│           ▼                    ▼                         ▼          │
│  ┌─────────────────┐ ┌──────────────────┐      ┌──────────────────┐│
│  │ Assertion Bank  │ │  State Verifier  │      │  Evidence Vault  ││
│  │ (DOM, nav, DB,  │ │  (Supabase/SQL)  │      │ (screenshots,    ││
│  │  response, etc) │ │                  │      │  videos, HAR)    ││
│  └─────────────────┘ └──────────────────┘      └──────────────────┘│
│                                │                         │          │
│                                ▼                         ▼          │
│                        ┌───────────────────────────────────────┐    │
│                        │   Findings Aggregator                 │    │
│                        │   (severity grouping, timeline)       │    │
│                        └───────────────────────────────────────┘    │
│                                        │                            │
│                                        ▼                            │
│                        ┌───────────────────────────────────────┐    │
│                        │   Report Generator (HTML + JSON)      │    │
│                        └───────────────────────────────────────┘    │
│                                        │                            │
└──────────────────────────────────────────┼─────────────────────────┘
                                           │
                                           ▼
                          ┌───────────────────────────────────┐
                          │  Admin Dashboard link: /admin/qa  │
                          │  (new route — Phase 9 add-on)    │
                          └───────────────────────────────────┘
```

### 3.1 Why two browser contexts, not two browsers

Playwright's **`browser.newContext()`** gives you fully isolated cookies/storage/local-storage per persona in the same browser process. Switching personas is `contextA.activate()` vs `contextB.activate()` — sub-millisecond. You never log out.

- `clientContext` — holds the reviewToken in URL, no auth cookies, the "client" UX surface
- `adminContext` — holds the Supabase admin session cookie, sees `/admin/dashboard`
- Both run in parallel windows the human can watch during local dev; headless in CI

---

## 4. Persona Model

### 4.1 Persona Definitions

```typescript
interface Persona {
  name: "client" | "admin";
  contextKey: string; // Playwright browser context key
  baseUrl: string; // e.g. https://qa.rankedceo.com
  authStrategy: AuthStrategy; // how to establish identity
  stateMarkers: string[]; // DOM selectors that prove we're in this persona
  allowedRoutes: RegExp[]; // routes this persona can navigate
  forbiddenRoutes: RegExp[]; // if we end up here, it's a critical error
}

type AuthStrategy =
  | { type: "review_token"; token: string } // client
  | { type: "supabase_session"; email: string; password: string }; // admin
```

### 4.2 The persona switch

```typescript
// Pseudocode
async function switchPersona(to: "client" | "admin") {
  if (currentPersona === to) return;
  logger.persona_switch(currentPersona, to);
  currentContext = contextMap[to];
  currentPage = await currentContext.newPage(); // or reuse existing
  await verifyPersonaMarker(currentPage, to); // DOM assertion
  currentPersona = to;
}
```

Every scenario step declares its persona:

```yaml
- id: client_opens_billing
  persona: client
  action: navigate
  url: /edit/{{reviewToken}}?tab=billing
```

### 4.3 Cross-persona handoffs

These are the interesting moments — when one persona's action produces output the other persona needs:

| Handoff                    | Producer | Consumer | Mechanism                                                               |
| -------------------------- | -------- | -------- | ----------------------------------------------------------------------- |
| Tenant submitted to review | Client   | Admin    | Admin polls `/admin/dashboard` until tenant appears                     |
| Variants ready for review  | Admin    | Client   | Client polls `/review/[tenantId]` until variants are visible            |
| Client approves variant    | Client   | Admin    | Admin refreshes tenant detail page, asserts `client_approval_at` is set |
| Admin deploys site         | Admin    | Client   | Client navigates to tenant's published URL, asserts 200                 |
| Stripe checkout completes  | Client   | Admin    | Admin opens `RevenueWidget`, asserts subscription count incremented     |

Each handoff is its own `handoff` YAML block with a `producer_persona`, `consumer_persona`, `polling_strategy`, and `timeout_ms`.

---

## 5. Scenario DSL (YAML)

### 5.1 Top-level shape

```yaml
# scenarios/full_lifecycle.yaml

metadata:
  name: Full Tenant Lifecycle (client + admin)
  version: 1
  owner: qa-agent
  tags: [smoke, full-lifecycle, critical-path]

globals:
  run_id: "{{ generate_run_id() }}" # e.g. qa_20260512_103045
  business_name: "{{ run_id }}_Test Plumbing"
  email: "qa-{{ run_id }}@rankedceo.test"

preconditions:
  - name: Supabase reachable
    type: http_check
    url: "{{ env.SUPABASE_URL }}/rest/v1/"
    expect_status: 200
    severity: critical
  - name: Test admin account exists
    type: sql_check
    query: "SELECT id FROM users WHERE email = 'qa-admin@rankedceo.test'"
    expect: row_exists
    severity: critical

scenes:
  - id: 01_client_onboarding
    persona: client
    steps: [...]

  - id: 02_handoff_to_admin
    type: handoff
    producer_persona: client
    consumer_persona: admin
    polling: [...]

  - id: 03_admin_variants
    persona: admin
    steps: [...]

  # etc.

postconditions:
  - name: Archive test tenant
    type: sql_action
    query: "UPDATE tenants SET status='cancelled', deleted_at=NOW() WHERE legal_name LIKE '{{ run_id }}%'"
    severity: warning # cleanup failure is not critical
```

### 5.2 Step types

| Type              | Purpose                                     | Example                                                             |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `navigate`        | Open a URL                                  | `url: /get-started`                                                 |
| `click`           | Click element (selector or accessible name) | `target: button:has-text("Continue")`                               |
| `fill`            | Fill form field                             | `target: input[name=business_name]`, `value: "{{ business_name }}"` |
| `select`          | Dropdown selection                          | `target: select[name=industry]`, `value: plumbing`                  |
| `upload`          | Upload file                                 | `target: input[type=file][name=logo]`, `file: fixtures/logo.png`    |
| `wait_for`        | Wait for selector/URL/response              | `selector: text=Variants ready`                                     |
| `assert_dom`      | DOM assertion                               | `selector: h1`, `contains: Welcome`                                 |
| `assert_url`      | URL assertion                               | `matches: /review/[a-f0-9-]+`                                       |
| `assert_sql`      | DB state assertion                          | `query: ...`, `expect: row_count_gte`, `value: 1`                   |
| `assert_network`  | Network response assertion                  | `url: /api/waas/*`, `status: 200`                                   |
| `screenshot`      | Named screenshot                            | `name: client_billing_tab_loaded`                                   |
| `stripe_test_pay` | Drive Stripe Checkout with test card        | `card: 4242...`                                                     |
| `handoff`         | Cross-persona sync point                    | (see above)                                                         |

### 5.3 Severity on every assertion

```yaml
- type: assert_dom
  selector: div[data-testid=error-banner]
  contains: "Something went wrong"
  severity: warning # ← THE KEY FIELD
  # Severity levels:
  #   info      — informational, never affects pass/fail
  #   warning   — recorded in report, run continues
  #   error     — test scene fails, but subsequent scenes run
  #   critical  — STOP THE RUN IMMEDIATELY
```

---

## 6. The "Continue on Non-Critical" Engine

This is your top requirement. Here's the exact model:

### 6.1 Severity taxonomy

| Severity   | Count in pass/fail | Scene continues?           | Next scene runs?            | Run result              |
| ---------- | ------------------ | -------------------------- | --------------------------- | ----------------------- |
| `info`     | No                 | Yes                        | Yes                         | pass                    |
| `warning`  | No                 | Yes                        | Yes                         | pass-with-warnings      |
| `error`    | Yes                | **No** (scene marked fail) | **Yes** (next scene starts) | completed-with-failures |
| `critical` | Yes                | **No**                     | **No — halt immediately**   | halted-critical         |

### 6.2 Auto-escalation rules

Some conditions always escalate regardless of declared severity:

```typescript
// lib/escalation.ts
const ESCALATION_RULES = [
  // If Supabase is unreachable, nothing else matters
  (evt) =>
    evt.type === "sql_check_failure" && evt.error.includes("ECONNREFUSED")
      ? "critical"
      : null,

  // If auth breaks mid-run, we can't trust subsequent steps
  (evt) => (evt.type === "auth_state_lost" ? "critical" : null),

  // If Playwright itself crashes
  (evt) => (evt.type === "browser_crash" ? "critical" : null),

  // If we land on an unexpected URL (e.g. client ended up on /admin/*)
  (evt) => (evt.type === "forbidden_route_entered" ? "critical" : null),

  // If a server 500 happens on any navigation (suggests the app is broken,
  // not just the test)
  (evt) =>
    evt.type === "http_response" &&
    evt.status >= 500 &&
    evt.url.startsWith(env.BASE_URL)
      ? "critical"
      : null,
];
```

### 6.3 The "refuse to resume until instructed" lock

When a critical error fires:

1. Take final screenshot + DOM snapshot + console log dump
2. Write `.qa-agent-lock` file in run output directory containing the run_id, timestamp, and critical error
3. Write `halt.json` with a reason and the exact remaining scenes
4. Kill all browser contexts cleanly
5. Surface a **Critical Halt Report** — short, red, admin-facing
6. Exit with code `2` (vs `0` = pass, `1` = completed-with-failures)

On next invocation, the runner checks for `.qa-agent-lock` in its default output dir:

```bash
qa-agent run scenarios/full_lifecycle.yaml
→ ❌ Previous run halted on critical error at 2026-05-12 10:45:22
→ Reason: auth_state_lost on client persona during 04_client_editor
→ To resume, pass --acknowledge-halt <run_id> or --fresh
```

Admin can then either:

- `--acknowledge-halt <run_id>` — archive the halted run and start a new one
- `--fresh` — same, shorthand
- Investigate, fix, then run again (which still requires the acknowledgement)

This guarantees **no automatic retry after a critical error**, per your spec.

---

## 7. Test Scenario Catalogue (v1 — Deterministic Core)

### 7.1 Scenarios

| ID               | Name                                            | Personas     | ~Steps | Critical Path? |
| ---------------- | ----------------------------------------------- | ------------ | ------ | -------------- |
| `smoke_01`       | Homepage + marketing pages load                 | —            | 8      | Yes            |
| `client_01`      | Full client onboarding                          | client       | 35     | Yes            |
| `client_02`      | Client picks variant on review page             | client       | 12     | Yes            |
| `client_03`      | Client uses editor (all tabs)                   | client       | 45     | Yes            |
| `client_04`      | Client upgrades via Stripe test card            | client       | 20     | Yes            |
| `client_05`      | Client views billing tab post-upgrade           | client       | 10     | Yes            |
| `client_06`      | Client views audit history                      | client       | 8      | No             |
| `admin_01`       | Admin sees new tenant in queue                  | admin        | 10     | Yes            |
| `admin_02`       | Admin triggers AI variant generation            | admin        | 15     | Yes            |
| `admin_03`       | Admin reviews + approves variants               | admin        | 20     | Yes            |
| `admin_04`       | Admin deploys site                              | admin        | 15     | Yes            |
| `admin_05`       | Admin checks revenue dashboard reflects upgrade | admin        | 8      | Yes            |
| `admin_06`       | Admin archives + restores tenant                | admin        | 10     | No             |
| `full_lifecycle` | Composition of all above with handoffs          | client+admin | ~220   | Yes            |
| `edge_01`        | Invalid review token                            | client       | 5      | No             |
| `edge_02`        | Expired/used reviewToken                        | client       | 5      | No             |
| `edge_03`        | Tenant site with missing brand_config           | client       | 5      | No             |
| `edge_04`        | Billing portal with no active sub               | client       | 5      | No             |

### 7.2 Full lifecycle scene list

```
full_lifecycle.yaml
├── 01_smoke_public_marketing          [persona: client]
├── 02_client_onboarding               [persona: client]
├── 03_handoff: client → admin         [client submitted → admin dashboard row]
├── 04_admin_review_initial            [persona: admin]
├── 05_admin_generate_variants         [persona: admin]
├── 06_handoff: admin → client         [variants ready → client review page]
├── 07_client_review_variants          [persona: client]
├── 08_client_pick_variant             [persona: client]
├── 09_client_editor_all_tabs          [persona: client]
├── 10_client_trigger_upgrade          [persona: client]
├── 11_stripe_test_checkout            [persona: client]
├── 12_handoff: stripe → admin         [webhook fired → subscription in DB]
├── 13_admin_verify_revenue_widget     [persona: admin]
├── 14_handoff: admin → client         [admin approves → client sees "Approved"]
├── 15_admin_deploy                    [persona: admin]
├── 16_handoff: admin → client         [deploy complete → published URL live]
├── 17_client_visits_published_site    [persona: client]
├── 18_admin_archive_test_tenant       [persona: admin]  [severity: warning]
└── 19_post_run_cleanup                [sql cleanup]
```

---

## 8. Data & Environment Strategy

### 8.1 Test environments

We recommend **three tiers**:

| Tier             | Purpose                                              | Persistence                    | Stripe mode |
| ---------------- | ---------------------------------------------------- | ------------------------------ | ----------- |
| **Local**        | Dev loop for writing scenarios                       | Reset per run                  | Test mode   |
| **QA (staging)** | CI smoke (every PR) + full lifecycle (weekly Monday) | Cleaned via admin purge action | Test mode   |
| **Prod Canary**  | Read-only smoke tests (no mutations)                 | n/a                            | —           |

Prod canary scenarios are a small subset (homepage, login, pricing page) — **never** run mutating tests against prod.

### 8.2 Test data isolation

Every run creates tenants with a **deterministic prefix**:

```
qa_agent_20260512_103045_*
```

Postconditions archive all tenants matching this prefix. If postconditions fail, the admin purge action in `/admin/qa-scenarios` cleans up any `qa_agent_*` records on demand.

### 8.3 Required env vars

```
QA_BASE_URL                  = https://qa.rankedceo.com
QA_ADMIN_EMAIL               = qa-admin@rankedceo.test
QA_ADMIN_PASSWORD            = {vault}
QA_SUPABASE_URL              = ...
QA_SUPABASE_SERVICE_KEY      = {vault}
QA_STRIPE_TEST_SK            = sk_test_...
QA_MAIL_CAPTURE_URL          = http://mailhog:8025/api/v2
QA_LLM_API_KEY               = {vault, optional — only for self-healing}
QA_OUTPUT_DIR                = ./qa-runs
```

### 8.4 Adapters for external systems

| External                | v1 strategy                                                                                                                                       | Later                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Stripe**              | Use test mode + test cards. Drive checkout form in iframe.                                                                                        | Stripe CLI webhook forward for local   |
| **SendGrid**            | Route to Mailhog SMTP sink in QA env                                                                                                              | Inspect emails via Mailhog API         |
| **Google OAuth**        | **Skip** — use password login for admin persona                                                                                                   | Later: Playwright service-account flow |
| **Namecheap / Route53** | **Stub** — intercept the API call, return mock response                                                                                           | Later: real sandbox accounts           |
| **Vercel Deploy**       | Hit `/api/waas/admin/deploy` and assert DB status transitions. Don't wait for real build.                                                         | Later: poll Vercel API                 |
| **reCAPTCHA v3**        | Use Google's [test keys](https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha) — always returns success | —                                      |

---

## 9. Reporting

### 9.1 What the admin sees

At `/admin/qa/runs/[runId]`:

**Page 1 — Executive Summary**

- Run ID, timestamp, duration, triggered-by
- Overall result badge: ✅ Pass / ⚠️ Pass-with-warnings / ❌ Failures / 🚨 Halted-critical
- Counts: scenarios run, pass, fail, warnings, skipped
- Top 3 most severe findings (linked to detail)

**Page 2 — Persona Timeline**

- Two swimlanes (client / admin) with colored blocks per scene
- Handoff arrows between swimlanes
- Click a block → jump to its detail

**Page 3 — Findings**

- Filtered/sortable list: severity, persona, scene, timestamp
- Each finding has: screenshot thumbnail, DOM snapshot link, SQL state link, console log excerpt

**Page 4 — Evidence Vault**

- All screenshots, videos (if recorded), HAR files, full DOM snapshots
- Downloadable as a single ZIP

### 9.2 File layout per run

```
qa-runs/
  20260512_103045_<run_id>/
    manifest.json              # scene list + final status
    report.html                # standalone admin-facing report
    findings.json              # structured findings list
    timeline.json              # for UI timeline rendering
    screenshots/
      01_smoke/
        step_03_homepage.png
        step_05_pricing_table.png
      02_client_onboarding/
        ...
    videos/
      client_full.webm
      admin_full.webm
    har/
      client.har
      admin.har
    dom_snapshots/
      step_03.html
    db_snapshots/
      pre_run.sql
      post_run.sql
    logs/
      orchestrator.log
      console_client.log
      console_admin.log
    halt.json                  # only present if run was halted
```

### 9.3 The admin UI page

**New route to add (not in scope of v1 build — plan only):**

```
app/admin/qa/
  page.tsx                     → list recent runs
  runs/[runId]/page.tsx        → full report viewer
  runs/[runId]/evidence/page.tsx → evidence vault
```

Data source: static files from `qa-runs/` uploaded to Supabase Storage or served from the QA agent's own web server.

---

## 10. Self-Healing Layer (Deferred — v1.5)

### 10.1 What self-healing means here

When a selector breaks (e.g. the "Billing" tab button changes from `[data-tab=billing]` to `[data-testid=billing-tab]`), the agent:

1. Captures the broken step's expected context (surrounding text, aria-labels, visual region)
2. Sends to LLM: "Find the element matching this intent in this DOM"
3. LLM returns a candidate selector
4. Agent retries the step with the candidate
5. If it works → logs it as `self_healed` (warning), updates a local "selector learning" cache
6. If it doesn't work → escalates as originally planned

### 10.2 Where the hooks go in v1

Even though we don't build the LLM layer in v1, we plant the hooks:

```typescript
// In each assertion:
interface Step {
  selector?: string;
  selectorIntent?: {
    role?: string; // e.g. "button"
    accessibleName?: string; // e.g. "Billing tab"
    nearText?: string; // e.g. "Manage billing"
    // ...
  };
  onSelectorMiss?: "fail" | "self_heal"; // v1: always 'fail'
}
```

Every YAML step has an optional `intent:` block. In v1 we ignore it. In v1.5 we use it to rebuild selectors when the primary one fails.

### 10.3 Cost & integration plan for v1.5

- LLM: Claude 3.5 Sonnet or GPT-4o via JSON mode
- Budget: ~$0.02/selector rebuild × maybe 20 rebuilds per full run = ~$0.40/run
- Integration point: single function `await llmRelocateSelector(intent, domSnapshot)` called from the step runner on miss
- Controlled by env flag: `QA_ENABLE_SELF_HEALING=true`

**Critical constraint:** self-healing is never allowed to upgrade a step from `fail` to `pass` silently. If a selector was self-healed, the step result becomes `pass_with_self_heal` which shows distinctly in the report.

---

## 11. CI/CD Integration

### 11.1 GitHub Actions workflow

```yaml
# .github/workflows/qa-agent.yml
name: QA Agent

on:
  push: { branches: [main] }
  schedule:
    - cron: "0 6 * * 1" # 06:00 UTC every Monday (weekly full run)
  workflow_dispatch:
    inputs:
      scenario:
        type: choice
        options: [smoke, full_lifecycle, edge_cases, all]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run qa-agent -- --scenario ${{ inputs.scenario || 'smoke' }}
      - uses: actions/upload-artifact@v4
        with:
          name: qa-run-${{ github.run_id }}
          path: qa-runs/
```

### 11.2 Run tiers

| Trigger              | Scenarios                     | Env                      | Expected runtime |
| -------------------- | ----------------------------- | ------------------------ | ---------------- |
| Push to PR           | `smoke`                       | ephemeral Vercel preview | ~3 min           |
| Merge to main        | `smoke + critical_path`       | QA                       | ~8 min           |
| Nightly cron         | `full_lifecycle + edge_cases` | QA                       | ~25 min          |
| Manual dispatch      | any                           | any                      | variable         |
| Prod canary (hourly) | `smoke_readonly`              | prod                     | ~90s             |

---

## 12. Project Structure

```
qa-agent/                         # New package (can live in same monorepo)
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── src/
│   ├── orchestrator/
│   │   ├── run.ts                # main entry
│   │   ├── scenario-loader.ts
│   │   ├── step-runner.ts
│   │   ├── persona-router.ts
│   │   ├── handoff-manager.ts
│   │   └── escalation.ts
│   ├── personas/
│   │   ├── client.ts
│   │   ├── admin.ts
│   │   └── base.ts
│   ├── assertions/
│   │   ├── dom.ts
│   │   ├── url.ts
│   │   ├── sql.ts
│   │   ├── network.ts
│   │   └── email.ts
│   ├── adapters/
│   │   ├── stripe.ts
│   │   ├── mail.ts
│   │   ├── supabase.ts
│   │   ├── namecheap-stub.ts
│   │   └── vercel-stub.ts
│   ├── evidence/
│   │   ├── screenshot.ts
│   │   ├── dom-snapshot.ts
│   │   └── har.ts
│   ├── reporting/
│   │   ├── findings-aggregator.ts
│   │   ├── html-report.ts
│   │   └── timeline.ts
│   ├── selfhealing/
│   │   ├── intent-matcher.ts     # stub in v1
│   │   └── llm-relocate.ts       # stub in v1
│   └── cli.ts
├── scenarios/
│   ├── smoke.yaml
│   ├── client_full.yaml
│   ├── admin_full.yaml
│   ├── full_lifecycle.yaml
│   └── edge_cases.yaml
├── fixtures/
│   ├── logo.png
│   ├── brand_photo.jpg
│   └── stripe_test_cards.json
└── docs/
    ├── README.md
    ├── writing-scenarios.md
    └── persona-handoffs.md
```

---

## 13. Sprint Plan (2.5 weeks total)

### Sprint 1 — Foundation (3 days)

- Monorepo scaffolding: `qa-agent/` package at repo root
- Playwright setup, 2-context persona router (client + admin)
- Supabase `qa` schema setup + query adapter + admin auth helper
- Client reviewToken auth helper
- Basic orchestrator + YAML scenario loader
- `smoke.yaml` — first working scenario (no billing, no email)
- Evidence capture (screenshots + DOM snapshots)
- `data-testid` attributes added to key app elements for selector stability

**Deliverable:** `npm run qa-agent -- --scenario smoke` runs against Vercel preview and produces a report.

### Sprint 2 — Critical Path (4 days)

- Step types: navigate / click / fill / wait_for / assert_*
- Handoff manager (polling + timeout + failure paths)
- Escalation engine with severity taxonomy
- Critical halt: Resend email + GitHub Issue auto-create with label `qa-critical-halt`
- Restart gate: agent checks for open `qa-critical-halt` issue before running
- `client_full.yaml` and `admin_full.yaml` scenarios
- Stripe test-card adapter (real test mode for weekly run)
- Resend test-mode email adapter (weekly run only)

**Deliverable:** `full_lifecycle.yaml` runs end-to-end against `qa.rankedceo.com` and produces a report.

### Sprint 3 — Reporting & Admin UI (3 days)

- Findings aggregator
- HTML report generator (standalone, viewable offline)
- Timeline view (swimlanes per persona)
- Evidence vault packaging
- **New admin routes:**
  - `/admin/qa-reports` — lists historical runs, serves HTML reports
  - `/admin/qa-scenarios` — form UI to create/edit/delete scenarios (stored in `qa` schema)
- Report push: dashboard widget + Resend email to admin + GitHub Actions summary
- GitHub Actions CI: smoke on every PR, full lifecycle on weekly cron (`0 6 * * 1` — Monday 06:00 UTC)

**Deliverable:** Admin can open `/admin/qa-reports`, see run history, and manage scenarios via `/admin/qa-scenarios`.

### Sprint 4 — Edge Cases & Hardening (2 days)

- Edge case scenarios (`edge_01` through `edge_04`)
- Cleanup tooling: admin action to purge all `qa_agent_*` records from `qa` schema
- Prod canary scenarios (read-only smoke against prod)
- Documentation: writing new scenarios via UI, persona handoff patterns, purging QA data

**Deliverable:** Full v1 done, CI running weekly.

### Sprint 5 — Self-healing Prep (1 day)

- Add `intent:` blocks to existing scenarios (LLM not wired yet)
- Stub `llm-relocate.ts` with a clear interface and TODO
- Document how the GitHub Issue halt gate feeds directly into LLM self-healing (Issue = context payload)
- Write `docs/self-healing.md` explaining how to activate v1.5

**Deliverable:** v1 complete, v1.5 plug-and-play ready — GitHub Issue gate is the LLM entry point.

---

## 14. Risks & Mitigations

| Risk                                                 | Impact                                 | Mitigation                                                                                         |
| ---------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| QA env drifts from prod                              | Tests pass in QA, fail in prod         | Weekly schema diff check between `qa` schema and `public` schema                                   |
| Stripe test webhooks arrive late → handoff times out | False critical halt                    | Longer `handoff_timeout_ms` (60s) + `pre_flush_webhooks` step                                      |
| Brittle CSS selectors                                | Everything breaks on minor UI change   | `data-testid` attributes added to all key elements in Sprint 1                                     |
| reCAPTCHA blocks agent                               | Blocks all form submits                | Use Google's test keys in QA env only                                                              |
| QA tenant bloat                                      | DB clutter                             | Admin-UI purge action + clear `qa_agent_YYYYMMDD_` tagging                                         |
| Two personas race on same tenant                     | False failures                         | Handoffs have explicit barrier points. No persona acts until handoff resolves.                     |
| GitHub Issue gate misconfigured                      | Agent runs despite open critical issue | Label check is strict: `qa-critical-halt` + `open` state. Tested in Sprint 2.                      |
| Self-healing hides real bugs                         | v1.5 masks regressions                 | `pass_with_self_heal` always reported distinctly; regression dashboard flags increasing heal rate. |

---

## 15. Decisions Log ✅

All 7 pre-development decisions answered and locked.

| #   | Question               | Decision                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **QA Environment**     | Hybrid — Vercel preview URLs for PR smoke tests; `qa.rankedceo.com` for **weekly** full lifecycle runs                                                                                                                                                                                                                                |
| 2   | **Database**           | Same Supabase project, `qa` schema. All agent records prefixed `qa_agent_YYYYMMDD_HHMMSS_` for easy identification and purge. Real clients are never mixed with agent runs.                                                                                                                                                           |
| 3   | **Stripe / Billing**   | Mocked on PR smoke tests (fast, no webhook). Real Stripe test mode (`4242 4242 4242 4242`) on weekly full run — real checkout, real webhook to `qa.rankedceo.com`, DB verified.                                                                                                                                                       |
| 4   | **Email Testing**      | Skip email verification on smoke tests. Resend test mode on weekly full run — agent verifies delivery via Resend logs API.                                                                                                                                                                                                            |
| 5   | **Report Delivery**    | All three channels — `/admin/qa-reports` dashboard widget (persistent), email to admin via Resend (immediate), GitHub Actions workflow summary (CI traceability). One HTML report, three push targets.                                                                                                                                |
| 6   | **Critical Halt**      | Email (immediate, via Resend) + auto-created GitHub Issue with label `qa-critical-halt`, full error context, stack trace, screenshot attached. Issue is the restart gate — agent checks for open `qa-critical-halt` issue before running. **v1.5 self-healing hook**: LLM reads the Issue, attempts fix, closes Issue, agent resumes. |
| 7   | **Scenario Authoring** | Admin UI in dashboard (form-based, no code required). Scenarios stored in `qa` schema. Dev can still seed via YAML CLI import for bulk loads.                                                                                                                                                                                         |

---

## 16. Acceptance Criteria for v1

- [ ] Can run `qa-agent run scenarios/full_lifecycle.yaml` and see the run complete (pass or fail) without any mid-run human input
- [ ] Client and admin personas both exercise their full route surface
- [ ] At least 5 cross-persona handoffs tested (client → admin and admin → client)
- [ ] Severity model enforced: `warning` never halts, `critical` always halts
- [ ] On critical halt: Resend email fires + GitHub Issue auto-created with label `qa-critical-halt`; agent refuses to run while issue is open
- [ ] HTML report pushed to: `/admin/qa-reports` dashboard widget + admin email + GitHub Actions summary
- [ ] Evidence vault (screenshots + DOM snapshots + DB snapshots) captured per step
- [ ] CI runs smoke suite on every PR (mocked billing, skip email); full lifecycle runs weekly on `qa.rankedceo.com`
- [ ] Zero false positives on critical-severity findings in 3 consecutive weekly runs
- [ ] Admin UI at `/admin/qa-scenarios` — form to create/edit/delete test scenarios (stored in `qa` schema)
- [ ] QA records clearly tagged `qa_agent_YYYYMMDD_` and purgeable via single admin action
- [ ] Stripe test mode exercised end-to-end on weekly run: checkout → webhook → DB state verified

---

## 17. Out of Scope for v1

- LLM-powered self-healing (planned for v1.5)
- LLM-powered exploratory testing (v2)
- Load testing / performance benchmarking
- Visual regression testing (screenshot diffs) — planned for v1.5 alongside self-healing
- Mobile viewport testing — add in v2
- Accessibility audits (axe-core integration) — easy add, defer to v1.5
- Multi-language / i18n testing

---

## 18. The One-Line Summary

> **A deterministic Playwright-based QA agent with two parallel browser contexts (client + admin), a YAML scenario DSL, a severity-gated execution engine that continues on warnings/errors and halts on critical, a cross-persona handoff model, and an HTML report the admin views at `/admin/qa`. Self-healing LLM layer planned as a drop-in enhancement for v1.5.**
