# Ideal vision — gap status scorecard

Status of every gap in `docs/waas/IDEAL_AUDIT_AND_BUILDER_VISION.md` (the "ideal" target,
written 2026-10-12 at `main` @ `05cd678`, #265), checked against `main` @ `4d1bd9d`
(2026-10-21), and re-checked against `main` @ `0e0da60` (2026-10-31, see the last section). Method: read the code on `main` (paths cited) and the merged-PR history
through the GitHub API. No Supabase/production data was queried. Anything not shown by
the code or the PR history is marked "unverified".

Legend: **Fixed** = the gap is closed on `main`. **Partial** = some groundwork landed but
the gap is not closed. **Open** = no work found. Priority is the vision's own (P0 =
trust/correctness risk, P1 = biggest product gains, P2 = polish/scale).

## Scorecard

### Audit (A1–A10)

| # | Pri | Finding | Status | Evidence on `main` |
|---|-----|---------|--------|--------------------|
| A1 | P0 | Overall score was almost entirely PageSpeed | **Fixed** | `audit-engine/scoring.ts` now scores `visibility` (0.35), `speed` (0.15) and more; legacy formula kept only for stored reports (#278) |
| A2 | P0 | Silent "Chicago, IL" default | **Fixed** | no `Chicago` in `audit-engine/`; `location.ts` + `location.test.ts` ("never returns Chicago unless the input says Chicago") (#274) |
| A3 | P1 | GBP / review / NAP / citation analysis missing | **Partial** | `audit-engine/gbp-analysis.ts`, `site-nap.ts`, score v3 `gbp` component, report card and PDF section (this PR). Needs the local-pack lookup on (`WAAS_LOCAL_PACK_ENABLED`). Citations across directories, review velocity and Yelp/Facebook still need other providers |
| A4 | P1 | Local pack off by default, first keyword only | **Open** | `serper/types.ts` `WAAS_LOCAL_PACK_ENABLED === "true"`; `.env.example` = `false` |
| A5 | P1 | No real on-page crawl | **Fixed** | `audit-engine/on-page-crawl.ts` (+ test) (#297) |
| A6 | P1 | Placeholder authority data (backlinks/DA = 0) | **Open** | `audit-engine/index.ts` still sets `domain_authority: 0`, `referring_domains: 0`, `estimated_traffic: 0` |
| A7 | P1 | Competitors typed in by the user | **Fixed** | `audit-engine/competitor-discovery.ts` + `directory-blocklist.ts`; typed competitors win, local pack fills up to 3, labelled AUTO-DETECTED (this PR, DEC-0032). Inactive until `WAAS_LOCAL_PACK_ENABLED=true` |
| A8 | P1 | Findings not tied to fixes or value | **Partial** | `audit-engine/findings.ts` normalizes impact and adds effort + ranking (#302); but `AuditOpportunity` (`lib/waas/types.ts`) still has no "fix in builder" action and no lead-value estimate, so 2 of the 3 original pieces are open |
| A9 | P2 | No automated re-audit/monitoring | **Open** | no `crons` in `vercel.json` |
| A10 | P2 | Zero tests on the audit engine | **Fixed** | `audit-engine/` now has `findings`, `gap-analysis`, `leaderboard`, `location`, `on-page-crawl`, `scoring` tests (#301) |

### Builder (B1–B9)

| # | Pri | Finding | Status | Evidence on `main` |
|---|-----|---------|--------|--------------------|
| B1 | P0 | Fake reviews on live sites | **Fixed** | `components/waas/sections/` has no `PLACEHOLDER_REVIEWS`; `templates/types.ts` reviews are owner-entered; `lib/waas/reviews.ts` (`stripUnverifiedReviewData`) (#299) |
| B2 | P1 | Single-page sites only | **Open** | `app/_sites/[site]/` still has only `page.tsx` (+ sitemap/robots); no service/location/blog pages |
| B3 | P1 | Owner can edit but not restructure | **Partial** | stable section ids landed (`#280`, `#279`); no reorder/add/duplicate UI in `actions/client-edit/` or `client-edit/editable-fields.ts` |
| B4 | P1 | Two builders that don't meet | **Partial** | plan written (`docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`, #275) + stable-id groundwork (#280); the block builder and the section model are still separate |
| B5 | P1 | No native lead form on tenant sites | **Fixed** | `components/waas/sections/booking-form.tsx` in the `booking` section, `lib/waas/actions/tenant-lead.ts`, migrations 033/034, email + portal Leads tab + admin filter (this PR, DEC-0033). Live after 033/034 are applied |
| B6 | P1 | Domain go-live is manual | **Open** | grep for `api.vercel.com` in `lib/` and `app/`: none |
| B7 | P1 | No analytics/tracking settings | **Open** | grep for `ga4`/`gtm`/`gtag`/`tracking_id` in `lib/waas/` and `app/_sites/`: none |
| B8 | P2 | No brand/contrast guardrails | **Open** | grep for `contrast`/`wcag`/`luminance` in `lib/waas/` and `components/waas/`: only template names |
| B9 | P2 | Preview / draft-publish / schedule | **Partial** | `app/edit/[reviewToken]/preview` exists; admin rollback + version history exist (`app/admin/dashboard/[tenantId]/version-rollback-button.tsx` "Restore" → `rollbackTenantSiteVersion`, "Recent Version History" at `page.tsx:432`); no draft-vs-published or scheduled publish |

### Engineering and repo health (E1–E5)

| # | Pri | Finding | Status | Evidence on `main` |
|---|-----|---------|--------|--------------------|
| E1 | P1 | CI didn't run lint/typecheck/tests; lint script broken | **Fixed** | `.github/workflows/ci-checks.yml` runs `typecheck`, `typecheck:qa`, `lint-changed`, `npm test`; ESLint 9 + `eslint-config-next` 16 (#277, #281–288) |
| E2 | P1 | Messy migration history | **Partial** | replayable on a fresh DB (#295), baseline (#266), ordering guard `lib/ci/migration-order.test.ts` (#313); still 48 top-level + 32 WaaS `.sql` files |
| E3 | P1 | Shared Supabase project | **Partial** | DEC-0021/0022/0023/0024 + `docs/engineering/DB_CONSOLIDATION_PLAN.md`; 029 creates the WaaS client-edit tables in `rankedceo-waas` (its application is owner-reported in `STATUS_2026-10-20.md`, not independently verified here); the CRM group is not started |
| E4 | P2 | Repo clutter and stale docs | **Fixed** | stale root clutter removed (#304) |
| E5 | P2 | No decision log | **Fixed** | `docs/engineering/DECISIONS.md` (#303) |

## Tally

- **Audit:** 5 fixed (A1, A2, A5, A7, A10), 2 partial (A3, A8), 3 open (A4, A6, A9).
- **Builder:** 2 fixed (B1, B5), 3 partial (B3, B4, B9), 4 open (B2, B6, B7, B8).
- **Engineering:** 3 fixed (E1, E4, E5), 2 partial (E2, E3), 0 open.
- **Overall:** 10 fixed, 7 partial, 7 open of 24. (Updated 2026-10-31 for the combined B5/A3/A7 PR; A3 and A7 only take effect once the local-pack flag is on, so A4 stays open.)

## What it means

All three **P0** gaps are closed: the audit score is honest (visibility and competitors
feed it, not just PageSpeed), the silent Chicago default is gone, and the fabricated
reviews are removed. Those were the "we are telling customers something untrue" risks.

Against the vision's own recommended order (Part 3):

1. B1 fake reviews — **done**.
2. A2 + A1 silent city + honest score — **done**.
3. E1 CI gate — **done**.
4. B5 + B7 lead form + tracking — **not started**.
5. A3 + A4 + A5 GBP/NAP/citations, local pack on, on-page crawl — **one of three done** (A5).
6. B2 + B3 multi-page + restructure — **not started** (B3 groundwork only).
7. A8 + A9 ranked fixes + monthly re-audit — **partial** (A8 ranking/effort landed, but no "fix in builder" action or lead-value estimate; A9 not started).
8. B6 automated domain connect — **not started**.
9. E2/E3/E4/E5 migration and ownership audit, cleanup, decision log — **E4/E5 done, E2/E3 partial**.

So the credibility layer and the engineering safety net are in place. What remains is
mostly **P1 product depth**: the audit's GBP/reputation/authority half, and the builder's
multi-page + lead-form + domain-automation half. Underneath both sits **E3** (the database
consolidation into `rankedceo-waas`), where 029 was the first concrete step.

## How each status was verified

- Fixed/partial/open status read from the code on `main` @ `4d1bd9d` by `grep`/file read
  (paths in the Evidence column), and the PR number from the merged-PR list via `gh api`.
- `npm run check` on `main` @ `4d1bd9d`: 339 tests, 0 failures.
- **Unverified:** the live values of production environment variables (for example whether
  `WAAS_LOCAL_PACK_ENABLED` is `true` in production, which would change A4); anything
  requiring a live database query.

## Maintenance

This scorecard is a point-in-time snapshot. Update it when a gap in
`docs/waas/IDEAL_AUDIT_AND_BUILDER_VISION.md` is closed, and bump the `main` ref and date
at the top.

## Re-check, 2026-10-31 (`main` @ `0e0da60`, before PR #340)

This was a snapshot taken on `main` before PR #340. Its findings are superseded by the
table and tally above, which reflect PR #340. Do not read the list below as the current
status.

- **A3, A7, B5:** open on `main` at that point. PR #340 changes all three; see the table.
- **A4** `WAAS_LOCAL_PACK_ENABLED` still defaults to `false` (`.env.example`).
- **A6** `domain_authority: 0` and `referring_domains: 0` still hardcoded in `audit-engine/index.ts`.
- **A9** no `crons` in `vercel.json`.
- **B2** `app/_sites/[site]/` still has only `page.tsx`.
- **B6** no calls to the Vercel domains API in `lib/` or `app/`.
- **B7** no GA4, GTM or tracking settings in `lib/waas/`, `app/_sites/` or `components/waas/`.

Work since 2026-10-21 that touched the vision's areas but did not close a gap:

- **E3 (still partial), database.** `rankedceo-waas` has migrations 030, 031 and 032 applied and verified (`docs/engineering/DECISIONS.md`, DEC-0027). `anon` can run only the two intended functions there. The CRM project (`wcednzaxmxwfiijzmjmx`) was found to be missing signed-in access to its RLS helper functions and to have unguarded onboarding RPCs. A fix is drafted and tested locally, not applied (DEC-0031, `docs/engineering/checks/crm_grants_*`). Paused until the CRM login is tested by hand.
- **Lead-form neighbours.** #332, #333 and #335 fixed the industry landing quote forms and their lead inserts. Those are not the tenant-site builder.
- **Smile.** #331 fixed quote pool and assessment account lookups. No gap in this scorecard.

Not re-verified: B4 PR 2 (stable ids) state, A8's builder-action half, and B9's version
history. They are marked as they were on 2026-10-21.
