# Database consolidation plan (DEC-0022, DEC-0023)

Status: **plan only. Nothing has been created, moved or copied.** First written
2026-10-19 from the repository alone, then updated the same day after two live read-only
audits. For each audit, Tommy ran `SELECT` queries in each Supabase project and pasted
the results; I did not connect to either database. Audit 1 (seven queries per project)
covered the live table lists, the shapes of `accounts` and `users`, the functions, the
`auth.users` triggers, the storage buckets and the row counts. Audit 2 (18 queries: the
`WaaS-A*` set in `rankedceo-waas` and the `CRM-B*` set in `rankedceo-crm-production`)
covered the live function bodies, the columns, foreign keys, indexes and RLS policies of
the target tables, the table triggers, the RLS flags, and the account rows. Wording used
below: **repo** = read in this repository by grep or by opening the file; **audit** =
read from Tommy's pasted results; **not verified** = neither of those has shown it.

The decision this plan implements is DEC-0022: `rankedceo-waas` becomes the single
Supabase project for our product and our CRM tables are recreated there. DEC-0021
limits what may be touched: net-new tables, or tables our own code calls by exact name.
DEC-0023 puts `pipeline_stages` in scope. The reason for combining is cost: each extra
Supabase project is about $10 a month (Tommy, 2026-10-19).

Project names: `rankedceo-waas` is the WaaS project (ref `klgvdvryewykzlumbkei`,
confirmed by Tommy as the target of `NEXT_PUBLIC_WAAS_SUPABASE_URL`).
`rankedceo-crm-production` is the CRM project (`NEXT_PUBLIC_SUPABASE_URL`).

## 1. What the audit found

Our code calls 44 names through `.from()` (repo): 43 tables and 1 storage bucket (`logos`). Checked against the live
`public` and `qa` tables in each project (audit):

| Where the name is live | Count | Names |
|---|---|---|
| In `rankedceo-waas` | 11 | `accounts`, `audits`, `client_variant_edit_events`, `domain_requests`, `leads`, `qa_runs`, `qa_scenarios`, `site_templates`, `tenant_site_config`, `tenants`, `users` |
| Only in `rankedceo-crm-production` | 28 | 22 from the CRM migrations: `activities`, `agent_conversations`, `appointments`, `calendly_connections`, `campaign_emails`, `campaigns`, `commission_rates`, `commissions`, `companies`, `contacts`, `crm_billing_events`, `crm_subscriptions`, `deals`, `email_messages`, `email_templates`, `email_threads`, `form_fields`, `form_submissions`, `forms`, `industry_leads`, `pipelines`, `smile_assessments`. 6 from the WaaS migrations: `client_domain_change_requests`, `client_uploaded_assets`, `notification_log`, `tenant_site_deployments`, `tenant_site_variants`, `tenant_site_versions` |
| In neither project | 5 | `audit_abandonment_tracking`, `calendar_provider_connections`, `tenant_variant_regenerations`, `waas_tenants`, and `logos` (a storage bucket, see section 5) |

11 + 28 + 5 = 44 names (43 tables plus the `logos` bucket), counted by script. The CRM project also lists all 11 names (audit). `docs/waas/USER_IDENTITY_CONSISTENCY_PLAN.md`
noted on 2026-10-14 that the CRM copies of `audits`, `tenants` and `leads` were probably
left from running the WaaS migrations there. Audit 2 supports that: in the CRM project
the six WaaS-migration tables are all empty, `tenants` has 2 rows, `audits` and `leads`
0 and `tenant_site_config` 1 (audit), so little would be lost by ignoring them. "In `rankedceo-waas`"
in the table means the project production's WaaS client reads. `pipeline_stages` is not called by our code but
`deals` has a foreign key to it (DEC-0023). It exists live in the CRM project and not
in `rankedceo-waas`. The CRM project also holds many tables our code never calls
(for example `ebay_*`, `listing_*`, `profiles`, `organizations`, `org_members`, `ai_*`).
By their names they belong to the other product that shares the project; that is an
inference and DEC-0021 keeps them out of scope.

The `accounts` and `users` tables exist in both projects with different shapes
(section 3).

## 2. What has to be created in `rankedceo-waas`

The 6 WaaS-migration tables that are live only in the CRM project, and the 22 CRM
tables plus `pipeline_stages`, have to be created in `rankedceo-waas`. The 4 missing
table names (section 5) need a decision first. Today the repo migrations are not a
reliable source: the live `accounts` table has 9 columns the migrations add that are
not live, and the live `get_current_user_account_id()` differs from the latest
migration (sections 3 and 4). The new-table SQL should therefore be generated from the
live shapes, not replayed from migration files.

Order of creation, derived from the foreign keys in the CRM `CREATE TABLE` bodies
(repo). A table cannot be created before the tables it references.

| Step | Tables |
|---|---|
| 1 | `crm_billing_events` (`accounts` and `users` already exist in `rankedceo-waas`, see section 3) |
| 2 | `pipelines`, `email_threads` |
| 3 | `calendly_connections`, `commission_rates`, `companies`, `crm_subscriptions`, `email_templates`, `forms`, `industry_leads`, `pipeline_stages` (DEC-0023), `smile_assessments` |
| 4 | `campaigns`, `contacts`, `form_fields` |
| 5 | `deals`, `form_submissions` |
| 6 | `activities`, `appointments`, `campaign_emails`, `commissions`, `email_messages` |
| 7 | `agent_conversations` |
| WaaS group | After `tenants` (already live in `rankedceo-waas`): `tenant_site_versions`, `tenant_site_variants`, `client_uploaded_assets`, `client_domain_change_requests`, `notification_log`, then `tenant_site_deployments` (it references `tenant_site_versions`) |

The order above was first derived from the foreign keys in the migration text. Audit 2
read the live foreign keys (CRM-B4) and they agree: the CRM tables reference
`accounts(id)` (and, for many, `users(id)`), except `crm_billing_events`, which has no
foreign key at all, and `pipeline_stages`, which references only `pipelines`; the six
WaaS-style tables reference only `tenants(id)` (plus
`tenant_site_deployments.source_version_id` -> `tenant_site_versions`); and `deals`
references `pipelines` and `pipeline_stages` with `ON DELETE RESTRICT`. No later
`ALTER TABLE` added a reference this order misses.

## 3. The `accounts` and `users` collision

Both projects have both tables, with different live shapes (audit).

`accounts`: `rankedceo-waas` has 4 columns (`id`, `name`, `created_at`, `updated_at`,
timestamps with time zone). `rankedceo-crm-production` has 28, including `slug`
(NOT NULL, no default), `status`, `plan`, the onboarding columns, `settings`,
`timezone` and the three `crm_*` billing columns. Nine columns that the CRM migrations
add are **not** live in the CRM project: `billing_email`, `deleted_at`, `deleted_by`,
`is_active`, `is_deleted`, `logo_url`, `metadata`, `user_count`, `website_url`. Four
live columns have no migration: `is_pool_account`, `onboarding_data`, `platform_type`,
`stripe_subscription_id`.

`users`: `rankedceo-waas` has 6 columns (`id` with no default, `account_id`,
`full_name`, `avatar_url`, timestamps with time zone). `rankedceo-crm-production` has
14 (`email` and `name` NOT NULL, `role`, `status`, `base_commission_rate`, `phone`,
`title`, `last_login_at`, `crm_stripe_customer_id`, and others), no `full_name`, and a
gap at column position 13 (a dropped column).

Rows: CRM `accounts` 6, `users` 1. WaaS `accounts` 6, `users` 2. Audit 2 shows the six
CRM accounts are all `active` on the `starter` plan with `platform_type` `CRM`, and four
of them are pool rows (`is_pool_account` true), so only two are real customer accounts
(CRM-B11). Both projects are small, so copying rows later is a small job, but the WaaS
rows are not empty and cannot be dropped.

**Hazard to design around — confirmed.** `rankedceo-waas` has a live trigger
`on_auth_user_created` that calls `handle_new_user()` (audit). Audit 2 read the live
body (WaaS-A1) and it matches the repo copy: it inserts only `accounts(name)` (the value
`'My Account'`) and `users(id, account_id, full_name, avatar_url)`. So any column added
to the WaaS `accounts` or `users` that is NOT NULL without a default (for example
`accounts.slug`, `users.email`, `users.name`) would make every new WaaS sign-up fail.
Added columns therefore must be nullable or have a default. The live function has no
`SET search_path` (audit). We never edit that trigger.

The onboarding RPCs (section 4) write eleven `accounts` columns the WaaS table does not
have yet — `onboarding_completed`, `onboarding_completed_at`, `onboarding_step`,
`onboarding_skipped`, `company_size`, `industry`, `website`, `phone`, `address`,
`timezone` and `settings` — so those must be added, and under this hazard each must be
nullable or defaulted. They also write `name`, which already exists in WaaS.

Our code calls `users` in 58 files and `accounts` in 13 (repo); a grep found no file
that calls them and also references the WaaS client.

Another behaviour change: after the move, a CRM sign-up would fire the WaaS
`handle_new_user()` and create an account and user row on its own. Today the CRM
project has no such link for our tables (`lib/supabase/ensure-crm-profile.ts` explains
that the CRM trigger belongs to the other product), so our code creates them itself.
The two must not both write.

## 4. Things that come with the tables

- **Policy helper functions.** Live in the CRM project (audit): `get_current_user_account_id()`
  and `get_current_user_id()`. Not live there, although migrations use them:
  `get_current_user_email()` (9 mentions) and `get_current_smile_account_id()` (7).
  None of the four exists in `rankedceo-waas`. The live
  `get_current_user_account_id()` differs from the latest migration
  (`000018_fix_users_rls_permissions.sql`): the live one is `STABLE SECURITY DEFINER`
  with an empty `search_path`, and finds the row where `users.id = auth.uid()` or the
  email matches the JWT email. It has no `auth_user_id` branch and no
  `SET LOCAL row_security = off`. We must copy the live definition, not the migration,
  or access rules change silently. Audit 2 read the live policies (CRM-B6): most call
  `get_current_user_account_id()`; some match `auth.uid()` directly (`activities.user_id`,
  `appointments.booked_by_user_id`, `industry_leads.auth_user_id`, `crm_subscriptions.user_id`);
  `form_fields` matches by email through `auth.users`; `pipeline_stages` has a duplicate
  `authenticated` and `public` policy set; `smile_assessments` has an anon insert policy
  hardcoded to the pool account `00000000-0000-4000-a000-000000000004`;
  `agent_conversations` compares `auth.uid()::text = account_id::text`, which looks like a
  bug but is what is live; the six WaaS-style tables in CRM use the `waas_admin` JWT
  claim, and `tenant_site_variants` has a deny-all policy.
- **RPC functions.** Our onboarding routes call five functions with the CRM client:
  `complete_onboarding`, `update_onboarding_step`, `skip_onboarding`,
  `update_company_info`, `update_preferences` (repo). All five are live in the CRM
  project and none exists in `rankedceo-waas` (audit). They are `SECURITY DEFINER` and
  update `accounts`, including the onboarding columns, so they must be created in
  `rankedceo-waas` (and the `accounts` columns they write must exist) before the client
  switch. Audit 2 read the live bodies (CRM-B7): all five are `SECURITY DEFINER` with
  `SET search_path TO 'public'`, and each takes `p_account_id` and updates `accounts`
  **without checking that the caller owns that account**, so an authorized invoker can
  target any account — an authorization gap to review when they are recreated. Whether a
  caller can actually invoke them depends on the `EXECUTE` grants, which the audit did not
  read; the migrations have none.
  The other four RPCs our code calls (`resolve_tenant_by_hostname`,
  `capture_audit_lead`, `create_prospect_audit`, `get_audit_status`) are live in both
  projects (audit).
- **Triggers.** `rankedceo-waas` has `on_auth_user_created` and `on_auth_user_deleted`
  on `auth.users`, with `handle_new_user` and `handle_user_delete`. The CRM project has
  `on_auth_user_created`. These are never edited. The statements that create them
  (`handle_new_user` in 5 CRM migration files plus `waas/027`) must be excluded from
  any SQL applied to QA or `rankedceo-waas`, with a grep check on the final SQL.
  `rankedceo-waas` also has an event trigger function `rls_auto_enable`, not defined
  anywhere in the repo (grep). Audit 2 read it (WaaS-A2): it runs
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every new `public` table, so a table
  created in `rankedceo-waas` will have RLS turned on automatically and needs its
  policies in the same change or it will deny all access.
- **Table triggers and helper functions.** The target tables carry their own triggers
  (audit, CRM-B9): `update_updated_at_column()` backs nine of them (`campaigns`,
  `companies`, `contacts`, `deals`, `email_messages`, `email_templates`, `email_threads`,
  `forms`, `pipelines`); `handle_updated_at()` backs four (`agent_conversations`,
  `appointments`, `calendly_connections`, `smile_assessments`); `deals` has
  `auto_create_commission` (after insert or update of `stage`) and
  `update_commission_on_deal_change` (after update of `value`); `email_messages` has
  `associate_email_with_contact` (before insert) and `update_thread_stats` (after insert
  or delete). `agent_conversations` has a redundant duplicate before-update trigger. The
  six WaaS-style tables have no triggers. Audit 2 also read 20 helper functions (CRM-B8);
  eight are `SECURITY DEFINER` and several take an id with no ownership check, and
  `get_smile_account_id()` uses `SET LOCAL row_security = off` plus `users.auth_user_id`,
  a column that is not in the live `users` table, so it looks dead.
  `update_updated_at_column()` is used by nine triggers but was not in that set of 20 — it
  is a shared helper that also exists in `rankedceo-waas`. All of these functions and
  triggers must be recreated after the tables move. Every target table has RLS enabled
  (audit, CRM-B10, 29 of 29), so each needs its policies recreated.
- **Logins.** Each project has its own `auth.users`. A CRM login cannot appear in
  `rankedceo-waas` by moving table rows alone. The method is undecided.
- **Buckets.** `rankedceo-waas` has `logos`. The CRM project has `avatars`,
  `client-uploads` and `listing-images`. Our code uses `client-uploads` and `logos`
  (repo). The upload route that uses `client-uploads` creates the bucket itself if it is
  missing, through the WaaS client, so the bucket is not a blocker. Whether the CRM
  copy of `client-uploads` holds files we need is **not verified**.
- **Data.** Structure only so far. Copying rows is a separate step. Audit 2 read the row
  counts: the six WaaS-migration tables in the CRM project are empty (CRM-B1); the 22 CRM
  tables are also empty except `agent_conversations` 31, `industry_leads` 5,
  `appointments` 2 and `calendly_connections` 1 (CRM-B2); and the CRM `accounts` table
  has 6 rows, four of them pool rows (CRM-B11).

## 5. Names with no live table

| Name | Finding |
|---|---|
| `logos` | A storage bucket, not a table. It exists in `rankedceo-waas`. |
| `calendar_provider_connections` | Not in either project. Called once in `lib/services/calendar-routing-service.ts`, and the call ignores the error, so it silently returns nothing today. The only definition is the migration `20260702000000_add_calendar_provider_routing.sql` (foreign keys to `accounts` and `users`). |
| `tenant_variant_regenerations` | Not in either project. Called in `app/_preview/[tenantId]/page.tsx` and 8 times in `lib/waas/actions/admin/client-review.ts`. Defined only by `waas/026_waas_variant_regenerations.sql`. |
| `waas_tenants` | Not in either project. Called once, in `lib/waas/actions/client-edit/section-regen.ts`, and when the query fails that code returns "Could not load tenant information." The migrations create `tenants`, and every neighbouring file queries `tenants`, so this looks like a wrong name. Changing it is a code fix, and under DEC-0021 it should be Tommy's call, because I cannot prove from the repo that `tenants` is what was meant. |
| `audit_abandonment_tracking` | Not in either project. Called in two routes using the WaaS env vars. No `CREATE` anywhere in the repo. The routes contain a guard that looks for a "does not exist" message and then skips; I did not test whether it fires. |

## 6. Finding: WaaS features already straddle both projects

Production's `NEXT_PUBLIC_WAAS_SUPABASE_URL` is `rankedceo-waas`, and that project
lacks six tables our code calls (section 1). Reading which client each file uses
(repo, by imports and env var names):

- The client edit actions, the edit and preview pages, `edit-session.ts`, the
  notification service and the initial-site generator use the **WaaS** client
  (`NEXT_PUBLIC_WAAS_SUPABASE_URL`). They call `tenant_site_variants`,
  `client_uploaded_assets`, `client_domain_change_requests`, `notification_log` and
  `tenant_variant_regenerations`, none of which exists in `rankedceo-waas`.
- The admin actions that import `lib/waas/actions/admin/_shared.ts` use
  `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. By the repo's naming that
  is the **CRM** project, which is where `tenant_site_variants`,
  `tenant_site_versions` and `tenant_site_deployments` live. `lib/waas/actions/admin/tenants.ts`
  also reads `tenants`, `audits` and `tenant_site_config` through that client (the
  other admin files were not checked for those tables).

So the repo suggests admin tools write to the CRM project while client-facing pages
read from `rankedceo-waas`. If that is how production runs, a variant created in the
admin would not be visible to the client edit page, and the client edit pages would
fail on missing tables. This is a **reading of the code, not a test of production**.
Update 2026-10-22 (DEC-0025): Tommy confirmed in Vercel Production that
`NEXT_PUBLIC_SUPABASE_URL` is the CRM project and `NEXT_PUBLIC_WAAS_SUPABASE_URL` is
`rankedceo-waas`, so the URLs match this reading. Still unverified: that
`SUPABASE_SERVICE_ROLE_KEY` belongs to the CRM project. If it belongs to another project,
the admin calls fail rather than reaching the CRM copies. The rest of this paragraph is
the original pre-check text. Audit 2 read the CRM
row counts (CRM-B1): the six WaaS-style tables are all empty, `tenants` has 2 rows,
`audits` and `leads` 0 and `tenant_site_config` 1, against 18 `tenants`, 32 `audits` and
1 `leads` in `rankedceo-waas` (audit). That fits the idea that the CRM copies are
leftovers rather than the tables the admin tools write to, but it does not prove which
project the admin code reads and writes. The URL half of that check is now done (DEC-0025);
the service-role key half is still open. Note also that the live `tenants` table has no
foreign key on `crm_account_id` (audit), so the link from a tenant to a CRM account is by
convention only.

## 7. Code changes after the data moves

The CRM client is built from `NEXT_PUBLIC_SUPABASE_URL` in `lib/supabase/admin.ts`,
`audit-client.ts`, `client.ts`, `middleware.ts`, `server.ts`, in
`app/api/auth/callback/route.ts`, `app/api/waas/audits/route.ts`,
`app/api/waas/tenants/route.ts`, `app/api/waas/tenants/[id]/route.ts`, in
`lib/waas/actions/admin/_shared.ts` and in `middleware.ts`. The WaaS client uses
`NEXT_PUBLIC_WAAS_SUPABASE_URL` in 21 files. Pointing both at one project is an
environment change in Vercel plus a cleanup of the two-client split, and it changes
where every CRM user signs in. That is the riskiest step and should be its own PR,
after the data is in place and tested.

## 8. Safe order of work

1. Done: compare the live shapes of `accounts` and `users`, the functions, the
   `auth.users` triggers, the buckets and the row counts in both projects (audit).
2. Done: the second read-only round (audit 2, 18 `SELECT` queries). It read the live
   bodies of WaaS `handle_new_user()`/`handle_user_delete()` and `rls_auto_enable`; the
   row counts of the six CRM-only WaaS tables and `tenants`/`audits`/`leads` in the CRM
   project (section 6); the live columns, foreign keys, indexes and RLS policies of the
   target tables; the live definitions of the five onboarding RPCs and 20 helper
   functions; the table triggers; and the RLS flags. Findings are folded into sections
   1–6.
3. Decide the four missing names (section 5) and the base shape for `accounts` and
   `users` (section 3).
4. Write the new-table SQL from the live shapes, excluding `handle_new_user()` and
   every `auth.users` trigger statement, and test it on a local throwaway Postgres.
   Written for the WaaS group only: `supabase/migrations/waas/029_waas_client_edit_tables.sql`
   (seven tables, additive and idempotent, rollback at the bottom). Tested on a local
   throwaway Postgres only; not applied to any live project. The CRM group is not started.
5. Apply to `rankedceo-waas`. The existing `qa` schema holds only `qa.qa_runs` and
   `qa.qa_scenarios` (audit), so it is not a separate copy of the new tables and is not
   a staging area for this step. The repo's `docs/deployment/qa-deployment.md` states
   the QA deployment targets `rankedceo-waas` (the same project as production) and that
   browser-driven QA flows write to the same `public` tables, so QA is not isolated from
   the new tables. Before applying, decide how to
   test and how to roll back (for example, test on the local throwaway Postgres first
   and keep a reverse SQL script). This is an open question (section 9).
6. Create the five onboarding RPCs and the helper functions, and check their grants.
7. Decide about data and logins.
8. Switch the CRM client to the single project (separate PR).

## 9. Open questions

1. QA project. Recorded as DEC-0024 (2026-10-19): no new project is created for QA.
   Once our tables are combined into `rankedceo-waas` (DEC-0022) and the other
   product's `listing-assistant-pro` is combined into `listrassistr-official`,
   `rankedceo-crm-production` is repurposed as the QA project, so no extra $10 a month
   is spent. This amends the DEC-0022 wording that left `rankedceo-crm` to the other
   product: it is left to the other product only until that product's own combine is
   done. Until both combines finish, QA runs against `rankedceo-waas` at
   `qa.rankedceo.com`: only the QA agent's bookkeeping (`qa.qa_runs`, `qa.qa_scenarios`)
   is isolated in the `qa` schema, while the browser-driven QA flows write to the
   `public` tables in `rankedceo-waas`, so application data is not isolated (see
   `docs/deployment/qa-deployment.md`). A staging and rollback approach for step 5 of
   section 8 is still needed.
2. Which definition of `accounts` and `users` is the base (section 3)?
3. How do CRM logins reach `rankedceo-waas`?
4. The four missing names in section 5, especially `waas_tenants`.
5. Which project does production admin code really read and write (section 6)?
   Answered for the URLs on 2026-10-22 (DEC-0025): the admin client is pointed at the CRM
   project. Tommy confirmed in Vercel Production that `NEXT_PUBLIC_SUPABASE_URL` is
   `wcednzaxmxwfiijzmjmx` and `NEXT_PUBLIC_WAAS_SUPABASE_URL` is `klgvdvryewykzlumbkei`.
   The split described in section 6 is how production runs **if**
   `SUPABASE_SERVICE_ROLE_KEY` also belongs to the CRM project, which is not verified.
   See `E3_CLIENT_SWITCH_PLAN.md`, D4.
