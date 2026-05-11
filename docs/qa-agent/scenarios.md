# QA Agent — Scenario DSL Reference

This document describes every field in the QA Agent scenario YAML format and explains how to write new scenarios, both by hand and via the Admin UI.

---

## Table of Contents

- [Top-Level Scenario Fields](#top-level-scenario-fields)
- [Step Types Reference](#step-types-reference)
  - [navigate](#navigate)
  - [fill](#fill)
  - [click](#click)
  - [wait_for](#wait_for)
  - [assert_text](#assert_text)
  - [assert_url](#assert_url)
  - [assert_db](#assert_db)
  - [handoff](#handoff)
  - [pause](#pause)
- [Base Fields (all steps)](#base-fields-all-steps)
- [Writing Scenarios via the Admin UI](#writing-scenarios-via-the-admin-ui)
- [Persona Handoff Patterns](#persona-handoff-patterns)
- [Selector Strategy](#selector-strategy)
- [Annotating Steps for Self-Healing (v1.5)](#annotating-steps-for-self-healing-v15)
- [Validation Rules](#validation-rules)

---

## Top-Level Scenario Fields

```yaml
id: my_scenario_id          # Unique identifier (snake_case, no spaces)
name: "Human Readable Name" # Displayed in reports and Admin UI
description: >              # Optional multi-line description
  What this scenario tests and why.
modes:                      # At least one of: smoke, full
  - smoke
  - full
requires_stripe: true       # Optional — documents Stripe test mode dependency
requires_email: true        # Optional — documents Resend test mode dependency

steps:                      # Flat list of steps (see Step Types below)
  - id: step_01
    type: navigate
    ...
```

### `modes` values

| Value | When it runs |
|---|---|
| `smoke` | Every PR (fast, no Stripe, no email) |
| `full` | Weekly Monday cron (Stripe test mode, Resend test mode) |

A scenario with `modes: [smoke, full]` will run in both contexts. A scenario with `modes: [full]` only runs in the weekly job.

---

## Step Types Reference

### navigate

Navigate the specified persona's browser context to a URL.

```yaml
- id: step_01_go_to_dashboard
  type: navigate
  persona: admin
  severity: info
  url: "{{ BASE_URL }}/admin/dashboard"
  description: "Navigate to admin dashboard"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `url` | ✅ | Full URL. Use `{{ BASE_URL }}` for the run's base URL |

---

### fill

Fill a form input with a value.

```yaml
- id: step_02_fill_email
  type: fill
  persona: admin
  severity: info
  selector: "[data-testid='admin-email']"
  value: "{{ ADMIN_EMAIL }}"
  description: "Fill admin email address"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `selector` | ✅ | CSS selector for the input. Prefer `data-testid` attributes. |
| `value` | ✅ | Value to type. Use template vars for sensitive values. |

Pass an empty string `""` to clear a field.

---

### click

Click an element.

```yaml
- id: step_03_submit
  type: click
  persona: admin
  severity: error
  selector: "[data-testid='admin-login-submit']"
  description: "Submit the login form"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `selector` | ✅ | CSS selector for the element to click |

---

### wait_for

Wait for a selector to appear in the DOM.

```yaml
- id: step_04_wait_modal
  type: wait_for
  persona: client
  severity: info
  selector: "[data-testid='checkout-modal']"
  timeout_ms: 8000
  description: "Wait for checkout modal to appear"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `selector` | ✅ | CSS selector to wait for |
| `timeout_ms` | optional | How long to wait (default: 10000ms) |

---

### assert_text

Assert that an element contains a specific string.

```yaml
- id: step_05_assert_heading
  type: assert_text
  persona: admin
  severity: error
  selector: "[data-testid='admin-dashboard-heading']"
  contains: "Dashboard"
  description: "Dashboard heading must contain 'Dashboard'"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `selector` | ✅ | CSS selector for the element |
| `contains` | ✅ | String that must appear in the element's text content. Pass `""` (empty string) to only assert the element exists and is non-null. |
| `timeout_ms` | optional | How long to wait for the element before asserting (default: 10000ms) |

---

### assert_url

Assert that the current URL matches a pattern.

```yaml
- id: step_06_assert_on_dashboard
  type: assert_url
  persona: admin
  severity: critical
  pattern: "/admin/dashboard"
  description: "Must be on the admin dashboard after login"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `pattern` | ✅ | A string or regex pattern tested against the full current URL |

The pattern is compiled as a `RegExp`. A plain string like `/admin/dashboard` will match any URL containing that substring.

---

### assert_db

Assert a row count in the Supabase `qa` schema.

```yaml
- id: step_07_check_sub
  type: assert_db
  persona: admin
  severity: critical
  table: "subscriptions"
  where:
    tenant_id: "{{ TENANT_ID }}"
    status: "active"
  expected_count: 1
  description: "Exactly one active subscription must exist after upgrade"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `table` | ✅ | Table name (without schema prefix — always runs in `qa` schema via `SupabaseAdapter`) |
| `where` | ✅ | Key-value filter object. All conditions are ANDed. |
| `expected_count` | ✅ | Exact number of rows expected matching the filter |

> **Note:** `assert_db` queries the `qa` schema only, not the `public` schema. To check production data, you must use a `public.` prefixed table name via a custom adapter (not yet supported in v1).

---

### handoff

Switch the active persona from one browser context to another.

```yaml
- id: step_08_switch_to_client
  type: handoff
  persona: admin
  severity: info
  from: admin
  to: client
  message: "Admin setup complete — switching to client portal"
  description: "Cross-persona handoff: admin → client"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `from` | ✅ | The persona whose turn is ending |
| `to` | ✅ | The persona who acts next |
| `message` | ✅ | Human-readable description of the handoff context |
| `handoff_timeout_ms` | optional | How long to wait for the new context to stabilise (default: 1000ms) |

The `persona` field on a handoff step must match `from`. The next step should have `persona` set to `to`.

---

### pause

Wait for a fixed number of milliseconds.

```yaml
- id: step_09_wait_webhook
  type: pause
  persona: client
  severity: info
  duration_ms: 5000
  description: "Wait 5s for Stripe webhook to fire"
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `duration_ms` | ✅ | Milliseconds to wait |

Use `pause` sparingly. Prefer `wait_for` with a selector when possible. Reserve `pause` for external async events (webhooks, emails) where no DOM selector is available.

---

## Base Fields (all steps)

Every step type inherits these fields:

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique step ID within the scenario. Convention: `{scenario_prefix}_s{nn}_{action}` |
| `type` | ✅ | One of: `navigate`, `fill`, `click`, `wait_for`, `assert_text`, `assert_url`, `assert_db`, `handoff`, `pause` |
| `persona` | ✅ | Which browser context executes this step: `admin` or `client` |
| `severity` | ✅ | Governs what happens on failure: `info`, `warning`, `error`, `critical` |
| `description` | optional | Human-readable step description. Shown in reports. |
| `intent` | optional | v1.5 self-healing annotation. See [below](#annotating-steps-for-self-healing-v15). |
| `retries` | optional | Number of retry attempts on failure. Default: `0`. Max recommended: `2`. |
| `timeout_ms` | optional | Per-step timeout override in ms (used by `wait_for` and `assert_text`). Default: `10000`. |

---

## Writing Scenarios via the Admin UI

The `/admin/qa-scenarios` page provides a form-based interface to create and manage scenarios stored in the `qa.qa_scenarios` Supabase table.

### Creating a new scenario

1. Navigate to `/admin/qa-scenarios`
2. Fill in the **Scenario ID** field (snake_case, e.g. `my_new_scenario`)
3. Fill in the **Name** field (human-readable, e.g. "My New Scenario")
4. Toggle the **Modes** buttons to select `smoke`, `full`, or both
5. Optionally check **Requires Stripe** or **Requires Email**
6. Paste or edit your YAML in the **YAML Content** textarea. A starter template is pre-filled.
7. Click **Save Scenario**

The step count is automatically derived by counting `  - id:` lines in your YAML before saving.

### Editing and toggling scenarios

Click any scenario in the list to expand its YAML preview. Use the **toggle** button to activate or deactivate a scenario without deleting it. Inactive scenarios are skipped during automated runs.

### Deleting scenarios

Click the **Delete** button on a scenario card. A confirmation prompt prevents accidental deletion.

> **Note:** Scenarios stored in the Admin UI are loaded from the database, not from YAML files on disk. The file-based scenarios in `qa-agent/scenarios/` are always loaded directly by the CLI and GitHub Actions. The UI is intended for custom one-off scenarios added by the ops team without requiring a code deployment.

---

## Persona Handoff Patterns

The QA agent runs two Playwright browser contexts simultaneously — one for `admin` and one for `client`. Steps are executed sequentially in the order they appear in `steps:`, but each step specifies which context runs it via `persona:`.

### Basic handoff

```yaml
# Admin does something, then hands off to client
- id: setup_01
  type: navigate
  persona: admin
  ...

- id: handoff_to_client
  type: handoff
  persona: admin
  from: admin
  to: client
  message: "Admin setup complete"
  severity: info

- id: client_01
  type: navigate
  persona: client
  ...
```

### Returning handoff

After the client completes their steps, hand back to admin:

```yaml
- id: handoff_back_to_admin
  type: handoff
  persona: client
  from: client
  to: admin
  message: "Client actions complete — returning to admin for verification"
  severity: info

- id: admin_verify_01
  type: assert_text
  persona: admin
  ...
```

### Multi-handoff lifecycle

The `full_lifecycle.yaml` scenario contains 5 handoffs. For complex flows:

1. Group logically related steps with YAML comments (`# -- Scene N: description`)
2. Each comment block should begin and end at a `handoff` step when changing persona
3. The `message` on each `handoff` step should summarise what was accomplished and why the switch is happening

---

## Selector Strategy

All selectors should use `data-testid` attributes, which are added to components in Sprint 2. This makes selectors stable across CSS/class renames and visual redesigns.

### Naming convention for `data-testid`

| Pattern | Example |
|---|---|
| `{page}-{element}` | `admin-dashboard-root`, `qa-reports-heading` |
| `portal-tab-{tabId}` | `portal-tab-overview`, `portal-tab-billing`, `portal-tab-reviews` |
| `{tab}-tab-content` | `overview-tab-content`, `billing-tab-content`, `reviews-tab-content` |
| `upgrade-plan-card-{tier}` | `upgrade-plan-card-pro`, `upgrade-plan-card-enterprise` |
| `upgrade-btn-{tier}` | `upgrade-btn-pro`, `upgrade-btn-enterprise` |
| `admin-email`, `admin-password` | Login form fields |
| `admin-login-submit` | Login submit button |
| `waas-clients-table` | WaaS clients table container |
| `revenue-widget` | Revenue MRR widget |
| `qa-runs-table` | QA run history table |
| `scenario-card-{id}` | Individual scenario card in list |
| `new-scenario-id` | New scenario form ID field |
| `new-scenario-submit` | New scenario form submit button |

When adding a new feature that QA scenarios need to test, add `data-testid` attributes to the new components at the same time as writing the scenario.

---

## Annotating Steps for Self-Healing (v1.5)

Every step supports an optional `intent` field. This is a plain-English description of what the step is trying to accomplish and why, written for an LLM to read.

```yaml
- id: step_05_assert_portal_root
  type: assert_text
  persona: client
  severity: critical
  selector: "[data-testid='client-portal-root']"
  contains: ""
  intent: >
    The client portal root div is the outermost wrapper of portal-shell.tsx.
    If this element is missing, the portal component failed to mount.
    In v1.5, an LLM should look for the largest div inside the /edit/:token
    page body and re-derive a stable selector if data-testid was removed.
```

In v1.5, when a step fails, the `intent` field will be sent to an LLM alongside the current DOM snapshot and the failing step details. The LLM will attempt to:
1. Re-derive the selector based on intent
2. Propose a patch to the YAML scenario
3. Open a GitHub PR with the proposed fix

The JSON payload for this is already embedded in every critical-halt GitHub Issue body as `selfHealPayload`. See `docs/qa-agent/self-healing.md` for activation instructions.

---

## Validation Rules

All scenario files are validated by `ScenarioLoader.ts` using Zod before execution. Validation errors produce a human-readable message listing every field that failed. Rules:

- `id` must be a non-empty string
- `name` must be a non-empty string
- `modes` must be a non-empty array containing only `smoke` or `full`
- Every step must have a valid `type`, `id`, `persona`, and `severity`
- `retries` must be a non-negative integer if present
- `timeout_ms` must be a positive integer if present
- `handoff` steps must have both `from` and `to` set to valid persona values, plus a non-empty `message`

Run validation locally with:

```bash
cd rc-fresh
npx tsx test-sprint4-scenarios.ts
```
