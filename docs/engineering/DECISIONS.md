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

## DEC-0024 - QA is the repurposed rankedceo-crm-production; no new project is created

- Date: 2026-10-19
- Status: in force
- Implementation: not started. It depends on both combines being finished first (see
  below), and neither has begun.
- Decision: No new Supabase project is created for QA. Once (a) our tables are combined
  into `rankedceo-waas` (DEC-0022) and (b) the other product's `listing-assistant-pro`
  is combined into `listrassistr-official`, the `rankedceo-crm-production` project is
  repurposed as the QA project. This avoids the roughly $10 a month a new project would
  cost ("no new expenses until revenue"). Until both combines are done, QA runs against
  `rankedceo-waas` at `qa.rankedceo.com`. Only the QA agent's bookkeeping
  (`qa.qa_runs`, `qa.qa_scenarios`) is isolated in the `qa` schema; the browser-driven
  QA flows write to the `public` tables in `rankedceo-waas`, the same project as
  production, so application data is **not** isolated (see
  `docs/deployment/qa-deployment.md`).
- Amends DEC-0022: DEC-0022 says `rankedceo-crm` "is left to the other product". That
  wording is now incomplete. The project is left to the other product only until its own
  combine into `listrassistr-official` is done; after that it is repurposed as QA, not
  kept by the other product. The rest of DEC-0022 is unchanged.
- Naming: `rankedceo-crm` (the short name DEC-0022 uses) and `rankedceo-crm-production`
  (the project name in `docs/engineering/DB_CONSOLIDATION_PLAN.md`) are the same
  Supabase project, the one reached by `NEXT_PUBLIC_SUPABASE_URL`. This entry uses the
  canonical `rankedceo-crm-production`.
- Note: this is separate from the Vercel project named `rankedceo-crm-qa`, which is a
  hosting project and not the Supabase QA database.
- Used in: the DEC-0022 database work and `docs/engineering/DB_CONSOLIDATION_PLAN.md`
  (section 9).
- Source: Tommy, 2026-10-19 (his QA plan, recorded after the live audits).

---

## DEC-0025 - Production admin code uses the CRM project (E3 D4)

- Date: 2026-10-22
- Status: in force (a confirmed fact that the E3 plan depends on, recorded so it is not
  re-asked)
- Decision: In Vercel Production, `NEXT_PUBLIC_SUPABASE_URL` points at
  `rankedceo-crm-production` (`wcednzaxmxwfiijzmjmx`) and `NEXT_PUBLIC_WAAS_SUPABASE_URL`
  points at `rankedceo-waas` (`klgvdvryewykzlumbkei`). So the admin client in
  `lib/waas/actions/admin/_shared.ts` is **pointed at** the CRM project's copies of the
  WaaS tables, while the client-facing WaaS code uses `rankedceo-waas`. The client switch
  (E3 step 8) ends the split. The data copy must also reconcile the CRM project's copies
  of the WaaS tables.
- Condition: `getAdminClient()` also passes `SUPABASE_SERVICE_ROLE_KEY`. The admin
  actions actually read and write the CRM copies only if that key belongs to the CRM
  project. If it belongs to another project, they fail instead. Not verified: only the
  URL refs were read, never a key.
- Not confirmed: the Production anon and service-role keys were not checked against
  their URLs. The test is: in Supabase → CRM project → Settings → API Keys, does the
  service-role key shown there match the start of the one in Vercel? Compare it by eye;
  never paste it.
- Used in: `docs/engineering/E3_CLIENT_SWITCH_PLAN.md` (D4),
  `docs/engineering/DB_CONSOLIDATION_PLAN.md` (sections 6 and 9).
- Source: Tommy, 2026-10-22 (option A: both refs as expected).

---

## DEC-0026 - No logins are moved to rankedceo-waas; users sign up again (E3 D1, D2, D6)

- Date: 2026-10-22
- Status: in force
- Decision: There are no external users. The only logins are Tommy, his partner and
  test users, and they can create new logins at any time. So no `auth.users` row is
  moved, invited or created in `rankedceo-waas` ahead of the cutover. After the client
  switch they sign up again. The WaaS `handle_new_user()` trigger creates each new
  user's account and profile, and `ensureCrmProfile()` then finds the profile and does
  nothing.
- Replaces: E3 D1 option A (invite the 11 CRM users), D2 steps 1 and 2 (uid map and id
  rewrite), and D6 in `docs/waas/USER_IDENTITY_CONSISTENCY_PLAN.md` (which
  profile-less logins get a profile).
- Consequences: the 11 CRM logins stay in `rankedceo-crm-production`, untouched, until
  DEC-0024. The 2 existing `rankedceo-waas` auth users are kept. New profiles get
  `users.role = 'rep'`, so admin access comes from the `WAAS_ADMIN_EMAILS` allowlist or
  the `app_metadata` claim, and that allowlist must be set before the cutover.
- Still open: which data rows (leads, chat conversations, the CRM copies of the WaaS
  tables) are copied. This decision covers logins only.
- Used in: `docs/engineering/E3_CLIENT_SWITCH_PLAN.md` (section 1c, D1, D2, sequence),
  `docs/waas/USER_IDENTITY_CONSISTENCY_PLAN.md` (D6).
- Source: Tommy, 2026-10-22 ("Users are a non-issue").

---

## DEC-0027 - Lock submit_smile_assessment_with_pool to the service role (E3 D5)

- Date: 2026-10-22
- Status: in force. Implementation: **applied 2026-10-22.**
- Implementation: migration `supabase/migrations/waas/032_revoke_smile_pool_rpc.sql`,
  applied by Tommy by hand in `rankedceo-waas` on 2026-10-22 ("Success. No rows
  returned"). VERIFIED: `docs/engineering/checks/032_postcheck.sql` run live the same
  day, all 6 rows PASS. Row 4 listed exactly `get_smile_pool_account_id` and
  `resolve_tenant_by_hostname` as the only anon-callable SECURITY DEFINER functions in
  `public`.
- Decision: option B. `submit_smile_assessment_with_pool()` is SECURITY DEFINER, takes
  `p_account_id` and checks only that the account exists, so with the anon grant from
  030 anyone with the public key could write a patient record into any account. Only
  `service_role` keeps EXECUTE. The function body is not changed.
- Why B over A (add an ownership check): A guards a function nobody calls. A code
  search across every twinwicksllc repo and this repo's history found no caller, and
  this repo writes assessments through the table and its RLS policies.
- Why B over C (accept the risk): C leaves an anon path for writing medical-history
  data in the project that will serve production.
- Also in 032: `get_smile_account_id` loses its direct `anon` grant (from Supabase's
  default ACL); `authenticated` keeps the grant 030 gave it.
  `get_smile_pool_account_id` stays anon-callable, because it only returns the fixed
  pool id.
- Used in: `docs/engineering/E3_CLIENT_SWITCH_PLAN.md` (D5).
- Source: Tommy, 2026-10-22 ("B please").

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
