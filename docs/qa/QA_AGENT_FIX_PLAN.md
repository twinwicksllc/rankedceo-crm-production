# QA Agent Fix Plan

**Audience:** an implementing agent (Haiku) working through this mechanically.
**Source:** currency review of the QA agent (`qa-agent/`, deployed target `qa.rankedceo.com`) after the Initiative #6 (async audits) / #9 (audit attribution) / #11a (domain timeline) changes.

## Read this first

The review found **nothing broken**. All 12 scenario routes resolve, all login and portal `data-testid` hooks are intact, `compiler.reactRemoveProperties: false` survived the Turbopack rewrite (so testids still ship in prod builds), and the Supabase adaptor is insulated from the `waas_audits` → `audits` table rename because it is table-agnostic and scoped to the `qa` schema.

So this plan is **drift cleanup plus one real coverage gap**. Nothing here is an outage. Do not "fix" anything not listed in the tasks below — see [Do NOT change](#do-not-change).

### Ground rules

1. **Never push to `main`.** Branch, commit, push the branch, open a PR. Vercel auto-deploys `main`, so a direct push lands in production immediately.
2. **Never commit `.env.qa`.** Only `.env.qa.example` is tracked.
3. **Never point QA at the production Supabase project.** All three workflows carry the comment `IMPORTANT: QA workflows must use QA-dedicated Supabase secrets only.` Honour it.
4. **Do not invent a Supabase project ref.** Task 1 has an open decision flagged — use the placeholder, do not guess. See [Open decision](#open-decision-do-not-resolve-this-yourself).
5. You cannot run `npm run build`, `tsc`, or `npm audit` in this workspace (`node_modules/` is absent and the registry hits `SELF_SIGNED_CERT_IN_CHAIN`). **Type/build verification happens on Vercel via the PR.** Do not claim a local build passed.

### Task order

Tasks 1 → 4 are independent and can go in one PR. **Task 5 must be a separate PR** (higher risk). Task 3 is a hard prerequisite for Task 4 — the scenario in Task 4 targets testids that Task 3 adds.

| # | Task | Files | Risk |
|---|---|---|---|
| 1 | Fix stale Supabase guidance in `.env.qa.example` | 1 | none (docs) |
| 2 | Add missing `QA_AUDIT_ID` to `.env.qa.example` | 1 | none (docs) |
| 3 | Add `data-testid` hooks to audit report states | 2 | low |
| 4 | New QA scenario covering the async audit flow | 2 | low |
| 5 | Clear `next.config.js` deprecation warnings | 2 | **medium — separate PR** |

---

## Setup

```bash
cd /c/Users/fenwitr/projects/claude-code/rankedceo-crm-production
git checkout main
git pull
git checkout -b fix/qa-agent-currency
```

---

## Task 1 — Fix stale Supabase guidance in `.env.qa.example`

**Why:** `qa-agent/.env.qa.example` line 26 tells the reader to point QA at the production project. That directly contradicts all three GitHub workflows, which map every Supabase var to `secrets.QA_SUPABASE_*`. A developer following the example file today would wire QA to production and let QA test runs write against live data. It also uses the bare `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` names, which are only the *fallback* half of the adaptor's lookup.

**Reference — `qa-agent/src/adaptors/supabase/SupabaseAdapter.ts` resolves env in this order:**
- URL: `NEXT_PUBLIC_WAAS_SUPABASE_URL` ?? `SUPABASE_URL`
- Key: `WAAS_SUPABASE_SERVICE_ROLE_KEY` ?? `SUPABASE_SERVICE_ROLE_KEY`

Both names must be documented, with the preferred one first.

**File:** `qa-agent/.env.qa.example`

**Find this block exactly:**

```
# ── Supabase ──────────────────────────────────────────────────────────────────
# Use the SAME project as production, but all QA records go to the `qa` schema
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Replace with:**

```
# ── Supabase ──────────────────────────────────────────────────────────────────
# IMPORTANT: point this at the QA-dedicated Supabase project, NOT production.
# QA scenarios insert, count, and purge rows — running them against production
# data is destructive. CI enforces this: all three workflows in
# .github/workflows/qa-*.yml map these vars to secrets.QA_SUPABASE_URL and
# secrets.QA_SUPABASE_SERVICE_ROLE_KEY.
#
# Within that project, all agent-written records live in the `qa` schema
# (SupabaseAdapter sets `db: { schema: "qa" }`), so QA rows never mix with
# app tables in `public` even inside the QA project.
#
# The adaptor prefers the WAAS_-prefixed names and falls back to the bare ones.
# Set the preferred pair; the fallbacks exist for local one-off runs.
NEXT_PUBLIC_WAAS_SUPABASE_URL=https://your-qa-project.supabase.co
WAAS_SUPABASE_SERVICE_ROLE_KEY=your-qa-service-role-key

# Fallbacks (only read if the two above are unset)
SUPABASE_URL=https://your-qa-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-qa-service-role-key
```

**Also update the stale header comment** in `qa-agent/src/adaptors/supabase/SupabaseAdapter.ts`. Find:

```
Decision (Q2): Same Supabase project, `qa` schema.
```

Replace with:

```
Decision (Q2): QA-dedicated Supabase project, `qa` schema. (Revised — the
original decision was "same project as production"; CI now requires
QA_SUPABASE_* secrets, so QA must not target the production project.)
```

**Verify:** `grep -rn "SAME project as production" qa-agent/` returns nothing.

---

## Task 2 — Add the missing `QA_AUDIT_ID` to `.env.qa.example`

**Why:** `QA_AUDIT_ID` is consumed by two scenarios and set by all three workflows, but is entirely absent from the example file. Anyone setting up a local run gets an unexplained failure in exactly the scenarios that touch audit routes.

**File:** `qa-agent/.env.qa.example`

Add this block immediately **after** the onboarding block (around line 23) and **before** the `── Supabase ──` section you edited in Task 1:

```
# ── Audit fixtures ────────────────────────────────────────────────────────────
# A UUID of a *completed* audit row in the QA project's public.audits table.
# Scenarios navigate to /audit/${QA_AUDIT_ID} to assert the report renders.
# Must already exist and have status='completed' with non-null report_data —
# scenarios read it, they never create it. Seed one manually in the QA project
# and keep it long-lived (audits have an expires_at; pick or refresh one that
# has not expired).
# Set in CI as an environment value on each qa-*.yml workflow.
QA_AUDIT_ID=00000000-0000-0000-0000-000000000000
```

**Verify:** every env var referenced in `.github/workflows/qa-*.yml` now appears in `.env.qa.example`. Cross-check with:

```bash
grep -ohE "^\s+[A-Z_]+:" .github/workflows/qa-*.yml | tr -d ' :' | sort -u
grep -oE "^[A-Z_]+" qa-agent/.env.qa.example | sort -u
```

Every name in the first list that the agent actually reads should appear in the second. Report any others you find rather than silently adding them.

---

## Task 3 — Add `data-testid` hooks to the audit report states

**Why:** this is the prerequisite for Task 4. `components/audit/report-skeleton.tsx` currently has **no `data-testid` anywhere**. The only targetable text is an `<h2>` reading `Analyzing {targetDomain}` — domain-dependent, so a scenario keyed to it would be brittle. Without stable hooks, a scenario cannot deterministically distinguish "audit is pending" from "audit finished" from "audit failed", which is exactly the distinction the async flow needs tested.

### 3a — `components/audit/report-skeleton.tsx`

`export function ReportSkeleton` starts at line 80; its `return (` is at line 115. Add a testid to the **outermost element of that return**, and one to the inner container at line 134 (`<div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>`).

Required result:

- Outermost returned element gains `data-testid="audit-pending"`.
- The inner container at line 134 gains `data-testid="audit-skeleton-body"`.

Add the attribute only — do not restructure the JSX, change styles, or touch the staged progress messages.

### 3b — `app/audit/[auditId]/client.tsx`

The render-state order in this file (around lines 255–300) is:

1. `if (isRunning)` → `<ReportSkeleton ... />`
2. `isDataUnavailable` → `<ManualAuditState badgeLabel="Manual Review Queued" ... />`
3. `isFailed || (isComplete && isManual && !audit.report_data)` → failure state

State 1 is covered by 3a. Add hooks to the other two branches so a scenario can assert *which* terminal state it landed in:

- Wrap or annotate the `isDataUnavailable` branch's root element with `data-testid="audit-manual-review"`.
- Wrap or annotate the failed branch's root element with `data-testid="audit-failed"`.
- Annotate the **completed report** branch (the one that renders the real report when `isComplete` and `report_data` exists) with `data-testid="audit-complete"`.

If a branch returns a component rather than a plain element, wrap it in a `<div data-testid="...">` rather than editing the shared component — except for `ReportSkeleton`, which Task 3a edits directly because it is audit-specific.

**Verify:**

```bash
grep -rn "audit-pending\|audit-complete\|audit-manual-review\|audit-failed" components/audit/report-skeleton.tsx app/audit/
```

Should return four distinct testids across the two files. Also confirm `next.config.js` still contains `reactRemoveProperties: false` — if that ever flips to `true`, every testid is stripped from production builds and the whole QA suite goes blind. Do not change it.

---

## Task 4 — New QA scenario for the async audit flow

**Why:** the sync → async audit change is the single biggest behavioural change in this release, and it has **zero** test coverage. `POST /api/audit/run` now returns `202` with `{ audit_id, status: "pending", poll_url }` and dispatches the engine via `after()`; the client redirects to `/audit/{id}` and polls `GET /api/waas/audits/[id]/status` every 4s (max 45 attempts ≈ 3 min). A regression that leaves every audit stuck at `pending` forever would pass every existing scenario, because no scenario ever exercises `/api/audit/run`.

### Hard constraints — read before writing YAML

**There is no HTTP/API step type.** The complete set of valid step types (`qa-agent/src/types.ts`) is:
`navigate`, `click`, `fill`, `wait_for`, `wait_for_url`, `assert_text`, `assert_url`, `assert_db`, `handoff`, `pause`.
Coverage must therefore be **UI-driven** — drive the real form, do not try to POST.

**Field schemas** (use exactly these keys):

| step | fields |
|---|---|
| `navigate` | `url` |
| `click` | `selector`, optional `dismissOverlaySelector` |
| `fill` | `selector`, `value` |
| `wait_for` | `selector`, optional `timeout_ms`, optional `state` |
| `wait_for_url` | `pattern` (evaluated as `new RegExp(pattern).test(page.url())`) |
| `assert_text` | `selector`, `contains` |
| `assert_url` | `pattern` |
| `assert_db` | `table`, `where`, `expected_count` |

**`assert_db` is unusable here.** The adaptor runs against the `qa` schema; audits are written to `public.audits`. Do not add a DB assertion to this scenario — the assertions are UI-only by necessity. Note this limitation in the scenario's `description` so the next reader does not think it was an oversight.

**Form selectors** (`app/audit/start/audit-start-form.tsx`, confirmed current):
- target URL input: `input#targetUrl`
- first competitor input: `input#competitor1` (rendered as `id={\`competitor${index + 1}\`}`)
- submit button label: `Run Your Audit` (becomes `Starting your audit…` while in flight)
- on success: `router.push(\`/audit/${data.audit_id}\`)`

**Cost / safety:** this scenario triggers a real audit run. Two things make that acceptable, and you must confirm both:

1. **No email is sent.** The form posts only `target_url` and `competitor_urls`. `requestor_email` is therefore `null`, and `runAuditJob` skips the report email when it is null. Confirm this still holds by re-reading the form's POST body before finalising the scenario. If the form has gained an email field, stop and flag it.
2. **SEO provider quota.** A real run calls the external SEO/PageSpeed providers. Set `WAAS_SEO_PROVIDER=mock` on the QA deployment so the scenario does not burn paid quota on every run. Note that `/api/audit/run` deliberately *skips* its 24h cache lookup when the provider is mock, so each run genuinely exercises the async path rather than short-circuiting to a cache hit — which is what we want here.

Add a `WAAS_SEO_PROVIDER=mock` line with that reasoning to `qa-agent/.env.qa.example` as part of this task.

### 4a — Create `qa-agent/scenarios/audit_async.yaml`

Match the existing header shape (`id`, `name`, `description`, `modes`, `requires_stripe`, `requires_email`, `steps`) exactly as used by `smoke.yaml` and `enduser_clarity.yaml`.

```yaml
id: audit_async
name: Async Audit — Submit, Poll, Complete
description: >
  Covers the async audit path end to end through the UI: submit the audit form,
  confirm the 202-dispatch redirect lands on /audit/{id}, confirm the pending
  skeleton renders (proving the request returned before the engine finished),
  then poll until a terminal state.

  Full mode only — a real audit run takes ~30-90s. Requires
  WAAS_SEO_PROVIDER=mock on the target deployment so this does not consume paid
  SEO provider quota.

  No assert_db steps: the QA Supabase adaptor is scoped to the `qa` schema and
  audits are written to public.audits, so DB-level assertions are not available
  to this agent. Assertions here are UI-only by design, not by omission.
modes:
  - full
requires_stripe: false
requires_email: false

steps:
  # ── Submit the audit form ───────────────────────────────────────────────
  - type: navigate
    url: /audit/start

  - type: wait_for
    selector: input#targetUrl
    timeout_ms: 15000

  - type: fill
    selector: input#targetUrl
    value: https://example.com

  - type: fill
    selector: input#competitor1
    value: https://www.iana.org

  - type: click
    selector: button[type="submit"]

  # ── Async dispatch: we must land on the report page immediately ─────────
  # This is the core assertion. Pre-async, the POST blocked for the full
  # engine run; now it returns 202 in ~1s. A 20s budget is generous for the
  # new behaviour and far too short for the old one.
  - type: wait_for_url
    pattern: /audit/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

  # ── Pending state renders while the background job runs ─────────────────
  - type: wait_for
    selector: '[data-testid="audit-pending"]'
    timeout_ms: 20000

  - type: wait_for
    selector: '[data-testid="audit-skeleton-body"]'
    timeout_ms: 5000

  # ── Poll to a terminal state ───────────────────────────────────────────
  # The client polls every 4s up to 45 attempts (~3 min). Wait for the
  # pending state to disappear rather than for one specific outcome, so a
  # manual-review or failed result still proves polling works.
  - type: wait_for
    selector: '[data-testid="audit-pending"]'
    state: detached
    timeout_ms: 200000

  # A terminal state must be present. audit-complete is the happy path;
  # if the mock provider yields a manual-review or failure this step is the
  # one that will fail, and that failure is informative — read the artifact
  # before assuming the scenario is wrong.
  - type: wait_for
    selector: '[data-testid="audit-complete"]'
    timeout_ms: 15000
```

**Before committing, validate every assumption in that YAML:**

- Confirm `state: detached` is an accepted value for `wait_for`'s `state` field. Read `WaitForStep` in `qa-agent/src/types.ts` and the executor that consumes it. If `state` is typed as a narrower union that excludes `detached`, replace that step with a `pause` of `duration_ms: 120000` followed by the `audit-complete` wait, and add a comment explaining why.
- Confirm the submit button selector `button[type="submit"]` is unique on `/audit/start`. If the page has more than one submit button, switch to a text-based or id-based selector.
- Confirm `navigate` accepts a **relative** URL (`/audit/start`). Check how other scenarios write their `navigate` steps and match them — if they use absolute URLs built from `QA_BASE_URL`, do the same.
- Confirm the YAML quoting style for attribute selectors matches existing scenarios (single-quoted `'[data-testid="..."]'` vs unquoted). Match the file that already does this.

### 4b — Register the scenario

Check how `npm run full` discovers scenarios (`qa-agent/package.json`, and the CLI in `qa-agent/src/cli.ts`). If scenarios are auto-discovered from `scenarios/*.yaml`, nothing further is needed. If there is an explicit manifest or list, add `audit_async` to it.

Because `modes: [full]`, this runs in `qa-weekly.yml` (`npm run full`) and **not** in `qa-smoke.yml`. That is intentional — a ~90s real audit does not belong in a per-PR smoke run. Do not add it to `smoke`.

**Verify:**

```bash
npx tsx src/cli.ts --scenario scenarios/audit_async.yaml --mode full
```

Run from `qa-agent/` against a deployment that has the Task 3 testids live. **This means Task 3 must be merged and deployed before Task 4 can be verified.** If you cannot run it, say so plainly in the PR description rather than implying it passed.

---

## Task 5 — Clear `next.config.js` deprecation warnings (SEPARATE PR)

**Why:** three deprecations warn on every Vercel build. None break anything today, but 5c changes runtime request handling and must not ride along with docs and testid changes.

Do this as its own PR: `git checkout main && git pull && git checkout -b chore/next-config-deprecations`

### 5a — Move `outputFileTracingExcludes` to top level

Next has promoted this out of `experimental`. In `next.config.js`, move the `outputFileTracingExcludes` key from inside the `experimental` object to the top level of `nextConfig`, preserving its value verbatim. If `experimental` becomes empty, remove the empty object.

### 5b — Remove the unsupported `eslint` key

The `eslint` key is no longer supported in `next.config.js`. Delete it entirely.

**Before deleting, check what it was suppressing.** If it contained `ignoreDuringBuilds: true`, removing the key does not re-enable lint-on-build in Next 16 (`next lint` is no longer part of `next build`), so this is safe — but confirm the build stays green on the PR's Vercel deployment before merging. If the build newly fails on lint errors, revert 5b and leave a comment in the config explaining why the key stays.

### 5c — `middleware.ts` → `proxy.ts`

**Highest risk item in this plan.** `middleware.ts` at the repo root handles auth/session routing; a broken matcher silently breaks access control rather than failing loudly.

Procedure:

1. **Read `middleware.ts` in full first.** Note its `config.matcher`, whether it exports `runtime`, and every route it gates.
2. Prefer the official codemod over a hand edit. Check whether `npx @next/codemod@latest middleware-to-proxy .` (or the equivalent named in the deprecation warning text in the Vercel build log) exists for this version. Use the exact codemod name the warning gives — do not guess. If no codemod exists, rename the file and its default export by hand, changing nothing about the matcher or logic.
3. **Do not change the matcher, the logic, or the runtime.** Rename only.
4. Verify on the PR's Vercel preview deployment, not locally:
   - Visiting a protected admin route while logged out redirects to `/login`.
   - Logging in at `/login` succeeds and lands on the admin dashboard.
   - A client portal URL `/edit/{reviewToken}` still resolves for a valid token.
   - A public route (`/audit/start`) is still reachable anonymously.
5. If any of those four regress, **revert 5c and open it as its own issue.** A build-log warning is much cheaper than broken auth.

If you are not confident you can verify all four behaviours on the preview deployment, **skip 5c entirely** and ship only 5a + 5b. Say so in the PR description.

---

## Open decision — do NOT resolve this yourself

The user mentioned that "supabase uses `klgvdvryewykzlumbkei` project for the waas build and vercel has a `rankedceo-crm-qa` project," but it was never confirmed whether that Supabase ref is the **QA** project or the **production** project.

**Therefore:** in Task 1, use the literal placeholder `https://your-qa-project.supabase.co`. Do **not** substitute `klgvdvryewykzlumbkei` or any other real ref into a tracked file. Getting this backwards would document production as the QA target — the exact failure Task 1 exists to prevent.

Raise it in the PR description as an open question for the user to answer.

---

## Do NOT change

The review confirmed these are current. Leave them alone.

- **All 12 scenario routes** — every one resolves. Including `/login`, which is served by the `app/(auth)/login/page.tsx` route group.
- **Login testids** — `admin-email`, `admin-password`, `admin-login-submit`, `login-error`, `login-form-password` all present in `app/(auth)/login/page.tsx`.
- **Portal testids** — `client-portal-root`, `logout`, `overview-tab-content`, `editor-tab-content`, `audits-tab-content`, `billing-tab-content` all present in `app/edit/[reviewToken]/portal-shell.tsx`. Tab buttons emit `data-testid={\`portal-tab-${tab.id}\`}` — a literal-string grep for `portal-tab-audits` **will not match** because it is a template literal. It exists. Do not "add" it.
- **`compiler.reactRemoveProperties: false`** in `next.config.js` — this is what keeps testids in production builds. Never set it to `true`.
- **`SupabaseAdapter`'s table-agnostic methods** (`countRows`, `insert`, `select`, `purgeAgentRecords`) — being table-agnostic is why the `waas_audits` → `audits` rename did not affect QA. Do not hardcode table names into the adaptor.
- **The audit-start assertion's generic selector** (`form, input[type="url"], input[type="text"], input[placeholder*="domain"], input[placeholder*="website"], main`) — deliberately broad, survived the form rewrite. Task 4 adds precise selectors in a *new* scenario; do not tighten the existing one.
- **The `IMPORTANT: QA workflows must use QA-dedicated Supabase secrets only.` comments** in all three workflow files.

---

## Wrap-up

For each PR:

```bash
git add -A
git commit -m "<scope>: <what changed>"
git push origin <branch>
gh pr create --title "..." --body "..."
```

In each PR description, state explicitly:
- Which tasks are included.
- What you verified, and **how** — distinguishing "confirmed on the Vercel preview" from "not verified because I could not run it here."
- Any assumption in Task 4's YAML that turned out to be wrong and how you adjusted.
- The open Supabase-project question, if Task 1 is in that PR.

Do not merge. Leave the PRs for review.
