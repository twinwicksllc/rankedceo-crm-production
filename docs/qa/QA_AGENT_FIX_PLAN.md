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

Tasks 1 → 3 are independent and can go in one PR. **Task 5 must be a separate PR** (higher risk). **Task 6 is investigate-only** — report before fixing.

Task 3 is a hard prerequisite for Task 4, because the Task 4 scenario targets testids that Task 3 adds. **Task 4 is also blocked on a user decision** about writing real rows to the production WaaS project — see the warning in that task. Ship Tasks 1–3 first; do not hold them up waiting on Task 4.

> **Out of scope but urgent — do not action here.** A live Supabase Personal Access Token is committed at `supabase-mcp-client/run-rls-optimization.js:5` and has been in git history since `6c0f9d5` (PR #178). It is being handled separately and needs revocation, not a code edit. Do not touch that file as part of this plan, and do not paste the token into a commit message, PR description, or issue.

| # | Task | Files | Risk |
|---|---|---|---|
| 1 | Fix stale Supabase guidance in `.env.qa.example` | 1 | none (docs) |
| 2 | Add missing `QA_AUDIT_ID` to `.env.qa.example` | 1 | none (docs) |
| 3 | Add `data-testid` hooks to audit report states | 2 | low |
| 4 | New QA scenario covering the async audit flow | 2 | low |
| 5 | Clear `next.config.js` deprecation warnings | 2 | **medium — separate PR** |
| 6 | QA dashboard reads the `qa` schema from the wrong project | 1 | **investigate first — do not blind-fix** |

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

**Do not merge Task 4 until this is settled with the user.** Present these options rather than picking one:

- **(a) Accept the rows.** Weekly cadence, one row per run. Cheapest. Needs a documented way to identify them — the target URL `https://example.com` makes them greppable, and an admin could periodically delete `audits` rows with that target.
- **(b) Point the QA deployment at a throwaway WaaS project.** Real isolation, but requires provisioning a project, running the full `supabase/migrations/waas/` set including `021_qa_schema.sql`, and reseeding `QA_AUDIT_ID`. This is the only option that makes the async scenario genuinely non-destructive.
- **(c) Drop the submit steps.** Keep only the read-only half: navigate directly to `/audit/${QA_AUDIT_ID}` and assert the completed-report testid from Task 3. Loses the actual async-dispatch coverage — which is the entire point of the task — but costs nothing.

**Also confirm what `qa.rankedceo.com` points at before running this.** Nothing in the repo documents it (see "Still unverified" in the Supabase model section). If that deployment happens to use the CRM project rather than WaaS, the audit flow will fail for unrelated reasons and the scenario failure will be misleading.

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

## Task 6 — QA dashboard reads the `qa` schema through the wrong Supabase client

**Investigate before changing anything.** This was found while resolving the Supabase question and is a genuine cross-project mismatch, but the correct fix depends on facts you must confirm first.

**The mismatch:**

| Side | Client | Project | Credential |
|---|---|---|---|
| Agent **writes** `qa` schema | `SupabaseAdapter` | `NEXT_PUBLIC_WAAS_SUPABASE_URL` → **rankedceo-waas** | service role |
| Dashboard **reads** `qa` schema | `lib/waas/actions/qa.ts` → `@/lib/supabase/server` | `NEXT_PUBLIC_SUPABASE_URL` → **rankedceo-crm** | anon key |

`lib/waas/actions/qa.ts` imports `createClient` from `@/lib/supabase/server` (line 12) and calls `.schema("qa")` at **7 sites** against `qa_runs` and `qa_scenarios`. But `lib/supabase/server.ts:8-9` uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the CRM project — while `CREATE SCHEMA qa` exists only in `supabase/migrations/waas/021_qa_schema.sql`, the WaaS set.

**Two independent reasons this would fail**, so confirm which (or both) applies:

1. **Wrong project** — unless `021_qa_schema.sql` was also manually run against `rankedceo-crm`, the schema simply does not exist there and every dashboard query errors or returns empty.
2. **Wrong credential** — `021_qa_schema.sql` grants RLS policies to `service_role`. The dashboard uses the **anon** key, so even in the right project, anon reads would be denied.

**Investigate in this order:**

1. Load the QA dashboard in the app. Does it show runs, or is it empty/erroring? If it has *always* been empty, that is the symptom.
2. Check whether the `qa` schema exists in `rankedceo-crm` (it may have been applied to both projects manually — the migration directory convention is not enforced at runtime).
3. Check whether `qa` is in Settings → API → Extra search path for whichever project is correct — the adaptor and the dashboard both need this.

**Then choose the fix based on what you found** — do not guess:

- If the schema lives only in WaaS: repoint `lib/waas/actions/qa.ts` at the WaaS client. Check how other WaaS server actions obtain their client (e.g. `createWaasClient` / `getWaasAdminClient` in `lib/waas/supabase.ts`) and match that pattern rather than inventing one.
- If RLS is the blocker: the read path needs a service-role client, which means it must stay server-side. Confirm these are server actions (they are — `revalidatePath` is imported) before switching credentials, and never expose a service-role key to the client.

**Report findings rather than forcing a fix.** If the dashboard turns out to work fine, say so and close the task — it would mean the schema was applied to both projects, and the only change needed is a comment in `lib/waas/actions/qa.ts` explaining that.

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
- Nothing in the repo documents what the `qa.rankedceo.com` Vercel deployment uses for Supabase. `git grep -i "rankedceo-crm-qa"` returns nothing; there is no QA section in `docs/deployment/`. The only app-level acknowledgement of the host is `middleware.ts:49-50` (`QA_WAAS_HOST`, `QA_WAAS_TENANT_SLUG`), which is host routing only. **Confirm this in the Vercel dashboard before running Task 4.**

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
