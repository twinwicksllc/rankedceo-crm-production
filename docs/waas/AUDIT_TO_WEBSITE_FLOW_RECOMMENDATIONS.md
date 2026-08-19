# Audit → Website Creation Flow: Findings & Recommendations

Companion to the full step-by-step trace already recorded in
[CLIENT_JOURNEY_AUDIT_TO_WAAS_TO_LIVE.md](CLIENT_JOURNEY_AUDIT_TO_WAAS_TO_LIVE.md).
That document is the canonical journey map — this one captures what stood out while re-tracing
the pipeline in August 2026, and what to do about it, split by who benefits.

## Key findings from the trace

1. **The audit pipeline is fully synchronous** — `runFullAudit()` is awaited directly inside
   `app/api/audit/run/route.ts`. There is no queue or background worker, even though a polling
   endpoint (`app/api/waas/audits/[id]/status/route.ts`) and a `pending`/`running` status model
   already exist for one. The polling infra is unused.
2. **`app/api/waas/audits/route.ts`'s POST handler is dormant.** It creates an audit record but
   ends with `// TODO (Phase 2): Trigger SEO audit worker via queue/webhook` — it never runs the
   engine. The live path is `/api/audit/run/route.ts`. Two audit-creation endpoints exist; only
   one works.
3. **The overall-score formula is duplicated.** `lib/waas/services/audit-engine/index.ts` and
   `app/api/audit/[auditId]/pdf/route.ts` both independently compute
   `0.40*performance + 0.30*seo + 0.20*mobile + 0.10*accessibility`. If one is ever tuned without
   the other, the on-screen report and the downloaded PDF will disagree.
4. **`vercel.json` sets no `functions.maxDuration` override.** The audit run route does a site
   scrape, industry/keyword detection, multiple parallel Serper calls, a local-pack lookup, and a
   PageSpeed Insights call — all before responding. PageSpeed alone commonly takes 5–15s per call.
   Under the platform's default function timeout this is a plausible timeout source for slow
   target sites, and it would fail silently from the user's perspective (spinner → generic error).
5. **Tier 2 AI enhancement is fire-and-forget.** `generateInitialSiteFromTemplate` builds the Tier 1
   site synchronously, then dispatches a Gemini enhancement pass with no client-visible completion
   signal beyond an `ai_enhancement_status` column nobody surfaces yet.
6. **Deploy readiness is admin-only-visible.** The client never sees the same checklist
   (`getDeployReadiness`) that blocks their own launch — they only find out indirectly when admin
   tells them.
7. **The repo has 69 markdown files at root**, several of which (`REPOSITORY_ANALYSIS.md`,
   `PRODUCT_SPRINT_ROADMAP.md`, multiple `PHASE_*.md`) overlap in scope with docs already under
   `docs/`. This document intentionally lives under `docs/waas/` rather than root.

## Recommendations for the User (the audit prospect / onboarding lead)

The "user" here is whoever is going through the funnel themselves: submitting a URL for an audit,
then clicking through onboarding.

- **Make the audit wait state honest.** Since processing is synchronous and can run 10–30s+
  depending on target-site speed and keyword count, replace a bare spinner with a staged progress
  indicator ("Checking rankings… Checking page speed… Building your report") — cheap to add, and
  it sets expectations instead of feeling stuck or broken during the PageSpeed step specifically.
- **Actually use the async infra that already exists.** Move `runFullAudit()` behind a background
  job and let the frontend poll `/api/waas/audits/[id]/status` (already built, currently unused).
  This removes the function-timeout risk entirely and lets the report page show real progress
  instead of a single blocking request.
- **Let audit pre-fill skip more onboarding steps, not just pre-fill them.** `source_audit_id`
  already pulls keywords, detected industry/location, and competitor data back into onboarding
  Step 1. If a field is already known with high confidence, skip showing that sub-step rather than
  showing it pre-filled — fewer clicks between "audit result" and "site is being built."
- **Give mid-onboarding tenants a placeholder instead of a 404.** `app/_sites/[site]/page.tsx`
  only serves `status = "active"` tenants; anyone who guesses or bookmarks the URL earlier gets a
  bare 404. A "this site is being built" page reads as more trustworthy if a prospect shares the
  link early (e.g. to a business partner) before launch.

## Recommendations for the Client (the tenant — RankedCEO's paying customer)

The "client" here is the business owner who onboarded, whose own customers are the eventual site
visitors. Their priorities: confidence in progress, minimal surprises, visible ROI.

- **Close the loop on the audit score.** The tenant is already linked to their original audit via
  `source_audit_id`. Once deployed, show them a simple before/after: "Your original audit score was
  42/100 — here's what changed." This is sitting on data that already exists and is currently never
  resurfaced after onboarding — it's a natural retention/upsell moment that costs no new pipeline.
- **Surface deploy readiness to the client, not just admin.** Show the same checklist
  (`getDeployReadiness`) in the client portal (`app/edit/[reviewToken]/page.tsx`) so a client can
  fix their own blockers (missing phone number, short meta description) without waiting on an
  admin round-trip.
- **Notify on Tier 2 AI completion.** Since the enhancement pass is fire-and-forget, add a status
  chip or email when `ai_enhancement_status` flips to done, so the client knows to go look again
  rather than reviewing a stale Tier 1 variant.
- **Give domain requests a visible timeline.** The `requested → under_review → provisioning → live`
  workflow is currently admin-driven with no client-facing ETA. Even a static "domain changes
  typically take 1–3 business days" note next to their request status would reduce support
  back-and-forth.
- **Consider on-demand variant regeneration.** Only 3 AI variants are ever generated per tenant,
  and readiness requires all 3 to be valid. There's no client-facing way to say "generate me a
  4th option" or "regenerate variant 2 with a different tone" — worth scoping if variant
  dissatisfaction is a common support ticket.

## Recommendations for You (engineering/ops efficiency)

- **Delete or wire up the dormant `/api/waas/audits` POST handler.** Right now it's a trap: it
  looks functional (creates a DB row) but silently never processes anything. Either finish the
  Phase 2 TODO or remove the route so nobody integrates against it expecting it to work.
- **Extract the score formula into one shared function.** Put
  `0.40*performance + 0.30*seo + 0.20*mobile + 0.10*accessibility` in one place in
  `lib/waas/services/audit-engine/scoring.ts` (or similar) and import it from both the engine and
  the PDF route, so a future scoring tweak can't silently desync the two surfaces.
- **Add an explicit `functions.maxDuration` to `vercel.json` for the audit route**, sized to the
  worst-case chain of scrape + keyword-gen + Serper + PageSpeed calls — or better, move the work
  off the request/response cycle per the async recommendation above. Either fixes the same
  underlying risk; the explicit timeout is the cheaper stopgap if the async migration is a bigger
  lift than you want right now.
- **Consolidate root-level docs into `docs/`.** 69 markdown files at repo root makes it hard to
  find the canonical version of anything — several `PHASE_*.md` / `*_SUMMARY.md` files look like
  point-in-time session notes rather than living references. Worth a pass to archive what's
  historical and keep only living docs (like the journey map this file complements) easy to find.
- **Add a lightweight audit trail for the "who owns what" gaps.** The existing ownership model
  in the journey doc (Marketing/Delivery/Admin Ops/Client/Support) is good on paper, but nothing in
  code enforces or reports on it — e.g. there's no dashboard answer to "which pending-review
  tenants have been idle longest," which is exactly the kind of thing that surfaces once support
  volume grows.

## Implementation Plan

Thirteen initiatives, one per finding/recommendation above, grouped into three phases by
effort and dependency. Phase 1 items are independent, low-risk, and shippable individually.
Phase 2 items are moderate scope or depend on a Phase 1 item landing first. Phase 3 items need
product/design input before engineering starts and aren't purely mechanical.

### Phase 1 — independent, low-risk

**1. Add `functions.maxDuration` to `vercel.json` for the audit route**
- *Addresses:* Finding 4 (no timeout override); interim stopgap ahead of Initiative 4.
- *Approach:* Add a `functions` block scoping `app/api/audit/run/route.ts` (Next.js App Router
  route config, or the `functions` key in `vercel.json`) to a duration comfortably above the
  worst-case chain (scrape + keyword-gen + parallel Serper + PageSpeed) — measure real p95 first
  rather than guessing.
- *Files:* `vercel.json`, possibly `app/api/audit/run/route.ts` (`export const maxDuration`).
- *Effort:* S (config change + one measurement pass).
- *Risk:* Only as good as the plan's max allowed duration — if the real worst case exceeds the
  plan ceiling, this doesn't fully solve it and Initiative 4 becomes non-optional.

**2. Unify the overall-score formula**
- *Addresses:* Finding 3 (duplicated `0.40/0.30/0.20/0.10` weighting).
- *Approach:* Extract `calculateOverallScore(summary)` into
  `lib/waas/services/audit-engine/scoring.ts` (already home to related scoring logic per the
  trace) and import it from both the engine and `app/api/audit/[auditId]/pdf/route.ts`, deleting
  the PDF route's local `calculateScore`/`getGrade` duplicates.
- *Files:* `lib/waas/services/audit-engine/scoring.ts`, `lib/waas/services/audit-engine/index.ts`,
  `app/api/audit/[auditId]/pdf/route.ts`.
- *Effort:* S.
- *Risk:* None functional if the extracted formula is byte-for-byte identical to both existing
  copies — verify with a snapshot test before deleting either copy.

**3. Delete or finish the dormant `/api/waas/audits` POST handler**
- *Addresses:* Finding 2 (looks functional, never processes).
- *Approach:* Decide first — is Phase 2 of that TODO still planned? If not, remove the route (or
  have it 501/redirect to `/api/audit/run`) so nothing integrates against a silent no-op. If yes,
  this folds into Initiative 4 instead (the queue/worker it was waiting on).
- *Files:* `app/api/waas/audits/route.ts`.
- *Effort:* S (deletion) or absorbed into Initiative 4 (if kept as the async entry point).
- *Risk:* Confirm nothing external (QA scripts, admin tooling) currently POSTs to this route
  before removing it — `grep` for the path across `qa-agent/` first.

**4a. Add a staged progress indicator to the audit-wait UI**
- *Addresses:* User recommendation "make the audit wait state honest."
- *Approach:* Purely client-side for now — since processing is still synchronous, fake the stages
  ("Checking rankings… Checking page speed… Building your report") on a timer tuned to observed
  step durations. Superseded by real progress once Initiative 4 (async) ships, but doesn't need
  to wait on it.
- *Files:* `app/audit/start/audit-start-form.tsx` (or wherever the post-submit wait state lives).
- *Effort:* S.
- *Risk:* Cosmetic only — timed stages can drift from real progress on unusually slow target
  sites; acceptable as a stopgap.
- **Status: Shipped.** See PR #242 — staged copy + progress bar landed in
  `app/audit/start/audit-start-form.tsx`.

**5. Placeholder page for non-active tenants instead of a bare 404**
- *Addresses:* User recommendation (pre-launch link sharing looks broken).
- *Approach:* In `app/_sites/[site]/page.tsx`, before calling `notFound()`, distinguish
  "tenant doesn't exist" (true 404) from "tenant exists but `status !== 'active'`" (render a
  branded "this site is being built" page instead).
- *Files:* `app/_sites/[site]/page.tsx`, `app/_sites/[site]/layout.tsx` (same status check exists
  there for metadata), new lightweight component e.g. `components/waas/SiteComingSoon.tsx`.
- *Effort:* S–M.
- *Risk:* Make sure this doesn't get indexed — keep `robots.txt`/`sitemap.xml` disallow behavior
  unchanged for non-active tenants; only the HTML response changes, not crawlability.
- **Status: Shipped.** See PR #242 — `SiteComingSoon` component + per-page/layout `noindex`
  metadata for non-active tenants.

### Phase 2 — moderate scope, one dependency each

**6. Move audit processing off the request/response cycle (real async)**
- *Addresses:* Finding 1 & 4 (synchronous pipeline, timeout risk) — the durable fix Initiative 1
  is a stopgap for.
- *Approach:* Wrap `runFullAudit()` in a background job (Vercel `after()`/queue/webhook — pick
  based on what's already available in this stack) triggered by `/api/audit/run`, which now just
  creates the `pending` record and returns immediately. Wire the frontend to actually poll the
  already-built `app/api/waas/audits/[id]/status/route.ts` instead of blocking on the POST.
- *Files:* `app/api/audit/run/route.ts`, `lib/waas/services/audit-engine/index.ts` (extract to a
  callable job function), `app/audit/start/audit-start-form.tsx` (switch to poll-and-redirect),
  `app/api/waas/audits/[id]/status/route.ts` (start actually being used).
- *Effort:* M–L (the biggest architectural change in this list).
- *Depends on:* Should land after Initiative 4a's staged-UI copy exists, so the polling UI can
  reuse the same stage labels with real backing data instead of a timer.

**7. Surface Tier 2 AI enhancement completion to the client**
- *Addresses:* Finding 5, Client recommendation "notify on Tier 2 AI completion."
- *Approach:* Add a status chip in `app/edit/[reviewToken]/page.tsx` reading
  `tenant_site_config.ai_enhancement_status` (column already exists per the trace); optionally an
  email trigger on transition to `done`, reusing whatever notification pathway `admin` already
  gets pinged through elsewhere in `lib/waas/actions/admin/`.
- *Files:* `app/edit/[reviewToken]/page.tsx`, `lib/waas/client-edit/edit-session.ts` (surface the
  status field through the session shape), possibly a new notification helper.
- *Effort:* M.
- *Risk:* None structural — the data already exists, this is purely a display/notify layer.

**8. Surface deploy readiness in the client portal**
- *Addresses:* Finding 6, Client recommendation "surface deploy readiness to the client."
- *Approach:* Reuse `getDeployReadiness` (already used by admin) from a client-safe wrapper —
  audit it first for any admin-only data it returns before exposing it, then render the same
  checklist inside `app/edit/[reviewToken]/page.tsx`'s overview tab.
- *Files:* `lib/waas/actions/admin/deploy.ts` (extract/wrap for client-safe reuse),
  `app/edit/[reviewToken]/page.tsx`, `portal-shell.tsx`.
- *Effort:* M.
- *Risk:* Double-check `getDeployReadiness` doesn't leak internal fields (e.g. cost/margin data)
  not meant for client eyes — this is the one item here needing a quick security read before
  exposing an existing admin function to a new audience.

**9. Close the loop with a before/after audit score**
- *Addresses:* Client recommendation "close the loop on the audit score."
- *Approach:* On the live tenant site or client portal, pull the original audit's stored
  `summary.overall_score` via `source_audit_id`, and compare against a fresh lightweight
  re-score (or the deploy-time snapshot) to show "42 → 78." Decide whether the comparison re-runs
  a real audit (cost) or reuses cached data (cheap, eventually stale).
- *Files:* `lib/waas/actions/client-edit/` (new read action), `app/edit/[reviewToken]/page.tsx`
  or `portal-shell.tsx` for display.
- *Effort:* M.
- *Risk:* Needs a product decision on cadence (one-time at launch vs. recurring) before scoping
  further — flagged as needing input in Phase 3 framing, but the one-time launch version is
  Phase 2-sized.

### Phase 3 — needs product/design input before scoping

**10. Skip-ahead onboarding when audit pre-fill is high-confidence**
- *Addresses:* User recommendation "let pre-fill skip steps, not just fill them."
- *Open question:* What confidence threshold counts as "skip this step" vs. "show it pre-filled
  for confirmation"? Getting this wrong risks silently locking in wrong data (e.g. misdetected
  industry) with no user checkpoint. Needs a product decision on which of the 6 onboarding steps
  are ever safe to fully skip vs. always shown-but-prefilled.
- *Files (once scoped):* `app/get-started/onboarding-flow.tsx`,
  `lib/waas/actions/onboarding/steps-1-3.ts`, `lib/waas/actions/onboarding/audit.ts`.

**11. Visible timeline for domain requests**
- *Addresses:* Client recommendation "give domain requests a visible timeline."
- *Open question:* Is a static SLA string enough, or does this need real status timestamps per
  stage (`requested_at`, `provisioning_started_at`, etc.)? The former is a Phase 1-sized copy
  change; the latter needs a schema addition to `domain_requests`. Needs a call on which before
  scoping further.
- *Files (once scoped):* `app/edit/[reviewToken]/domain-status-card.tsx`,
  `lib/waas/actions/admin/domains.ts`, possibly a migration.

**12. On-demand variant regeneration**
- *Addresses:* Client recommendation "consider on-demand variant regeneration."
- *Open question:* Is this actually a common pain point, or a hypothetical? Recommend checking
  support ticket history before scoping — if it's rare, the fixed-3-variants model may be fine as
  is. If real, needs a decision on quota (unlimited regen invites cost/abuse, so likely needs a
  cap per tenant) before engineering starts.
- *Files (once scoped):* `lib/waas/actions/admin/variants.ts`, `ai-variants-panel.tsx`, client
  portal equivalent.

**13. Idle pending-review tenant reporting**
- *Addresses:* Efficiency recommendation "audit trail for who-owns-what gaps."
- *Open question:* This is really an ops/support process question first — what threshold counts
  as "idle" (1 day? 1 week?), and who should be notified? Once that's decided, the engineering
  side is a straightforward query + admin dashboard widget over existing `tenants.status` and
  `updated_at`.
- *Files (once scoped):* `app/admin/dashboard/page.tsx`, `lib/waas/actions/admin/index.ts`.

### Not separately scoped

**Doc consolidation** (Finding 7) and **removing the dormant audits POST route** (Initiative 3)
are housekeeping, not user-facing features — do them opportunistically rather than scheduling
them into a phase.
