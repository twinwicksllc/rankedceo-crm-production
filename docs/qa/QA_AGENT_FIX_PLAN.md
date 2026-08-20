# QA Agent Fix Plan

**Audience:** an implementing agent (Haiku) working through this mechanically.
**Source:** currency review of the QA agent (`qa-agent/`, deployed target `qa.rankedceo.com`) after the Initiative #6 (async audits) / #9 (audit attribution) / #11a (domain timeline) changes.

## Read this first

The review found **nothing broken**. All 12 scenario routes resolve, all login and portal `data-testid` hooks are intact, `compiler.reactRemoveProperties: false` survived the Turbopack rewrite (so testids still ship in prod builds), and the Supabase adaptor is insulated from the `waas_audits` → `audits` table rename because it is table-agnostic and scoped to the `qa` schema.

So this plan is **drift cleanup plus one real coverage gap**. Nothing here is an outage. Do not "fix" anything not listed in the tasks below — see [Do NOT change](#do-not-change).

### Ground rules

1. **Never push to `main`.** Branch, commit, push the branch, open a PR. Vercel auto-deploys `main`, so a direct push lands in production immediately.
2. **Never commit `.env.qa`.** Only `.env.qa.example` is tracked.
3. **QA deliberately shares the production WaaS project, isolated by schema — not by project.** This is decision Q2 (`docs/QA_AGENT_PLAN.md:731`). Understand it before editing anything Supabase-related: see [The QA Supabase model](#the-qa-supabase-model).
4. **Do not write a Supabase project ref into a tracked file.** The refs are resolvable now, but they belong in GitHub secrets and Vercel env, not in the repo. Use the descriptive project *names*.
5. You cannot run `npm run build`, `tsc`, or `npm audit` in this workspace (`node_modules/` is absent and the registry hits `SELF_SIGNED_CERT_IN_CHAIN`). **Type/build verification happens on Vercel via the PR.** Do not claim a local build passed.

### Task order

Three PRs, in this order:

- **PR 1 — Tasks 1 → 4.** Docs, testids, and the new scenario. Task 3 is a hard prerequisite for Task 4, because the Task 4 scenario targets testids that Task 3 adds.
- **PR 2 — Task 6.** A real behavioural fix to a server action; keep it separate so it can be reviewed and reverted on its own.
- **PR 3 — Task 5.** Highest risk (touches request handling). Must not ride along with anything else.

Every open question in this plan has been decided by the repo owner. **Nothing is blocked on further input, and nothing needs a decision from you:**

| Question | Decision |
|---|---|
| May Task 4 write real rows to the production WaaS project? | **Yes — accept the rows.** Two obligations attached; see Task 4. |
| Is Task 6 a real bug or a misreading? | **Real bug.** The QA dashboard has never worked. Fix it as written. |
| What Supabase project does `qa.rankedceo.com` use? | **`rankedceo-waas`.** No pre-flight check needed. |
| Should Task 5c (`middleware.ts` → `proxy.ts`) be attempted at all? | **Yes, with the escape hatch intact.** Attempt it, verify the four auth behaviours on the preview, revert if any regress. |
| May you merge your own PRs? | **No.** Open them and stop. |

> **Out of scope but urgent — do not action here.** A live Supabase Personal Access Token is committed at `supabase-mcp-client/run-rls-optimization.js:5` and has been in git history since `6c0f9d5` (PR #178). It is being handled separately and needs revocation, not a code edit. Do not touch that file as part of this plan, and do not paste the token into a commit message, PR description, or issue.

| # | Task | Files | Risk |
|---|---|---|---|
| 1 | Fix stale Supabase guidance in `.env.qa.example` | 1 | none (docs) |
| 2 | Add missing `QA_AUDIT_ID` to `.env.qa.example` | 1 | none (docs) |
| 3 | Add `data-testid` hooks to audit report states | 2 | low |
| 4 | New QA scenario covering the async audit flow | 2 | low |
| 5 | Clear `next.config.js` deprecation warnings | 2 | **medium — separate PR** |
| 6 | QA dashboard reads the `qa` schema from the wrong project | 2 | **medium — separate PR** |

---

## Setup

```bash
cd /c/Users/fenwitr/projects/claude-code/rankedceo-crm-production
git checkout main
git pull
git checkout -b fix/qa-agent-currency
```

---

## Task 1 — Resolve the contradictory Supabase docs

**Correction to an earlier version of this plan:** this task previously claimed `.env.qa.example` line 26 was dangerously wrong for saying "use the SAME project as production." **That claim was mistaken.** Line 26 accurately describes decision Q2. `SupabaseAdapter.ts`'s header comment is also correct. **Do not "fix" either to say QA uses a dedicated project — that would make the docs wrong.**

**The actual defect** is that two tracked docs contradict each other, and neither says *which* project:

- `qa-agent/.env.qa.example:26` — "Use the SAME project as production, but all QA records go to the `qa` schema" ✅ correct, but doesn't name the project
- `docs/qa-agent/README.md:64` — "`QA_SUPABASE_URL` … QA Supabase project URL **dedicated to QA runs**" ❌ misleading; implies project-level isolation that does not exist

A developer reading the README would provision a new Supabase project, point QA at it, and get failures because the `qa` schema (and the `QA_AUDIT_ID` fixture row) only exist in `rankedceo-waas`.

`.env.qa.example` also documents only the **fallback** env names. `SupabaseAdapter` resolves:
- URL: `NEXT_PUBLIC_WAAS_SUPABASE_URL` ?? `SUPABASE_URL`
- Key: `WAAS_SUPABASE_SERVICE_ROLE_KEY` ?? `SUPABASE_SERVICE_ROLE_KEY`

Both pairs should be documented, preferred first.

### 1a — `qa-agent/.env.qa.example`

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
# Decision Q2 (docs/QA_AGENT_PLAN.md:731): QA runs against the SAME Supabase
# project as production — specifically the `rankedceo-waas` project, which owns
# public.audits, public.tenants, and the `qa` schema. Isolation is by SCHEMA,
# not by project. There is no separate QA Supabase project; do not create one.
#
# The agent's own bookkeeping is confined to the `qa` schema: SupabaseAdapter
# sets `db: { schema: "qa" }`, so insert/countRows/select/purgeAgentRecords can
# never reach `public`. The schema is provisioned by
# supabase/migrations/waas/021_qa_schema.sql, and `qa` must be added to
# Settings → API → Extra search path for the adaptor to see it.
#
# LIMITATION: schema isolation covers only the adaptor. Browser-driven steps
# make the *application* write to `public` in this same project, so scenarios
# that drive real forms create real rows. Keep that in mind when authoring.
#
# The adaptor prefers the WAAS_-prefixed names and falls back to the bare ones.
# Set the preferred pair; the fallbacks exist for local one-off runs.
NEXT_PUBLIC_WAAS_SUPABASE_URL=https://<rankedceo-waas-ref>.supabase.co
WAAS_SUPABASE_SERVICE_ROLE_KEY=your-waas-service-role-key

# Fallbacks (only read if the two above are unset)
SUPABASE_URL=https://<rankedceo-waas-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-waas-service-role-key
```

Leave `<rankedceo-waas-ref>` as a placeholder. The real ref belongs in GitHub secrets and Vercel env, not in a tracked file.

### 1b — `docs/qa-agent/README.md` line 64

Change the `QA_SUPABASE_URL` description from `QA Supabase project URL dedicated to QA runs` to:

```
URL of the rankedceo-waas project (shared with production; QA is isolated by the `qa` schema, not by project — see Q2)
```

Apply the same correction to the `QA_SUPABASE_SERVICE_ROLE_KEY` row if it makes the same "dedicated" claim.

### 1c — `docs/qa-agent/purging.md` line 9

Reads "The QA agent runs in the same Supabase project as production, using a dedicated `qa` schema." This is correct — **add** the project name for clarity, don't rewrite the claim:

```
The QA agent runs in the same Supabase project as production (`rankedceo-waas`), using a dedicated `qa` schema.
```

### 1d — Leave `SupabaseAdapter.ts` alone

Its header comment `Decision (Q2): Same Supabase project, \`qa\` schema.` is accurate. Do not change it.

### 1e — Record what the QA deployment runs against

Nothing in the repo says which Supabase project `qa.rankedceo.com` uses, which is why it had to be asked. Write it down so nobody asks again. Add a short section to the most appropriate existing file in `docs/deployment/` (read that directory and pick one — do not create a new file if an obvious host exists):

```markdown
## QA deployment (`qa.rankedceo.com`)

Runs against the **`rankedceo-waas`** Supabase project — the same project as
production, not a separate QA project. The QA agent's own bookkeeping is
isolated in the `qa` schema; anything the agent drives through the real UI
writes to `public` in that project. See `docs/qa/QA_AGENT_FIX_PLAN.md` →
"The QA Supabase model".

Host routing for this domain is handled in `middleware.ts` via `QA_WAAS_HOST`
and `QA_WAAS_TENANT_SLUG`.
```

Use the project **name** only. Do not write the project ref (per ground rule 4).

**Verify:** `grep -rn "dedicated to QA runs" docs/ qa-agent/` returns nothing, and `grep -rn "SAME project as production" qa-agent/` still returns line 26 of `.env.qa.example` (it should — it is correct).

---

## Task 2 — Add the missing `QA_AUDIT_ID` to `.env.qa.example`

**Why:** `QA_AUDIT_ID` is consumed by two scenarios and set by all three workflows, but is entirely absent from the example file. Anyone setting up a local run gets an unexplained failure in exactly the scenarios that touch audit routes.

**File:** `qa-agent/.env.qa.example`

Add this block immediately **after** the onboarding block (around line 23) and **before** the `── Supabase ──` section you edited in Task 1:

```
# ── Audit fixtures ────────────────────────────────────────────────────────────
# A UUID of a *completed* audit row in public.audits of the rankedceo-waas
# project (the same project QA targets — see Q2; there is no separate QA
# project). Scenarios navigate to /audit/${QA_AUDIT_ID} to assert the report
# renders. Must already exist with status='completed' and non-null report_data —
# scenarios read it, they never create it. Seed one manually and keep it
# long-lived (audits have an expires_at; pick or refresh one that has not
# expired). Note this row lives in `public`, not the `qa` schema, so the
# adaptor cannot see or purge it — treat it as a durable fixture.
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

**⚠️ This scenario writes real rows to the production WaaS project.** Per [The QA Supabase model](#the-qa-supabase-model), the `qa`-schema isolation covers only the adaptor's own bookkeeping — it does **not** cover writes the application makes in response to browser steps. Driving the audit form creates a genuine `public.audits` row in `rankedceo-waas` on every run, and there is no adaptor-level purge that can clean it up (`purgeAgentRecords` is confined to the `qa` schema).

**DECIDED (by the repo owner): accept the rows.** Proceed with the scenario as written. The cadence is weekly (`modes: [full]`), so this is roughly one extra `public.audits` row per week. Do **not** provision a separate project and do **not** drop the submit steps — the async-dispatch coverage is the whole point of the task.

Two obligations come with that decision:

**1. Keep the rows identifiable.** Use `https://example.com` as the target URL exactly as specified in the YAML below. It is a real, stable, fetchable page (so the audit can genuinely complete) and no real prospect ever audits it, which makes QA rows separable after the fact:

```sql
-- Identify QA-generated audit rows
SELECT id, target_url, status, created_at
FROM public.audits
WHERE target_url = 'https://example.com'
  AND requestor_email IS NULL      -- the audit form never collects email
  AND audit_type = 'prospect'
ORDER BY created_at DESC;
```

Do not change the target to a non-resolving sentinel like `qa-agent.example.com` — the engine would fail to analyse it, the scenario would never reach `audit-complete`, and you would be debugging a self-inflicted failure.

**2. Add the purge snippet to the QA runbook.** Put the `DELETE` form of the query above into `docs/qa-agent/purging.md`, next to the existing `qa`-schema purge documentation, clearly labelled as a **manual** step operating on `public` (outside `purgeAgentRecords`' reach):

```sql
-- Manual purge of QA-generated audit rows (run against rankedceo-waas)
DELETE FROM public.audits
WHERE target_url = 'https://example.com'
  AND requestor_email IS NULL
  AND audit_type = 'prospect'
  AND created_at < now() - interval '30 days';
```

Sanity-check with the `SELECT` before running the `DELETE`, and keep the `created_at` window so an in-flight run is never deleted mid-scenario.

### Cleanup: how to make this self-managing later

Do **not** build any of this as part of Task 4 — it is recorded here so the follow-up work is scoped. Listed cheapest-first:

- **(i) Automate the manual purge.** The agent already holds the WaaS service-role key, so a small purpose-built cleanup helper could run the `DELETE` above at the end of a weekly run. Important: do this as a **separate, explicitly-scoped** helper — do not widen `SupabaseAdapter`'s `db: { schema: "qa" }`, which is the entire isolation guarantee (see [Do NOT change](#do-not-change)).
- **(ii) Mark QA rows at write time.** `qa.rankedceo.com` is its own Vercel deployment, so it could set something like `WAAS_QA_MODE=true` and have `/api/audit/run` stamp rows it creates — either a new `'qa'` value on the `waas_audit_type` enum (currently `prospect | tenant | competitor`) or a dedicated column. That makes QA rows filterable out of admin dashboards too, not just deletable. Needs a migration and an app change.
- **(iii) Build the `expires_at` reaper — this is the real find.** Every `audits` row already gets `expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')` (`supabase/migrations/waas/002_waas_audits.sql:104`), but **nothing anywhere acts on it.** There is no `pg_cron` job, no `crons` key in `vercel.json`, and no delete path in any route or action. So the table grows without bound for *all* audits, not just QA ones. A reaper would clean QA rows for free as a side effect. **This is a pre-existing housekeeping gap unrelated to QA — raise it as its own initiative rather than smuggling it into this plan.**

**Also worth checking (report, don't fix):** whether any admin dashboard or metric counts `prospect` audits without filtering. If so, one QA row per week will slowly skew it. `lib/waas/actions/admin/tenants.ts` and `app/api/audit/abandonment-check/route.ts` both query `audits` and are the likeliest candidates.

**`qa.rankedceo.com` uses `rankedceo-waas`** — confirmed by the repo owner. No pre-flight check needed. This is also why the rows land in the WaaS project's `public.audits`, as described above.

**Cost / safety of the run itself:** two further things must hold, and you must confirm both:

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

**DECIDED (by the repo owner): attempt it, with the escape hatch intact.** Do not skip it pre-emptively and do not ask whether to include it. Work the procedure below; if step 4's verification fails or you cannot complete step 4, take the escape hatch at the end of this section. Choosing the escape hatch is an acceptable outcome — quietly shipping an unverified rename is not.

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

## Task 6 — QA dashboard reads the `qa` schema through the wrong Supabase client (SEPARATE PR)

Do this as its own PR: `git checkout main && git pull && git checkout -b fix/qa-dashboard-waas-client`

**Confirmed bug — fix it.** The repo owner confirms the QA dashboard has **always been empty and has never worked**. That removes the ambiguity this task originally carried: there is no scenario in which the current code path is working, so implement the fix below rather than investigating first.

**The mismatch:**

| Side | Client | Project | Credential |
|---|---|---|---|
| Agent **writes** `qa` schema | `SupabaseAdapter` | `NEXT_PUBLIC_WAAS_SUPABASE_URL` → **rankedceo-waas** | service role |
| Dashboard **reads** `qa` schema | `lib/waas/actions/qa.ts` → `@/lib/supabase/server` | `NEXT_PUBLIC_SUPABASE_URL` → **rankedceo-crm** | anon key |

`lib/waas/actions/qa.ts` imports `createClient` from `@/lib/supabase/server` (line 12) and calls `.schema("qa")` at **7 sites** against `qa_runs` and `qa_scenarios`. But `lib/supabase/server.ts:8-9` uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the CRM project — while `CREATE SCHEMA qa` exists only in `supabase/migrations/waas/021_qa_schema.sql`, the WaaS set.

**Two independent reasons it fails**, and the fix must address both:

1. **Wrong project** — `CREATE SCHEMA qa` exists only in the WaaS migration set, so the schema does not exist in `rankedceo-crm` and every dashboard query errors or returns empty.
2. **Wrong credential** — `021_qa_schema.sql:80-91` enables RLS on `qa.qa_runs` and `qa.qa_scenarios` and grants policies **`TO service_role` only**. There is no `anon` or `authenticated` policy, so even against the right project the anon key reads nothing.

### 6a — Add a `qa`-schema client to `lib/waas/supabase.ts`

There is already a private `getRawAdminClient()` in that file (just above `getWaasClient`) that builds an **untyped** service-role client for exactly this class of problem. Mirror it, adding schema scoping and memoization to match `getWaasAdminClient`'s shape:

```ts
// ---------------------------------------------------------------------------
// SERVER-SIDE: Service-role client scoped to the `qa` schema.
// Untyped on purpose — `WaasDatabase` declares only `public`, so a typed
// client cannot address `qa`. Scoped via db.schema, mirroring qa-agent's
// SupabaseAdapter. RLS on qa.* grants to service_role only, so this must
// never be reachable from the browser.
// ---------------------------------------------------------------------------

let _waasQaClient: SupabaseClient | null = null;

export function getWaasQaClient(): SupabaseClient {
  if (_waasQaClient) return _waasQaClient;

  const { url, serviceRole } = getWaasServiceEnvVars();

  _waasQaClient = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "qa" },
  });

  return _waasQaClient;
}
```

Place it directly after `getWaasAdminClient`. `createClient`, `SupabaseClient`, and `getWaasServiceEnvVars` are all already in scope in that file — add no new imports.

### 6b — Repoint `lib/waas/actions/qa.ts`

1. Replace the import at line 12:
   ```diff
   -import { createClient } from "@/lib/supabase/server";
   +import { getWaasQaClient } from "@/lib/waas/supabase";
   ```
2. In each of the 7 exported actions, replace the client acquisition (`const supabase = await createClient();` or equivalent — read each one, they may differ slightly) with `const supabase = getWaasQaClient();`. Note it is **not** `await`ed — `getWaasQaClient` is synchronous, unlike `@/lib/supabase/server`'s `createClient`. Remove any now-unused `await`.
3. **Delete all 7 `.schema("qa")` calls** (lines 63, 84, 105, 128, 154, 197, 218). The client is already schema-scoped, so they are redundant — and on some supabase-js versions chaining `.schema()` after `db.schema` is set is a no-op that silently reads the wrong schema. Leave the rest of each query chain untouched.
4. Leave `revalidatePath` and every `revalidatePath(...)` call exactly as they are.

### Traps

- **Do not use `createWaasClient`.** Despite the name, `lib/waas/supabase.ts:267` aliases it to `getWaasClient`, which uses the **anon** key. It would reproduce the exact RLS failure you are fixing.
- **Do not use `getWaasAdminClient` directly.** It returns `SupabaseClient<WaasDatabase>`, and `WaasDatabase` (line 130) declares only `public`. `.schema("qa")` on it is a **TypeScript error** — and `next build` runs `tsc`, so it fails the build, not just the editor. That is precisely why 6a builds an untyped client instead.
- **The current code compiles only by accident.** `lib/supabase/server.ts` calls `createServerClient` with no `Database` generic, so its type is `any` and `.schema("qa")` type-checks against nothing. Losing that accidental `any` is a feature, not a regression.
- **`qa.ts` starts with `"use server"`** — these are server actions and must stay that way. A service-role key in a module reachable from a client component would leak it. Do not add `"use client"` anywhere in the import chain, and do not import `qa.ts` from a client component.

### Verify

1. On the PR's Vercel preview, load `/admin/qa-reports`. It should list runs (or render an empty state cleanly if the agent has genuinely never written to `qa.qa_runs` in this project — check that with `SELECT count(*) FROM qa.qa_runs;` against `rankedceo-waas` before concluding the fix failed).
2. Load `/admin/qa-scenarios` and confirm the list renders.
3. If queries still return nothing with rows present in the table, check **Settings → API → Extra search path** on `rankedceo-waas` and confirm `qa` is listed. PostgREST refuses schemas outside that list regardless of credential. This is a dashboard setting, not a code change — report it rather than working around it.
4. Do **not** exercise `purgeQaRuns` on the preview deployment. It is destructive and it now points at a project where the data is real.

---

## The QA Supabase model

**Read this before touching anything Supabase-related.** It was previously ambiguous and is now resolved.

There are exactly **two** Supabase projects, and **neither is a QA project**:

| Project name | Role | Env vars |
|---|---|---|
| `rankedceo-waas` | Audit + website-building components. Owns `public.audits`, `public.tenants`, and the `qa` schema. | `NEXT_PUBLIC_WAAS_SUPABASE_URL` / `WAAS_SUPABASE_SERVICE_ROLE_KEY` |
| `rankedceo-crm` | The CRM. Currently shared with the `listing-assistant-pro` project, which is planned to migrate out to its own project. | `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` |

**QA runs against `rankedceo-waas`, isolated by the `qa` schema — not by a separate project.** That is decision Q2, recorded at `docs/QA_AGENT_PLAN.md:731`:

> | 2 | **Database** | Same Supabase project, `qa` schema. All agent records prefixed `qa_agent_YYYYMMDD_HHMMSS_` for easy identification and purge. Real clients are never mixed with agent runs. |

Three independent facts confirm it is the WaaS project specifically:

1. The `qa` schema is created by `supabase/migrations/waas/021_qa_schema.sql` — the **WaaS** migration set. It is the only `CREATE SCHEMA qa` in the repo.
2. `SupabaseAdapter` prefers WaaS credentials (`NEXT_PUBLIC_WAAS_SUPABASE_URL` first, bare `SUPABASE_URL` only as fallback).
3. `ReportDispatcher` tells you to run `supabase/migrations/waas/021_qa_schema.sql` when the schema is missing.

### What this means in practice

- **The `QA_SUPABASE_*` GitHub secrets are a naming convention, not a separate project.** The secret name says "QA"; the value is the WaaS project URL. The workflow comment `QA workflows must use QA-dedicated Supabase secrets only` means *use the QA_-prefixed secrets*, not *use a separate project*. Do not read it as evidence of project-level isolation.
- **Isolation is schema-scoped and covers only the agent's own bookkeeping.** `SupabaseAdapter` runs with `db: { schema: "qa" }`, so every adaptor call — `insert`, `countRows`, `select`, `purgeAgentRecords` — is confined to `qa`. It cannot touch `public`.
- **Browser-driven steps are NOT isolated.** When a scenario drives the real UI, the *application* writes wherever that deployment's env points — `public` tables in `rankedceo-waas`. Schema isolation does not apply to anything Playwright triggers through the app. This is the model's real limitation and it directly constrains Task 4.

### Still unverified

- The values behind `QA_SUPABASE_URL` / `QA_SUPABASE_SERVICE_ROLE_KEY` are GitHub secrets and cannot be read via the API — only their names are visible. The mapping above is inferred from migrations + code, not read from the secret values. If a QA run behaves as though the `qa` schema is missing, check the secret value first.
- ~~What the `qa.rankedceo.com` deployment uses for Supabase.~~ **Resolved: it uses `rankedceo-waas`** (confirmed by the repo owner). Nothing in the repo records this — `git grep -i "rankedceo-crm-qa"` returns nothing and there is no QA section in `docs/deployment/`; the only app-level acknowledgement of the host is `middleware.ts:49-50` (`QA_WAAS_HOST`, `QA_WAAS_TENANT_SLUG`), which is host routing only. **Worth writing down:** add a short "QA deployment" note to `docs/deployment/` recording that `qa.rankedceo.com` runs against `rankedceo-waas`, so the next reader does not have to ask. Do this in the Task 1 docs PR.

---

## Do NOT change

The review confirmed these are current. Leave them alone.

- **All 12 scenario routes** — every one resolves. Including `/login`, which is served by the `app/(auth)/login/page.tsx` route group.
- **Login testids** — `admin-email`, `admin-password`, `admin-login-submit`, `login-error`, `login-form-password` all present in `app/(auth)/login/page.tsx`.
- **Portal testids** — `client-portal-root`, `logout`, `overview-tab-content`, `editor-tab-content`, `audits-tab-content`, `billing-tab-content` all present in `app/edit/[reviewToken]/portal-shell.tsx`. Tab buttons emit `data-testid={\`portal-tab-${tab.id}\`}` — a literal-string grep for `portal-tab-audits` **will not match** because it is a template literal. It exists. Do not "add" it.
- **`compiler.reactRemoveProperties: false`** in `next.config.js` — this is what keeps testids in production builds. Never set it to `true`.
- **`SupabaseAdapter`'s table-agnostic methods** (`countRows`, `insert`, `select`, `purgeAgentRecords`) — being table-agnostic is why the `waas_audits` → `audits` rename did not affect QA. Do not hardcode table names into the adaptor.
- **The audit-start assertion's generic selector** (`form, input[type="url"], input[type="text"], input[placeholder*="domain"], input[placeholder*="website"], main`) — deliberately broad, survived the form rewrite. Task 4 adds precise selectors in a *new* scenario; do not tighten the existing one.
- **The `IMPORTANT: QA workflows must use QA-dedicated Supabase secrets only.` comments** in all three workflow files. These mean *use the `QA_`-prefixed secrets*, not *use a separate project*. Leave the wording as-is.
- **`SupabaseAdapter.ts`'s `Decision (Q2): Same Supabase project, \`qa\` schema.` header** and **`.env.qa.example:26`'s "SAME project as production"** — both accurate. An earlier draft of this plan wrongly called them stale drift. Task 1 corrects the *other* docs to match these, not the reverse.
- **`db: { schema: "qa" }` in `SupabaseAdapter`** — this is the entire isolation mechanism. Never widen it or add a `public` fallback.
- **`export const createWaasClient = getWaasClient` (`lib/waas/supabase.ts:267`)** — a confusing but intentional alias. It is the **anon-key** client despite the "create…Client" name, and other call sites depend on that. Do not rename it, do not repoint it at the service-role client, and do not use it in Task 6.
- **`WaasDatabase` (`lib/waas/supabase.ts:130`)** — declares `public` only. Do not add a `qa` key to it to make `.schema("qa")` type-check; Task 6a uses an untyped client precisely so this generated type stays a faithful mirror of `public`.

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
- For Task 5: whether 5c was completed or the escape hatch was taken, and which of the four auth behaviours you actually checked.
- For Task 6: whether the dashboard rendered rows on the preview, and the `SELECT count(*) FROM qa.qa_runs;` result you compared against.

### Do not merge

**You have no merge authority on this work.** Open the PRs and stop. Specifically:

- Do **not** run `gh pr merge`, and do **not** enable auto-merge.
- Do **not** push to `main` under any circumstance — Vercel auto-deploys it.
- Do **not** merge one of your own PRs to unblock another. If PR 1 must land before you can continue, say so in the PR and stop there; the remaining tasks can wait.
- Do **not** delete or force-push branches after opening the PR.

When all three PRs are open, post a short summary listing each PR number, the tasks it contains, what you verified, and anything you deliberately left undone. That summary is the deliverable.
