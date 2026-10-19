# Decision log

This file is the canonical record of the product and engineering decisions for the
RankedCEO CRM and the WaaS product. Some plan documents also restate decisions (for
example `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md` section 5 lists DEC-0014 to
DEC-0016); where they differ, this file is authoritative. Before this file existed,
the decisions lived only in code comments, plan documents and PR bodies, so some
were cited by number but never written down.

Each entry has: the ID, the date it was decided (where known), its status, the
decision itself, where it is used, and the source of the wording.

Status values: **in force**, **implemented**, **on hold**, **superseded**. Implementation state
(built or not) is recorded separately on each entry.

---

## DEC-0001 — Do not merge the Tailwind 4 Dependabot PR

- Date: 2026-10-12
- Status: in force
- Decision: Dependabot PR #270 (tailwindcss 3.4 → 4.3) is closed and ignored as a
  major version. Tailwind 4 will be done as a planned migration, not a dependency
  bump. Reason: major breaking changes (the PostCSS plugin, the `@tailwind`
  directives, the config) and both Vercel builds failed.
- Used in: Dependabot (#270).
- Source: reconstructed from the closed Dependabot PR #270 and my notes.

## DEC-0003 — Location comes from the client, never a default city

- Status: implemented (#274)
- Decision: The audit market comes from the client's intake form or their website.
  We never fall back to a default city (the old code defaulted to "Chicago, IL").
  Searching the wrong market produces misleading rankings. If no location can be
  resolved, the audit stops before any search or PageSpeed calls are made and is
  sent to manual review.
- Used in: `lib/waas/services/audit-engine/location.ts`,
  `lib/waas/services/audit-engine/index.ts`, `lib/waas/services/serper/index.ts`,
  `lib/waas/supabase.ts`, `app/audit/[auditId]/client.tsx`.
- Source: reconstructed from code comments.

## DEC-0004 — Real reviews only

- Date: 2026-10-16
- Status: in force
- Decision: Reviews shown to visitors must be real. Placeholder or fake reviews
  must never be displayed. Review proof (the reviews themselves, or a Google rating
  aggregate) only shows when it is real. When there is no proof, the section shows
  no fake reviews: it either stays hidden or shows a standalone CTA when the client
  has a valid Google review URL (`shouldRenderReviewSection` in
  `lib/waas/reviews.ts`). The reviews section is not offered in the section library
  until real reviews exist. Real reviews are entered manually.
- Used in: `components/waas/sections/ReviewNFCSection.tsx`, `lib/waas/reviews.ts`,
  `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: confirmed by Tommy, 2026-10-16.

## DEC-0005 — Extra pages are team-sold

- Date: 2026-10-16
- Status: in force
- Decision: Extra pages (additional service or location pages beyond the standard
  site) are sold and set up by the team, not self-serve. A client cannot add them
  on their own.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: confirmed by Tommy, 2026-10-16.

## DEC-0006 — Lead form is team-sold

- Date: 2026-10-16
- Status: in force
- Decision: The native lead form (a form on the tenant site that sends leads into
  the CRM) is sold and set up by the team, not self-serve. A client cannot turn it
  on themselves.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: confirmed by Tommy, 2026-10-16.

## DEC-0007 — One consistent builder, admin review and upsell

- Status: in force
- Decision: There is one consistent website builder for the client. The client's
  finished site is handed to admins for review and upsell.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: reconstructed from the B4/B3 plan.

## DEC-0008 — Analytics and tracking are team-sold

- Date: 2026-10-16
- Status: in force
- Decision: Analytics and tracking (GA4, Google Tag Manager, call tracking) are
  sold and set up by the team, not self-serve. A client cannot add tracking IDs
  themselves.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: confirmed by Tommy, 2026-10-16.

## DEC-0012 — Checks before every push

- Status: in force
- Decision: Every PR runs typecheck, tests and lint on the files it changes before
  it is pushed.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`, `package.json`
  (`npm run check`), `.github/workflows/ci-checks.yml`.
- Source: reconstructed from the B4/B3 plan and `npm run check`.

## DEC-0013 — Supabase is on hold; no database work from me

- Status: superseded by DEC-0021 (2026-10-19)
- Decision: The shared Supabase project is being cleaned up and migrated by another
  team. Until that is settled, no database work is done from my side: no migrations,
  no live-data access, no writes. Work that needs a database change is written up
  but held.
- Used in: STATUS docs, all plan documents.
- Source: reconstructed from the STATUS docs.

## DEC-0014 — Onboarding step 6 becomes the Layout editor

- Date: 2026-10-12
- Status: in force
- Implementation: not yet built (planned for B4/B3 plan PR 5).
- Decision: The onboarding block builder stops being a separate product. Onboarding
  step 6 becomes the same Layout editor the client gets later. One consistent
  builder.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: transcribed from the B4/B3 plan, section 5.

## DEC-0015 — Maximum 3 copies per section type

- Date: 2026-10-12
- Status: in force
- Implementation: not yet built (planned for B4/B3 plan PR 3).
- Decision: A section type can be duplicated up to 3 times, matching the client
  regeneration limit (`client_regen_quota` defaults to 3). Hero and booking are
  limited to 1 because they are locked. The limit will be one constant in code
  (`MAX_SECTIONS_PER_TYPE = 3`), not tied to the database column. That constant
  does not exist yet; it is a guardrail for the future Layout editor.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: transcribed from the B4/B3 plan, section 5.

## DEC-0016 — The admin Add-ons panel is out of onboarding

- Date: 2026-10-12
- Status: in force
- Decision: The admin Add-ons panel is not part of client onboarding. It moves to a
  separate "what do admins do once a client onboards" plan.
- Used in: `docs/waas/B4_B3_UNIFIED_BUILDER_PLAN.md`.
- Source: transcribed from the B4/B3 plan, section 5.

## DEC-0017 — Every PR opens as a draft

- Status: in force
- Decision: Every new PR opens as a DRAFT. I do the initial review myself (run
  `npm run check`, read `docs/engineering/COPILOT_FINDINGS_CATALOG.md`, read my own
  diff) and post my findings in the PR body. Only Tommy moves a PR out of draft and
  requests the Copilot review.
- Used in: all PRs; `docs/engineering/COPILOT_FINDINGS_CATALOG.md`.
- Source: reconstructed from PR history.

## DEC-0018 — My checks must catch what Copilot would

- Status: in force
- Decision: Copilot reviews may stop at any time, so my own checks must catch what
  Copilot would have caught.
- Used in: all PRs.
- Source: reconstructed from PR history.

---

## DEC-0021 — Database access is allowed, limited to tables our own code calls

- Date: 2026-10-19
- Status: in force
- Implementation: the rule is decided. Supabase credentials and a QA database have
  not been provided yet, so no live access exists until they are.
- Decision: I may create net-new tables and alter tables that our own code calls by
  exact name (verified by grep of `.from()` and `.rpc()`). I never guess a table
  name, and I never touch a table our code doesn't call. Triggers on `auth.users`
  stay off-limits.
- Supersedes: DEC-0013.
- Used in: all database work (for example the B3 PR 3 layout RPC migration).
- Source: Tommy, 2026-10-19; wording confirmed as written.

---

## DEC-0022 — Our tables move into rankedceo-waas; rankedceo-crm is left to the other product

- Date: 2026-10-19
- Status: in force
- Implementation: not started. Nothing has been moved, created or copied. Neither live
  database has been inspected, and no credentials have been provided.
- Decision: `rankedceo-waas` becomes the single Supabase project for our product.
  The tables our own code calls that currently live in `rankedceo-crm` are to be
  recreated in `rankedceo-waas`. `rankedceo-crm` is left to the other product, which
  shares it. No new Supabase project is created for the combine.
- Scope, by grep of `.from()` in `app`, `lib` and `components` against the
  `CREATE TABLE` statements in `supabase/migrations` (counted 2026-10-19, repo only):
  44 names are called by our code. 23 are created only by the CRM migrations, 14 only
  by the WaaS migrations, 2 (`accounts`, `users`) by both, and 5 are created by no
  `CREATE TABLE` the grep matched. Of those 5, read from the code and migrations:
  `logos` is a storage bucket, not a table; `qa_runs` and `qa_scenarios` are created
  as `qa.qa_runs` and `qa.qa_scenarios` by `waas/021_qa_schema.sql`; `waas_tenants` is
  queried once (`section-regen.ts`) while the migration creates `tenants`; and
  `audit_abandonment_tracking` has no CREATE in any `.sql` or `.md` file. The last two
  are unexplained and need a live check.
- Open: `accounts` and `users` exist in both migration sets and need a decision on
  which definition wins. `auth.users` is separate in each project, so moving logins
  is a separate live-data step. Whether to create a separate `rankedceo-qa` project
  is undecided; it may cost money (see "no new expenses until revenue"), and that has
  not been checked against the Supabase plan.
- Rules that still apply: DEC-0021 (only net-new tables, or tables our code calls by
  exact name) and the rule never to edit the live `handle_new_user()` trigger.
- Used in: all database work.
- Source: Tommy, 2026-10-19 (chose option A of three).
- Scope note: see DEC-0023 for `pipeline_stages`.

---

## DEC-0023 - `pipeline_stages` is in scope as a dependency of `deals`

- Date: 2026-10-19
- Status: in force
- Implementation: not started. Part of the DEC-0022 work.
- Decision: `pipeline_stages` is included in the tables recreated in `rankedceo-waas`,
  even though our code does not call it by name. `deals`, which our code does call, has
  a foreign key to it, so `deals` cannot be created without it. Under DEC-0021 this
  counts as a net-new table.
- Scope: only `pipeline_stages`. It does not extend DEC-0021 to any other table our
  code does not call.
- Used in: the DEC-0022 database work.
- Source: Tommy, 2026-10-19 (chose option A of three).

---

## Not yet recorded

The numbers **DEC-0002, DEC-0009, DEC-0010 and DEC-0011** are not defined anywhere
in the repo or in my notes. They were either never used or were decided verbally and
not written down. If they were real decisions, they should be added here.

**DEC-0019** is not defined anywhere in the repo or in my notes. **DEC-0020** is not
in the repo either, but my working notes cite it as the rule "never edit the live
`handle_new_user()` trigger" (the same rule is stated in
`docs/waas/USER_IDENTITY_CONSISTENCY_PLAN.md`). It has not been confirmed as a
log entry, so it is not written here yet.
