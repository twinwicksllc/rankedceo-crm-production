# Database consolidation plan (DEC-0022, DEC-0023)

Status: **plan only. Nothing has been created, moved or copied.** First written
2026-10-19 from the repository alone, then updated the same day after a live read-only
audit. For the audit, Tommy ran seven `SELECT` queries in each Supabase project and
pasted the results. I did not connect to either database. Wording used below:
**repo** = read in this repository by grep or by opening the file; **audit** = read
from Tommy's pasted results; **not verified** = neither of those has shown it.

The decision this plan implements is DEC-0022: `rankedceo-waas` becomes the single
Supabase project for our product and our CRM tables are recreated there. DEC-0021
limits what may be touched: net-new tables, or tables our own code calls by exact name.
DEC-0023 puts `pipeline_stages` in scope. The reason for combining is cost: each extra
Supabase project is about $10 a month (Tommy, 2026-10-19).

Project names: `rankedceo-waas` is the WaaS project (ref `klgvdvryewykzlumbkei`,
confirmed by Tommy as the target of `NEXT_PUBLIC_WAAS_SUPABASE_URL`).
`rankedceo-crm-production` is the CRM project (`NEXT_PUBLIC_SUPABASE_URL`).

## 1. What the audit found

Our code calls 44 table names through `.from()` (repo). Checked against the live
`public` and `qa` tables in each project (audit):

| Where the name is live | Count | Names |
|---|---|---|
| In `rankedceo-waas` | 11 | `accounts`, `audits`, `client_variant_edit_events`, `domain_requests`, `leads`, `qa_runs`, `qa_scenarios`, `site_templates`, `tenant_site_config`, `tenants`, `users` |
| Only in `rankedceo-crm-production` | 28 | 22 from the CRM migrations: `activities`, `agent_conversations`, `appointments`, `calendly_connections`, `campaign_emails`, `campaigns`, `commission_rates`, `commissions`, `companies`, `contacts`, `crm_billing_events`, `crm_subscriptions`, `deals`, `email_messages`, `email_templates`, `email_threads`, `form_fields`, `form_submissions`, `forms`, `industry_leads`, `pipelines`, `smile_assessments`. 6 from the WaaS migrations: `client_domain_change_requests`, `client_uploaded_assets`, `notification_log`, `tenant_site_deployments`, `tenant_site_variants`, `tenant_site_versions` |
| In neither project | 5 | `audit_abandonment_tracking`, `calendar_provider_connections`, `tenant_variant_regenerations`, `waas_tenants`, and `logos` (a storage bucket, see section 5) |

11 + 28 + 5 = 44, counted by script. The CRM project also lists all 11 names (audit). `docs/waas/USER_IDENTITY_CONSISTENCY_PLAN.md`
noted on 2026-10-14 that the CRM copies of `audits`, `tenants` and `leads` were probably
left from running the WaaS migrations there; that is an inference. "In `rankedceo-waas`"
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

Caveat: the foreign keys were parsed from migration text, so a later `ALTER TABLE`
may add a reference this order misses. The live foreign keys have not been read yet.

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

Rows: CRM `accounts` 6, `users` 1. WaaS `accounts` 6, `users` 2. Both are small, so
copying rows later is a small job, but the WaaS rows are not empty and cannot be
dropped.

**Hazard to design around.** `rankedceo-waas` has a live trigger
`on_auth_user_created` that calls `handle_new_user()` (audit). The repo copy of that
function (`waas/027_baseline_accounts_users.sql`) inserts only `accounts(name)` and
`users(id, account_id, full_name, avatar_url)`. If the repo copy matches the live
body, any column added to the WaaS `accounts` or `users` that is NOT NULL without a
default (for example `accounts.slug`, `users.email`, `users.name`) would make every new
WaaS sign-up fail. Added columns therefore must be nullable or have a default. The
live function body has **not** been read yet. We never edit that trigger.

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
  or access rules change silently. Which live policies use which helper has **not
  been read yet** (`pg_policies`); the 248 migration mentions include definitions.
- **RPC functions.** Our onboarding routes call five functions with the CRM client:
  `complete_onboarding`, `update_onboarding_step`, `skip_onboarding`,
  `update_company_info`, `update_preferences` (repo). All five are live in the CRM
  project and none exists in `rankedceo-waas` (audit). They are `SECURITY DEFINER` and
  update `accounts`, including the onboarding columns, so they must be created in
  `rankedceo-waas` (and the `accounts` columns they write must exist) before the client
  switch. Grants must be read from the live definition; the migrations have none.
  The other four RPCs our code calls (`resolve_tenant_by_hostname`,
  `capture_audit_lead`, `create_prospect_audit`, `get_audit_status`) are live in both
  projects (audit).
- **Triggers.** `rankedceo-waas` has `on_auth_user_created` and `on_auth_user_deleted`
  on `auth.users`, with `handle_new_user` and `handle_user_delete`. The CRM project has
  `on_auth_user_created`. These are never edited. The statements that create them
  (`handle_new_user` in 5 CRM migration files plus `waas/027`) must be excluded from
  any SQL applied to QA or `rankedceo-waas`, with a grep check on the final SQL.
  `rankedceo-waas` also has an event trigger function `rls_auto_enable`, not defined
  anywhere in the repo (grep). Its effect on newly created tables is **not verified**,
  and it may turn on row-level security for them.
- **Logins.** Each project has its own `auth.users`. A CRM login cannot appear in
  `rankedceo-waas` by moving table rows alone. The method is undecided.
- **Buckets.** `rankedceo-waas` has `logos`. The CRM project has `avatars`,
  `client-uploads` and `listing-images`. Our code uses `client-uploads` and `logos`
  (repo). The upload route that uses `client-uploads` creates the bucket itself if it is
  missing, through the WaaS client, so the bucket is not a blocker. Whether the CRM
  copy of `client-uploads` holds files we need is **not verified**.
- **Data.** Structure only so far. Copying rows is a separate step.

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
What the Vercel production variables actually hold is not verified, and the 2026-10-14
note in `docs/waas/USER_IDENTITY_CONSISTENCY_PLAN.md` says the CRM copy of `tenants`
had 2 rows against 18 in `rankedceo-waas`, which does not obviously fit admin tools
using the CRM copy. It needs a read-only check (section 8) before anything is built.

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
2. Next read-only round (all `SELECT`): the live body of WaaS `handle_new_user()` and
   `handle_user_delete()`; the row counts of the 6 CRM-only WaaS tables plus `tenants`,
   `audits` and `leads` in the CRM project (settles section 6); the live columns,
   foreign keys, indexes and RLS policies of the 28 CRM-only tables; the live
   definitions of the five onboarding RPCs and the other helper functions the live
   policies use; what `rls_auto_enable` does.
3. Decide the four missing names (section 5) and the base shape for `accounts` and
   `users` (section 3).
4. Write the new-table SQL from the live shapes, excluding `handle_new_user()` and
   every `auth.users` trigger statement, and test it on a local throwaway Postgres.
5. Apply to `rankedceo-waas`. QA is the existing `qa` schema in `rankedceo-waas`
   (see section 9), so no extra project is needed for this step.
6. Create the five onboarding RPCs and the helper functions, and check their grants.
7. Decide about data and logins.
8. Switch the CRM client to the single project (separate PR).

## 9. Open questions

1. QA project. Tommy said (2026-10-19) that once our tables are combined into
   `rankedceo-waas` and the other product's `listing-assistant-pro` is combined into
   `listrassistr-official`, `rankedceo-crm-production` could be repurposed as the QA
   project, so no new project is created and no extra $10 a month is spent. This is
   not yet in the decision log, and it differs from the DEC-0022 wording that leaves
   `rankedceo-crm` to the other product. Until then QA stays on the `qa` schema in
   `rankedceo-waas`, which already exists.
2. Which definition of `accounts` and `users` is the base (section 3)?
3. How do CRM logins reach `rankedceo-waas`?
4. The four missing names in section 5, especially `waas_tenants`.
5. Which project does production admin code really read and write (section 6)?
