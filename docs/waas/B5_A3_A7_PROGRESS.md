# Progress tracker: B5 + A3 + A7 (and the parked CRM grants work)

Last updated: 2026-10-31 (review fixes for PR #340 added). Branch: `ccr-d199a1f3-go2zy8`. **If a session is interrupted, read this file first**, then `git log --oneline origin/main..HEAD`.

Status legend: DONE (committed and pushed), TODO (not started), BLOCKED-ON-TOMMY (needs a person).

## Decisions already made (Tommy, 2026-10-31)

| Topic | Decision |
|---|---|
| Local pack flag | `WAAS_LOCAL_PACK_ENABLED` code default stays `false`. On in Vercel Preview first, Production after about a week of Serper spend review. While off, `/api/audit/run` still requires one typed competitor. |
| Tenant form spam guard | Honeypot + minimum fill time (2s) + per-hour rate limit counted in `leads` (5 per IP, 3 per email). No reCAPTCHA (custom tenant domains). |
| Form default for live tenants | ON. Form only if no Calendly link; "Prefer to send a message?" form under the Calendly embed if there is one. Owner can switch off. Built by extending the required `booking` section, not a new section type. |
| Scope | One PR with everything, including a tenant portal Leads tab. Built as one commit per epic so it can be split. |

Full original plan (kept for reference): `/root/.claude/plans/plan-the-work-for-staged-cherny.md` (lives in the session container and may be gone; this file is the durable copy).

## Epic commits, in order

| # | Commit | Epic | State |
|---|---|---|---|
| 1 | `b83480a` | Shared, time-limited Serper `/places` lookup (`audit-engine/local-pack.ts`, 8s timeout, memoised, never throws) | DONE |
| 2 | `4db62a8` | A7 competitor auto-discovery (`competitor-discovery.ts`, `directory-blocklist.ts`, route/form/report changes, DEC-0032) | DONE |
| 3 | `085aaf5` | A3 GBP/NAP/review analysis (`gbp-analysis.ts`, `site-nap.ts`), scoring v3 with a `gbp` component, findings | DONE |
| 4 | `ade35e3` | A3 report card (`components/audit/gbp-card.tsx`), PDF section, shared wording `gbp-summary.ts` | DONE |
| 5 | `a5ec1ce` | Migrations `033` (enum value, run alone) and `034` (columns, indexes, CHECK) + `docs/engineering/checks/034_postcheck.sql` | DONE (not applied) |
| 6 | `63b927b` | B5 server side: signed tenant token, validation, spam guard, intake service, `tenant_lead_received` email (escaped), `submitTenantLead` action | DONE |
| 7b | (review-fix commit) | PR #340 review fixes: PageSpeed and crawl start before waiting on `/places`; malformed `tel:` links skipped; atomic lead rate limit via migration 035; preview pages never get a lead token (`previewMode`); portal shows a load error instead of an empty list; gap scorecard re-check section relabelled; Places fixture test | DONE |
| 7 | `b402b28` | B5 UI: `booking-form.tsx`, booking section wiring, editor config keys, portal Leads tab, admin "Website Forms" filter, gap scorecard, env docs, DEC-0033 | DONE |

Checks at the last commit: `tsc --noEmit` clean, `npm --prefix qa-agent run typecheck` clean (needs `npm --prefix qa-agent ci --ignore-scripts` first), `lint:changed` no new errors, `npm test` 582 pass / 0 fail.

Earlier docs commits on the same branch: `98ea0de` (DEC-0031, `STATUS_2026-10-31.md`, CRM grants rollback fix), `9306db3` (gap scorecard re-check), plus the first CRM grants draft commit.

## Where things live

- Audit engine: `lib/waas/services/audit-engine/` (`index.ts` runs everything; places lookup happens right after location resolution, before rankings, because competitor discovery feeds the rankings).
- Score: `scoring.ts`, `SCORE_VERSION = 3`; `getDisplayScore` shows any stored version >= 2 as stored.
- Lead form: `components/waas/sections/booking-form.tsx`, `lib/waas/actions/tenant-lead.ts`, `lib/waas/services/tenant-lead-{service,guard}.ts`, `lib/waas/lead-form-token.ts`, `lib/waas/booking-form-config.ts`, `lib/waas/validation/tenant-lead.ts`.
- Form settings are `config` keys on `booking`: `formEnabled`, `formHeading`, `formButtonLabel`, `formSuccessMessage`, `formServices` (allow-list in `lib/waas/client-edit/content-paths.ts`, definitions in `editable-fields.ts`).
- Portal: `app/edit/[reviewToken]/leads-tab.tsx`, `lib/waas/client-edit/tenant-leads.ts`, `lib/waas/actions/client-edit/leads.ts`.
- Decisions: `docs/engineering/DECISIONS.md` (DEC-0031 CRM grants, DEC-0032 A7, DEC-0033 B5).

## Remaining steps

| Step | Who | State |
|---|---|---|
| Apply `033_waas_leads_tenant_site_source.sql` to `rankedceo-waas` (alone, let it finish) | Tommy | BLOCKED-ON-TOMMY |
| Apply `034_waas_leads_tenant_site_columns.sql`, then run `docs/engineering/checks/034_postcheck.sql` (expect 6 PASS) | Tommy; Claude can run the read-only post-check | BLOCKED-ON-TOMMY |
| Apply `035_insert_tenant_lead_limited.sql` after 033 and 034 (atomic rate limit; the form will not submit without it) | Tommy | BLOCKED-ON-TOMMY |
| Set `WAAS_LEAD_FORM_SECRET` and `WAAS_LEAD_IP_SALT` in Vercel (form is hidden on live sites without a secret) | Tommy | BLOCKED-ON-TOMMY |
| Apply migrations BEFORE deploying to Production (else visitors see the "call us" fallback and no lead is saved) | Tommy | BLOCKED-ON-TOMMY |
| Open the PR for this branch (not opened; branch also carries the earlier docs commits) | Claude, when asked | TODO |
| Vercel Preview: set `WAAS_LOCAL_PACK_ENABLED=true`, run one real audit with no typed competitors; expect exactly one Serper `/places` call, 3 AUTO-DETECTED competitors, a GBP card, `score_version` 3 | Tommy + Claude | TODO |
| Save the real `/places` response as a test fixture; confirm field names (`phoneNumber`, hours, thumbnail). Code is defensive and skips absent fields, but they were assumed | Claude | TODO |
| Preview: open an existing tenant site, confirm the booking form looks right in its brand; submit it; check the email, `/admin/leads` and the portal Leads tab; trip the honeypot and rate limit | Tommy + Claude | TODO |
| Open an old stored v2 audit report to confirm it still renders and the PDF still builds | Tommy | TODO |
| Production flag rollout after about a week of Serper spend review | Tommy | TODO |
| Optional follow-ups: AUTO-DETECTED badge on leaderboard/gap analysis/local-pack panel (only on the deep-dive card now); owner-email fallback for tenants with no contact email; A3 deferrals below | Claude | TODO |

## Known gaps and things not verified

- Never run against the real Serper API, a live Supabase, or a browser. Report page, PDF and portal tab were typechecked and (for the GBP card and booking form) server-rendered with a script, not exercised end to end.
- Differences from the original plan: settings in `config` not content; signed-token tenant check instead of host matching; no owner-email fallback; emails stop after 20 leads per tenant per hour instead of a digest.
- A3 deliberately excludes: directory citation consistency (needs BrightLocal/Whitespark/Moz Local), review velocity and sentiment (Places API details or a reviews endpoint), Yelp/Facebook presence, official GBP state/photos/Q&A (Business Profile API, owner OAuth).
- Still open from the scorecard: A4 (flag default), A6 (authority data), A9 (re-audit), B2, B6, B7, B8.

## Parked workstream: CRM project grants (DEC-0031)

Parked by Tommy until the CRM login can be tested by hand. Nothing applied.
- Findings (verified read-only, 2026-10-31): in `wcednzaxmxwfiijzmjmx`, `authenticated` cannot run `get_current_user_account_id()` (about 90 RLS policies use it) or the five onboarding RPCs, and those RPCs update any account id they are given.
- Files: `docs/engineering/checks/crm_grants_{check,fix.DRAFT,rollback,local_harness,local_tests}.sql`. Local test: 10 of 17 checks pass before the fix, 17 of 17 after; rollback verified identical.
- Open: Tommy signs in to the CRM as a normal user and tries contacts + onboarding; who revoked the live grant; keep or drop the email fallback; approval to apply (re-read live function bodies first).

## How to resume

1. `git fetch origin ccr-d199a1f3-go2zy8 && git log --oneline origin/main..origin/ccr-d199a1f3-go2zy8`
2. `npm ci` and `npm --prefix qa-agent ci --ignore-scripts`, then `npm run check`.
3. Pick the next TODO above. Do not apply migrations or change live Supabase without Tommy's go-ahead.
