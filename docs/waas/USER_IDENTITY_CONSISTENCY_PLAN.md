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
7. **The WaaS project's `auth.users` is not a login source.** Its vestigial `accounts`/`users` and trigger are removed after verification.

Alternative considered: merge WaaS into the CRM project so real foreign keys work. Not recommended now: large migration, and the prod ref is shared with the eBay product (confirm which project, check 2.10). Revisit after the table-level cleanup.

## 4. Verification SQL for Tommy (read-only, run on QA first)

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
```

## 5. Phased plan

Each phase is its own branch and draft PR (DEC-0017). Phases 2 to 4 touch the DB, so Tommy runs them on QA first and I write the SQL only after the section 4 results are in (DEC-0013).

| Phase | What | DB? | Depends on |
|---|---|---|---|
| 0 | Tommy runs section 4 and pastes results. I update this doc with the verified live shape. | read-only | none |
| 1 | Code-only: `normalizeEmail()` helper used by all writers and by the ownership checks; `isPlatformAdmin()` helper for the access gate only (the three notification sites keep a shared recipient setting, not a predicate); close both anonymous audit paths for unlinked audits (the PDF route's missing sign-in check and, subject to 3.5b, the WaaS anon SELECT policy). Merge #291 first. | no | D1, D3 |
| 2 | CRM DB: one `handle_new_user()` (id = auth uid, no shared default account), repair existing rows, unique index on `lower(email)` for `public.users`, optional `find_user_id_by_email()` SQL function (security definer, service-role only) replacing the paged `listUsers` lookup in #291. Gated on 2.8 and 2.6: if the `auth.users` FK is live, the trigger insert currently fails and must be fixed first. Profile-id changes require the 2.12 FK map plus a dependent-row inventory and a coordinated remap (see rollback). | yes, QA first | phase 0, D2 |
| 3 | WaaS DB: add `owner_user_id uuid NULL` to `tenants`, `audits`, `leads` plus indexes. One-off script (dry run by default, like `scripts/backfill-section-ids.ts`) that fills it by matching lowercase email to CRM `auth.users`. Take a snapshot of the three tables before the backfill. | yes, QA first | phase 2 |
| 4 | Code: write `owner_user_id` on create (create-tenant, onboarding steps, lead capture); ownership checks use `owner_user_id` first and lowercase email as fallback; set `tenants.crm_account_id` when a tenant converts. | no | phase 3 |
| 5 | WaaS DB: drop the vestigial `accounts`, `users` and trigger (only if 3.1 and 3.2 show no data worth keeping). Take a schema and data snapshot of both tables before the drop. | yes, QA first | phase 0 |

Rollback: every DB phase takes a snapshot before it runs (phase 2: `public.users` and `public.accounts`; phase 3: the three WaaS tables; phase 5: the two vestigial tables and the trigger). Reverse order matters once phase 4 has deployed: revert the phase 4 code first so nothing writes or reads `owner_user_id`, then reverse phase 3 (the column can stay, but stop trusting the values), then phase 5 (recreate the tables from the snapshot if anything still reads them). Phase 2 profile-id changes need the 2.12 FK map, a dependent-row count per referencing table, and a remap of every dependent in the same transaction, because the keys have no `ON UPDATE CASCADE`; recreating a profile row without remapping its dependents silently loses ownership. After any phase-4 rollback, reconcile `owner_user_id` against the CRM `auth.users` email match and log the rows that no longer resolve.

## 6. Decisions needed from Tommy

1. **D1.** An audit with no tenant is reachable today by two anonymous paths: the PDF route with no sign-in check, and the WaaS anon SELECT policy. Should an unlinked audit be (a) restricted to the requester email, (b) reachable only through an unguessable share link, or (c) left open? Whichever you pick, phase 1 must fix the PDF route and, subject to 3.5b, the WaaS policy together.
2. **D2.** New self-serve signups: one new account per user (recommended) or keep the shared `my-account`?
3. **D3.** Source of truth for admins: env allowlist only, JWT claim only, or `users.role`? (Recommendation: JWT `app_metadata` claim, since WaaS RLS already depends on it, with the env allowlist as the bootstrap.)
4. **D4.** Is the CRM project the one shared with the eBay product? If yes, trigger changes in phase 2 must be checked against that product first.
5. **D5.** Should anonymous audit requesters be auto-created as auth users, or stay as an email string until they sign in (current behaviour)?

## 7. Risks

1. Cross-project `owner_user_id` is not enforced by the database. A deleted CRM user leaves a dangling uuid. Mitigation: never delete auth users, or add a periodic reconcile.
2. Changing `handle_new_user()` affects every signup path at once, including the trade signups that pass `industry`, `product` and `company_name` metadata. The trade signups need a test signup per product on QA.
3. Backfilling by email can attach rows to the wrong person if two people share a mailbox. Dry-run output is reviewed before the real run.
4. Phase 1 and 4 change access checks. Add tests that import the real helpers (Copilot catalog rows 8 and 14).
5. If the `auth.users` foreign key on `public.users.id` is live (check 2.8), the current `handle_new_user()` insert can abort new signups. Treat this as a possible live outage, not only a data-quality issue, and fix the trigger before any other phase-2 work.
