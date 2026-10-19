# Database consolidation plan (DEC-0022)

Status: **plan only. Nothing has been created, moved or copied.** Written 2026-10-19
from the repository alone. Neither live database was inspected and no credentials were
used. Every "verified" below means verified in the repo by grep or by reading the
file named; every "not verified" means it needs the live database.

The decision this plan implements is DEC-0022: `rankedceo-waas` becomes the single
Supabase project for our product, our CRM tables are recreated there, and
`rankedceo-crm` is left to the other product that shares it. DEC-0021 limits what may
be touched: net-new tables, or tables our own code calls by exact name.

## 1. What has to move

Our code calls 44 table names through `.from()`. By the `CREATE TABLE` statements in
`supabase/migrations`:

| Group | Count | Action |
|---|---|---|
| Created only by the WaaS migrations | 14 | Already in `rankedceo-waas`. No move. |
| Created only by the CRM migrations | 23 | Recreate in `rankedceo-waas`. |
| Created by both (`accounts`, `users`) | 2 | Decision needed (section 3). |
| No `CREATE TABLE` matched | 5 | See section 5. None is a plain move. |

The 23 CRM-only tables: `activities`, `agent_conversations`, `appointments`,
`calendar_provider_connections`, `calendly_connections`, `campaign_emails`,
`campaigns`, `commission_rates`, `commissions`, `companies`, `contacts`,
`crm_billing_events`, `crm_subscriptions`, `deals`, `email_messages`,
`email_templates`, `email_threads`, `form_fields`, `form_submissions`, `forms`,
`industry_leads`, `pipelines`, `smile_assessments`.

One more table is needed that our code does not call: `deals` has a foreign key to
`pipeline_stages` (created in `0000085_baseline_forward_referenced_crm_tables.sql`).
DEC-0021 does not cover it. **Tommy to decide** whether it counts as in scope
because a table we call depends on it.

## 2. Order of creation

Derived from the foreign keys in the CRM `CREATE TABLE` bodies. A table cannot be
created before the tables it references.

| Step | Tables |
|---|---|
| 1 | `accounts` (if kept), `crm_billing_events` |
| 2 | `users` (if kept), `pipelines`, `email_threads` |
| 3 | `calendar_provider_connections`, `calendly_connections`, `commission_rates`, `companies`, `crm_subscriptions`, `email_templates`, `forms`, `industry_leads`, `pipeline_stages`, `smile_assessments` |
| 4 | `campaigns`, `contacts`, `form_fields` |
| 5 | `deals`, `form_submissions` |
| 6 | `activities`, `appointments`, `campaign_emails`, `commissions`, `email_messages` |
| 7 | `agent_conversations` |

Caveat: the foreign keys were parsed from the migration text, so a table that was
changed by a later `ALTER TABLE` may have a reference this order misses. The live
schema is the authority.

## 3. The `accounts` and `users` collision

Both migration sets define `accounts` and `users`. Compared by reading
`000001_create_users_and_accounts.sql` and `waas/027_baseline_accounts_users.sql`:
the column lists are the same (`id`, `name`, timestamps for `accounts`; `id`,
`account_id`, `full_name`, `avatar_url`, timestamps for `users`). The WaaS copy was
written "to match the exact live schema" of the WaaS project and is not wired into
any WaaS feature (`schema_investigation/SCHEMA_GAP_ANALYSIS.md`). Our code calls
`users` in 58 files and `accounts` in 13, and a grep found no file that calls them also references the WaaS client.

The consequence: after the move, the CRM client and the WaaS client point at one
project, and the WaaS project already has (unused) `accounts` and `users` tables.
Whether the live WaaS copies hold rows is **not verified**. The plan is to keep the
WaaS definitions as the base and add only what the CRM definition has that they lack,
once both live shapes are compared.

## 4. Things that come with the tables

- **Policies.** The CRM policies use `get_current_user_account_id()`: 248 occurrences in migrations, including its definitions and grants. It is
  `SECURITY DEFINER`, redefined in 7 migrations; the latest is
  `000018_fix_users_rls_permissions.sql`. It must exist in `rankedceo-waas` before any
  policy that uses it. Which version is live in `rankedceo-crm` is **not verified**.
  `get_current_user_email()` (9 uses), `get_current_smile_account_id()` (7) and
  `get_current_user_id()` (4) are used the same way.
- **Triggers and functions.** `handle_new_user` and `update_updated_at_column` are
  defined by both migration sets. The rule never to edit the live `handle_new_user()`
  stands. Whether `rankedceo-waas` already has a trigger on `auth.users` is **not
  verified** from the repo (027 says it preserves one "for parity with production").
- **Logins.** Each project has its own `auth.users`. `users.id` references
  `auth.users(id)`, so a CRM user row cannot move without a matching login in
  `rankedceo-waas`. Moving logins is live-data work, and its method is undecided.
- **Data.** This plan covers structure. Whether to copy rows, and which, is a
  separate decision once row counts are known (**not verified**).

## 5. The five names with no `CREATE TABLE`

Read from the code and migrations:

| Name | What it is | Evidence |
|---|---|---|
| `logos` | A storage bucket, not a table. | `storage.from("logos")` in `app/api/onboarding/logo-upload/route.ts`; the route creates the bucket itself; `waas/007_waas_storage.sql` documents it. Needs creating in the new project if it is not already there. |
| `qa_runs`, `qa_scenarios` | Tables in the `qa` schema. | `waas/021_qa_schema.sql` creates `qa.qa_runs` and `qa.qa_scenarios`; `getWaasQaClient()` sets `db.schema = "qa"`. Already in `rankedceo-waas`. |
| `waas_tenants` | **Unexplained.** | One call in `lib/waas/actions/client-edit/section-regen.ts`, selecting `brand_config, legal_name, primary_trade, target_industry`. The migrations create `tenants`, and every neighbouring file queries `tenants`. Possibly a stale name; a live view or table with this name is not ruled out. |
| `audit_abandonment_tracking` | **Unexplained.** | Called in two routes, using the WaaS project's env vars. No `CREATE` in any `.sql` or `.md` file in the repo. Probably created by hand in the dashboard. |

For the two unexplained names, DEC-0021 applies: they are called by our code by exact
name, so they are ours, but their shape must come from the live database before
anything is written.

## 6. Code changes after the data moves

The CRM client is built from `NEXT_PUBLIC_SUPABASE_URL` in `lib/supabase/admin.ts`,
`audit-client.ts`, `client.ts`, `middleware.ts`, `server.ts`, in
`app/api/auth/callback/route.ts`, `app/api/waas/audits/route.ts`,
`app/api/waas/tenants/route.ts`, `app/api/waas/tenants/[id]/route.ts`, in
`lib/waas/actions/admin/_shared.ts` and in `middleware.ts`. The WaaS client uses
`NEXT_PUBLIC_WAAS_SUPABASE_URL` in 21 files. Pointing both at one project is an
environment change in Vercel plus a cleanup of the two-client split, and it changes
where every CRM user signs in. That is the riskiest step and should be its own PR,
after the data is in place and tested.

## 7. Safe order of work

1. Compare the live shapes of `accounts` and `users` in both projects (read-only).
2. Check the two unexplained names live (read-only).
3. Replay the migrations on a local throwaway Postgres, write the new-table SQL, and
   test it there.
4. Apply to a QA project, then to `rankedceo-waas`.
5. Decide about data and logins.
6. Switch the CRM client to the single project (separate PR).

## 8. Open questions

1. Is `pipeline_stages` in scope under DEC-0021 as a dependency of `deals`?
2. Does `rankedceo-qa` get created, and does the Supabase plan allow it at no cost?
3. Which definition of `accounts` and `users` is the base once live shapes are known?
4. How do CRM logins reach `rankedceo-waas`?
