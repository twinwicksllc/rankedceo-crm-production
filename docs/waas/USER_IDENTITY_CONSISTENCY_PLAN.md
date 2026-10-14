# User Identity Consistency Plan (Audit / WaaS / CRM)

Status: DRAFT for Tommy's decision. Written 2026-10-14.
Scope: documentation only. No code, no migrations, no DB access (DEC-0013 hold still applies).
Basis: repository code and migrations only. Nothing here was checked against the live databases. Section 4 gives read-only SQL so Tommy can confirm the live state before any decision.

## 1. Where an audit signup lives today (from code)

There are two separate Supabase projects: the CRM project (`NEXT_PUBLIC_SUPABASE_URL`) and the WaaS project (`NEXT_PUBLIC_WAAS_SUPABASE_URL`). See the header of `lib/waas/supabase.ts`.

| Thing | Where it lives | Evidence |
|---|---|---|
| Login (password, magic link, Google) for audit, CRM and admin | CRM project `auth.users` | `lib/supabase/audit-client.ts`, `lib/supabase/server.ts`, `middleware.ts` and `app/api/auth/callback/route.ts` all use the CRM URL and anon key |
| App profile | CRM `public.users`, created by the `handle_new_user()` trigger on `auth.users` | final definition in `supabase/migrations/000007_correct_link_auth_users.sql` |
| Tenant for a CRM user | CRM `public.accounts`. In 000007 the trigger uses a shared default account with slug `my-account` | same file, lines near 109 and 128 |
| Anonymous audit requester | WaaS `audits.requestor_email` and `requestor_name`, plain text, no user id | `app/api/audit/run/route.ts` |
| Captured lead | WaaS `leads` (email, audit_id, tenant_id) via the `capture_audit_lead()` RPC | `app/api/audit/leads/route.ts` |
| Prospect tenant created from an audit | WaaS `tenants`, with `submitted_by_email` set from `requestor_email` | `app/api/audit/[auditId]/create-tenant/route.ts` |
| Link from a WaaS tenant to a CRM account | `tenants.crm_account_id`, nullable, set only through `app/api/waas/tenants/route.ts` and `app/api/waas/tenants/[id]/route.ts` | `supabase/migrations/waas/001_waas_tenants.sql` |
| Client editing their site | No login. Review token in `/edit/[reviewToken]` | `app/edit/[reviewToken]/page.tsx` |
| Unused copy | WaaS project has `public.accounts`, `public.users` and its own `handle_new_user()` trigger. No WaaS app code reads them | `supabase/migrations/waas/027_baseline_accounts_users.sql` |

Sign-in flow for an audit user: audit login page (`app/audit/login/page.tsx`) calls `signInWithPassword`, `signInWithOtp` (magic link) or `signInWithOAuth` (Google) against the CRM project. Supabase auto-creates the `auth.users` row on first magic link or OAuth. There is no `signUp` call on the audit pages. The trade signup pages (`app/(auth)/signup`, `app/{hvac,plumbing,electrical,smile}/(auth)/signup`) call `signUp` against the same CRM project.

Ownership check for an audit report. The page `app/audit/[auditId]/page.tsx` requires sign-in (CRM `auth.getUser()`) and then checks WaaS `tenants` with `.eq("submitted_by_email", user.email)`. The PDF route `app/api/audit/[auditId]/pdf/route.ts` differs: it reads the audit with a service-role client (line 171) and only calls `auth.getUser()` when `audit.tenant_id` is set (line 185), so an unlinked audit is served with no sign-in check. Both checks apply only when `audit.tenant_id` is set.

## 2. Inconsistencies found

1. **Join key is free-text email, exact case.** `Tommy@x.com` and `tommy@x.com` do not match in `.eq("submitted_by_email", user.email)`. Some writers lowercase (`capture_audit_lead` lowercases and trims the email in `000_waas_complete_idempotent.sql`); others store what the user typed.
2. **No user id in WaaS.** `audits`, `leads` and `tenants` have no column that points at an auth user. A cross-project foreign key is impossible, so the best available is an unenforced `uuid` column.
3. **An audit without a tenant is reachable by two anonymous paths, not only by signed-in users.** The page `app/audit/[auditId]/page.tsx` requires sign-in, but:
   - **PDF route.** `app/api/audit/[auditId]/pdf/route.ts` fetches the audit with a service-role client (line 171) and only calls `auth.getUser()` when `audit.tenant_id` is set (line 185). When `tenant_id` is null it serves the report with no sign-in check.
   - **WaaS row-level security.** `002_waas_audits.sql` (lines 171-176, repeated in `000_waas_complete_idempotent.sql` lines 438-441) has policy `audits_anon_read_own`: `FOR SELECT TO anon USING (audit_type = 'prospect' AND tenant_id IS NULL)`. Any anon caller can read any unlinked prospect audit row directly. Whether this policy is live must be verified (query 3.5).
   Needs a product decision (D1) and a technical fix, and both paths must be covered.
4. **`users.id` linkage disagrees across migrations, and the mismatch can abort a signup.** 000001 (line 25) and 000005 (line 76) declare `users.id REFERENCES auth.users(id) ON DELETE CASCADE`. 000006 and 000007 insert `gen_random_uuid()` for the profile id (000007 line 153) and match by email. If the foreign key is still live, that insert violates it and the trigger fails, which aborts the new auth signup. So this is not only a mislink risk; it is a possible signup outage. `app/admin/layout.tsx` matches `public.users` by `id`; `lib/services/settings-service.ts` matches by `email`. Both cannot be right for the same row. Check the live constraint (2.8) together with the trigger body (2.6) before planning any repair.
5. **Shared default account.** If 000007 is the live trigger, every new signup without an existing row is attached to the one `my-account` account. If so, new users share one tenant. Needs verification (query 2.5).
6. **`handle_new_user()` is defined in 000001, 000003, 000005, 000006 and 000007.** The last one applied wins. Which one is live is unknown.
7. **Admin identity has three mechanisms:** env allowlist `WAAS_ADMIN_EMAILS` / `WAAS_ADMIN_EMAIL` (also read in `app/api/audit/leads/route.ts`, `lib/waas/services/audit-jobs.ts`, `lib/waas/actions/client-edit/approval.ts`, each with its own fallback; two of them hard-code a default address), JWT claim `app_metadata.role === "waas_admin"` or `app_metadata.waas_admin`, and `public.users.role in (admin, super_admin, owner)`. WaaS RLS uses only the JWT claim.
8. **Existing-user check in `create-tenant` was broken** (anon client calling the admin API). Fixed in the separate draft PR #291.
9. **Vestigial WaaS `accounts`/`users` and trigger.** Any signup that ever reached the WaaS project's auth would create rows nobody reads.

## 3. Target model

1. **One identity source: CRM project `auth.users`.** Every human who logs in (audit, CRM, admin) is a row there.
2. **One profile table: CRM `public.users`, with `id = auth.users.id`.** Email is a lookup field, not the key.
3. **One account per customer in CRM `public.accounts`.** No shared default account for self-serve signups (decision D2).
4. **WaaS rows carry `owner_user_id uuid NULL`** (the CRM auth uid) on `tenants`, `audits` and `leads`, no foreign key (cross-project). Email stays as a lowercase fallback for anonymous and not-yet-signed-up requesters. `tenants.crm_account_id` is filled when the tenant becomes a paying customer.
5. **One shared helper for email normalization** (`trim().toLowerCase()`) used by every writer and every comparison.
6. **One admin authorization helper** (`isPlatformAdmin(user)`) used only where access is decided (`app/admin/layout.tsx` and any future gate); one documented source of truth for who is an admin (decision D3). This is separate from **notification recipients**: `app/api/audit/leads/route.ts`, `lib/waas/services/audit-jobs.ts` and `lib/waas/actions/client-edit/approval.ts` read `WAAS_ADMIN_EMAIL(S)` to choose where to send mail, usually with no authenticated admin in scope. Those keep a shared recipient setting (for example `NOTIFICATION_RECIPIENT_EMAIL`); they must not be replaced by an authorization predicate.
7. **The WaaS project's `auth.users` should not be a login source.** Query 3.1 found 2 users there, so this is a target, not a current fact. Identify them with 3.11 first, then decide whether to move them into the CRM project or keep them as admin-only accounts. The vestigial `accounts`/`users` tables and trigger are removed only after that and after 3.2 shows they hold nothing worth keeping.

Alternative considered: merge WaaS into the CRM project so real foreign keys work. Not recommended now: large migration, and the prod ref is shared with the eBay product (confirm which project, check 2.10). Revisit after the table-level cleanup.

## 4. Verification SQL for Tommy (read-only)

All statements are SELECT only. They return counts and structure, no password data. Run each in the Supabase SQL editor of the named project.

### 4.1 CRM project

```sql
-- 2.1 Is the profile id the auth id? Each profile is classified ONCE, even when
-- its email matches several auth rows (which query 2.3 detects), so the buckets
-- sum to the profile total and no profile appears twice.
with auth_by_email as (
  select lower(email) as email_lc,
         count(*) as auth_rows,
         (array_agg(id order by id))[1] as one_auth_id
  from auth.users
  where email is not null
  group by 1
)
select count(*) as profiles,
       count(*) filter (where abe.auth_rows = 1 and abe.one_auth_id = u.id) as id_matches_auth_id,
       count(*) filter (where abe.auth_rows = 1 and abe.one_auth_id <> u.id) as id_differs_same_email,
       count(*) filter (where abe.auth_rows > 1) as ambiguous_email_multiple_auth,
       count(*) filter (where abe.email_lc is null) as no_auth_user_for_email
from public.users u
left join auth_by_email abe on abe.email_lc = lower(u.email);

-- 2.2 Auth users with no profile row
select count(*) as auth_without_profile
from auth.users a
left join public.users u on lower(u.email) = lower(a.email)
where u.id is null;

-- 2.3 Emails that differ only by case in auth
select lower(email) as email_lc, count(*)
from auth.users group by 1 having count(*) > 1;

-- 2.4 Roles in use
select role, count(*) from public.users group by 1 order by 2 desc;

-- 2.5 Accounts and how many users share them (look at slug my-account)
select a.slug, count(u.id) as users
from public.accounts a left join public.users u on u.account_id = a.id
group by 1 order by 2 desc limit 20;

-- 2.6 Which handle_new_user() is live
select pg_get_functiondef('public.handle_new_user'::regproc);

-- 2.7 Triggers on auth.users
select tgname, tgenabled from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- 2.8 Constraints on public.users (is there an FK to auth.users?)
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.users'::regclass;

-- 2.9 Columns on public.users (is there a metadata column?)
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'users' order by ordinal_position;

-- 2.11 Profile-email duplicates that would block a unique index on lower(email).
-- The existing index is non-unique (000005 line 101). Any rows returned here must
-- be merged or quarantined before phase 2 creates the unique index.
select lower(email) as email_lc, count(*)
from public.users where email is not null group by 1 having count(*) > 1;

-- 2.12 Foreign keys that reference public.users(id), with their ON UPDATE action.
-- Changing a profile id in phase 2 is blocked or loses ownership without this map.
select c.conrelid::regclass as referencing_table,
       a.attname as referencing_column,
       c.conname,
       c.confupdtype as on_update,   -- 'a' = NO ACTION, 'c' = CASCADE, 'n' = SET NULL
       c.confdeltype as on_delete
from pg_constraint c
join unnest(c.conkey) as k(attnum) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.contype = 'f' and c.confrelid = 'public.users'::regclass
order by 1, 2;
```

2.10 Which project is this? Read the project ref in Dashboard > Settings > General for each project and compare it to the prod ref `wcednzaxmxwfiijzmjmx`. (No SQL for this one.)

### 4.2 WaaS project

```sql
-- 3.1 Is the WaaS project's auth used at all?
select count(*) as auth_users from auth.users;

-- 3.2 Vestigial tables
select (select count(*) from public.users)    as users_rows,
       (select count(*) from public.accounts) as accounts_rows;

-- 3.3 Tenants: how many carry a CRM link or an email
select count(*) as tenants,
       count(crm_account_id) as with_crm_account_id,
       count(submitted_by_email) as with_email
from public.tenants;

-- 3.4 Emails stored with upper case or stray spaces
select 'tenants.submitted_by_email' as col, count(*) from public.tenants
  where submitted_by_email <> lower(trim(submitted_by_email))
union all
select 'audits.requestor_email', count(*) from public.audits
  where requestor_email <> lower(trim(requestor_email))
union all
select 'leads.email', count(*) from public.leads
  where email <> lower(trim(email));

-- 3.5 Unlinked prospect audits. These are reachable today by two anonymous paths:
--   (a) the PDF route (app/api/audit/[auditId]/pdf/route.ts) reads with a
--       service-role client and skips auth.getUser() when tenant_id is null;
--   (b) the WaaS anon SELECT policy audits_anon_read_own
--       (002_waas_audits.sql lines 171-176).
select count(*) filter (where tenant_id is null) as unlinked_audits,
       count(*) filter (where tenant_id is null and requestor_email is not null) as unlinked_with_email,
       count(*) filter (where tenant_id is null and audit_type = 'prospect') as unlinked_prospect
from public.audits;

-- 3.5b Confirm which policies are live on audits (is the anon SELECT still there?)
select policyname, cmd, roles, qual
from pg_policies where schemaname = 'public' and tablename = 'audits';

-- 3.6 Distinct emails to reconcile against CRM auth.users (export as CSV)
select distinct lower(trim(e)) as email from (
  select submitted_by_email as e from public.tenants
  union select requestor_email from public.audits
  union select email from public.leads
) x where e is not null;

-- 3.7 What can the public anon key actually read? (read-only, the transaction is rolled back)
-- If requestor_email_visible > 0, requestor PII is readable by anyone holding the anon key.
begin;
set local role anon;
select count(*) as anon_visible_audits,
       count(requestor_email) as requestor_email_visible,
       count(requestor_phone) as requestor_phone_visible
from public.audits;
rollback;

-- 3.7b Table-level grants on audits
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'audits' and grantee in ('anon', 'authenticated')
order by 1, 2;

-- 3.8 Is row-level security enabled, and what do anon/authenticated policies exist, per WaaS table?
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and 'anon' = any(p.roles)) as anon_policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('audits', 'tenants', 'leads')
order by 1;

-- 3.9 What can anon read from tenants and leads? (read-only, the transaction is rolled back)
begin;
set local role anon;
select (select count(*) from public.tenants) as anon_visible_tenants,
       (select count(submitted_by_email) from public.tenants) as tenant_emails_visible,
       (select count(*) from public.leads) as anon_visible_leads,
       (select count(email) from public.leads) as lead_emails_visible;
rollback;

-- 3.10 Run this in BOTH the CRM and the WaaS project and compare. Does each one hold the WaaS tables?
select to_regclass('public.audits') as audits_table,
       to_regclass('public.tenants') as tenants_table,
       to_regclass('public.leads') as leads_table,
       to_regclass('public.contacts') as crm_contacts_table;

-- 3.11 Who are the WaaS project's auth users? (run in the WaaS project, email domain only)
select id, created_at, last_sign_in_at,
       raw_app_meta_data ->> 'provider' as provider,
       raw_app_meta_data ->> 'role' as app_role,
       raw_app_meta_data ->> 'waas_admin' as waas_admin_flag,
       split_part(email, '@', 2) as email_domain
from auth.users order by created_at;
```

### 4.3 Results received

**Query 3.5b (WaaS project `audits` policies), received 2026-10-14.** Three policies are live: `audits_admin_all` (ALL, `authenticated`, JWT `waas_admin` claims), `audits_anon_insert_prospect` (INSERT, `anon`) and `audits_anon_read_own` (SELECT, `anon`, `audit_type = 'prospect' AND tenant_id IS NULL`). Consequences, from those rows plus the code:

1. **The anon read policy is live.** `audits` holds `requestor_name`, `requestor_email`, `requestor_phone` and `requestor_company` (`000_waas_complete_idempotent.sql`). `NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY` is public by design, so anyone holding it can call the WaaS REST API and read those columns for every unlinked prospect audit. No `REVOKE` on `audits` appears in the WaaS migrations, so column access is probably not restricted either. Query 3.7 below confirms this with `set role anon`. This is a PII exposure, not only an ownership gap.
2. **The code depends on that policy.** `app/audit/[auditId]/page.tsx`, `app/api/audit/[auditId]/create-tenant/route.ts` and `app/api/audit/leads/route.ts` read `audits` through `createWaasClient()`, which uses the anon key. Dropping the policy without changing those three call sites breaks the audit page, tenant creation and lead capture for new audits.
3. **There is no live `authenticated` read policy for tenant owners.** `002_waas_audits.sql` defines `audits_tenant_read_own`, but it is not in the live list. Combined with the anon-key client above, an audit that already has a `tenant_id` matches no anon policy, so those same three call sites likely cannot read it. If so, the ownership check in the page (`audit.tenant_id` branch) never runs for linked audits, and a repeat `create-tenant` call for an already-linked audit returns "Audit not found". This is inferred from the policy list and the code, not observed; confirm it with a read-only check (for example, load a linked audit page in a signed-in browser) before relying on it.
4. **Fix shape (phase 1).** Move the three call sites and the page's audit read to server-side reads with `getWaasAdminClient()` plus an explicit access check (owner by `owner_user_id` or lowercase email, or a share token), then drop `audits_anon_read_own`. The status poll already has a narrow path: `get_audit_status()` returns only id, status, report data, dates and error, with no requestor columns.

**Queries 3.7 and 3.7b (WaaS project), received 2026-10-14.**

1. **3.7 confirms the exposure.** As the `anon` role, `public.audits` returns 32 rows, 1 with a requestor email and 1 with a requestor phone. Anyone holding the public anon key can read those today. Only one row carries contact data, so the live PII exposure is small, but it grows with every new unlinked prospect audit that has a requestor email.
2. **3.7b shows default Supabase grants.** `anon` and `authenticated` both hold every table privilege on `audits` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES). Table privileges only matter together with row-level security. The policy list in 3.5b has no `anon` UPDATE or DELETE policy, so those are denied only if RLS is enabled on `audits`. The doc does not yet know that: query 3.8 checks it. TRUNCATE is not exposed by the Supabase REST API, but it is a privilege `anon` should not hold.
3. **Same pattern probably applies to `tenants` and `leads`.** Not checked. Query 3.8 and 3.9 cover them.

**Queries 3.1, 3.8 and 3.9, received 2026-10-14.**

1. **3.1 (`select count(*) from auth.users`): 11 in the CRM project, 2 in the WaaS project.** The platform is small: 11 CRM logins in total. That makes a manual or scripted identity repair realistic, and it makes snapshots cheap. It also contradicts an assumption in this plan: the WaaS project is not an empty login source, it has 2 auth users. Who they are is not known. One plausible reading is WaaS admin accounts, since the live `audits_admin_all` policy keys off a `waas_admin` JWT claim; that is a guess. Query 3.11 lists them (created, last sign-in, provider, email domain only).
2. **3.8: row-level security is enabled on `audits`, `leads` and `tenants` (not forced).** The anon policy counts are audits 2, leads 1, tenants 3. These match the three migration definitions exactly: audits (`audits_anon_insert_prospect`, `audits_anon_read_own`), leads (`leads_anon_insert`), tenants (`tenants_public_read_active`, `anon_can_create_tenant`, `anon_can_update_own_tenant_onboarding`). So the broad table grants seen in 3.7b are filtered by RLS, and the live policy set looks like the migrated one. This narrows the risk to the one policy already identified.
3. **3.9: anon sees 2 tenants (both `active`), 0 tenant emails, 0 leads.** `leads` has no anon SELECT policy, so lead emails are not readable with the anon key. Tenant contact emails are not exposed (0 visible). The only verified PII exposure remains `audits` (3.7: 1 email, 1 phone among 32 rows).
4. **Not concluded, needs a test:** the policy `anon_can_update_own_tenant_onboarding` is named "own" but its predicate is only `status IN ('onboarding', 'pending_review')`, with no ownership test. Whether an anon caller can actually update another onboarding tenant depends on how Postgres combines it with the SELECT policy (anon can only see `active` tenants). I have not tested this. It is listed as an open item for phase 1, not a finding.

**Open question: which project did the first results come from?** The 3.5b policy list (with the `waas_audit_type` enum) was run in the "full rankedceo-crm environment", and the 3.7 result was run in the WaaS project. If the `audits` table exists in both, either the WaaS migrations were also applied to the CRM project, or the two environments share one project. Section 1 of this plan assumes two separate projects (from the header of `lib/waas/supabase.ts`). Query 3.10 and the project refs (2.10) settle it. Until then, treat the "two projects" statements as unverified.

## 5. Phased plan

Each phase is its own branch and draft PR (DEC-0017). There is no QA environment (confirmed by Tommy 2026-10-14), so every DB phase runs against production. That changes the safety rules: each DB step is wrapped in a transaction where Postgres allows it, is preceded by a snapshot, ships with a written reverse script, and is run in a quiet window. Before phase 2, Tommy checks whether Supabase backups or point-in-time recovery are enabled for each project (not verified by me). I write the SQL only after the section 4 results are in (DEC-0013).

| Phase | What | DB? | Depends on |
|---|---|---|---|
| 0 | Tommy runs section 4 and pastes results. I update this doc with the verified live shape. | read-only | none |
| 1 | Code-only: `normalizeEmail()` helper used by all writers and by the ownership checks; `isPlatformAdmin()` helper for the access gate only (the three notification sites keep a shared recipient setting, not a predicate); close both anonymous audit paths for unlinked audits: add the missing access check to the PDF route, move the page, `create-tenant` and `leads` audit reads to `getWaasAdminClient()` with an explicit check, then drop the live `audits_anon_read_own` policy (verified live, see 4.3). Order matters: dropping the policy first breaks those three call sites. #291 is already merged. | no | D1, D3 |
| 2 | CRM DB: one `handle_new_user()` (id = auth uid, no shared default account), repair existing rows, unique index on `lower(email)` for `public.users`, optional `find_user_id_by_email()` SQL function (security definer, service-role only) replacing the paged `listUsers` lookup in #291. Gated on 2.8 and 2.6: if the `auth.users` FK is live, the trigger insert currently fails and must be fixed first. Profile-id changes require the 2.12 FK map plus a dependent-row inventory and a coordinated remap (see rollback). | yes, production (snapshot first) | phase 0, D2 |
| 3 | WaaS DB: add `owner_user_id uuid NULL` to `tenants`, `audits`, `leads` plus indexes. One-off script (dry run by default, like `scripts/backfill-section-ids.ts`) that fills it by matching lowercase email to CRM `auth.users`. Take a snapshot of the three tables before the backfill. | yes, production (snapshot first) | phase 2 |
| 4 | Code: write `owner_user_id` on create (create-tenant, onboarding steps, lead capture); ownership checks use `owner_user_id` first and lowercase email as fallback; set `tenants.crm_account_id` when a tenant converts. | no | phase 3 |
| 5 | WaaS DB: drop the vestigial `accounts`, `users` and trigger (only if 3.2 shows no data worth keeping and the 2 WaaS auth users found by 3.1 and 3.11 have been dealt with). Take a schema and data snapshot of both tables before the drop. | yes, production (snapshot first) | phase 0 |

Rollback: every DB phase takes a snapshot before it runs (phase 2: `public.users` and `public.accounts`; phase 3: the three WaaS tables; phase 5: the two vestigial tables and the trigger). Reverse order matters once phase 4 has deployed: revert the phase 4 code first so nothing writes or reads `owner_user_id`, then reverse phase 3 (the column can stay, but stop trusting the values), then phase 5 (recreate the tables from the snapshot if anything still reads them). Phase 2 profile-id changes need the 2.12 FK map, a dependent-row count per referencing table, and a remap of every dependent in the same transaction, because the keys have no `ON UPDATE CASCADE`; recreating a profile row without remapping its dependents silently loses ownership. After any phase-4 rollback, reconcile `owner_user_id` against the CRM `auth.users` email match and log the rows that no longer resolve.

## 6. Decisions needed from Tommy

1. **D1.** Verified (3.5b): the WaaS anon SELECT policy is live, so unlinked prospect audits, including requestor name, email, phone and company, are readable by anyone with the public anon key, and the PDF route also serves them with no sign-in. Who may read an unlinked audit? (a) only the requester, proved by a share token or a signed-in matching email (recommended), (b) anyone with the link only, with requestor columns hidden, or (c) leave open. Phase 1 must fix the PDF route and the policy together, and move the three anon-key call sites first (see 4.3 item 2).
2. **D2.** New self-serve signups: one new account per user (recommended) or keep the shared `my-account`?
3. **D3.** Source of truth for admins: env allowlist only, JWT claim only, or `users.role`? (Recommendation: JWT `app_metadata` claim, since WaaS RLS already depends on it, with the env allowlist as the bootstrap.)
4. **D4.** Is the CRM project the one shared with the eBay product? If yes, trigger changes in phase 2 must be checked against that product first.
5. **D5.** Should anonymous audit requesters be auto-created as auth users, or stay as an email string until they sign in (current behaviour)?

## 7. Risks

1. Cross-project `owner_user_id` is not enforced by the database. A deleted CRM user leaves a dangling uuid. Mitigation: never delete auth users, or add a periodic reconcile.
2. Changing `handle_new_user()` affects every signup path at once, including the trade signups that pass `industry`, `product` and `company_name` metadata. There is no QA environment, so each trade signup (hvac, plumbing, electrical, smile) needs a test signup with a throwaway email right after the change, and the previous trigger body must be saved so it can be restored in one statement.
3. Backfilling by email can attach rows to the wrong person if two people share a mailbox. Dry-run output is reviewed before the real run.
4. Phase 1 and 4 change access checks. Add tests that import the real helpers (Copilot catalog rows 8 and 14).
5. If the `auth.users` foreign key on `public.users.id` is live (check 2.8), the current `handle_new_user()` insert can abort new signups. Treat this as a possible live outage, not only a data-quality issue, and fix the trigger before any other phase-2 work.
