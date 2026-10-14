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

Ownership check for an audit report (`app/audit/[auditId]/page.tsx`, `app/api/audit/[auditId]/pdf/route.ts`): CRM `auth.getUser()`, then WaaS `tenants` filtered by `.eq("submitted_by_email", user.email)`. It only applies when `audit.tenant_id` is set.

## 2. Inconsistencies found

1. **Join key is free-text email, exact case.** `Tommy@x.com` and `tommy@x.com` do not match in `.eq("submitted_by_email", user.email)`. Some writers lowercase (`capture_audit_lead` lowercases and trims the email in `000_waas_complete_idempotent.sql`); others store what the user typed.
2. **No user id in WaaS.** `audits`, `leads` and `tenants` have no column that points at an auth user. A cross-project foreign key is impossible, so the best available is an unenforced `uuid` column.
3. **Audits without a tenant are open to any signed-in user.** The ownership check only runs when `audit.tenant_id` is set (see section 1). Needs a product decision, not only a technical one.
4. **`users.id` linkage disagrees across migrations.** 000001 and 000005 declare `users.id REFERENCES auth.users(id)`. 000006 and 000007 insert `gen_random_uuid()` and match by email. `app/admin/layout.tsx` matches `public.users` by `id`; `lib/services/settings-service.ts` matches by `email`. Both cannot be right for the same row.
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
6. **One admin helper** (`isPlatformAdmin(user)`) used by `app/admin/layout.tsx`, the three env-reading call sites and anywhere else; one documented source of truth for who is an admin (decision D3).
7. **The WaaS project's `auth.users` is not a login source.** Its vestigial `accounts`/`users` and trigger are removed after verification.

Alternative considered: merge WaaS into the CRM project so real foreign keys work. Not recommended now: large migration, and the prod ref is shared with the eBay product (confirm which project, check 2.10). Revisit after the table-level cleanup.

## 4. Verification SQL for Tommy (read-only, run on QA first)

All statements are SELECT only. They return counts and structure, no password data. Run each in the Supabase SQL editor of the named project.

### 4.1 CRM project

```sql
-- 2.1 Is the profile id the auth id? (expect id_matches ~ total if 000001/000005 shape is live)
select count(*) as profiles,
       count(*) filter (where a.id = u.id) as id_matches_auth_id,
       count(*) filter (where a.id is not null and a.id <> u.id) as id_differs_same_email,
       count(*) filter (where a.id is null) as no_auth_user_for_email
from public.users u
left join auth.users a on lower(a.email) = lower(u.email);

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

-- 3.5 Audits with an email but no tenant (open to any signed-in viewer today)
select count(*) from public.audits
where tenant_id is null and requestor_email is not null;

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
| 1 | Code-only: `normalizeEmail()` helper used by all writers and by the ownership checks; `isPlatformAdmin()` helper replacing the four env readers; decide and implement behaviour for audits with no tenant. Merge #291 first. | no | D1, D3 |
| 2 | CRM DB: one `handle_new_user()` (id = auth uid, no shared default account), repair existing rows, unique index on `lower(email)` for `public.users`, optional `find_user_id_by_email()` SQL function (security definer, service-role only) replacing the paged `listUsers` lookup in #291. | yes, QA first | phase 0, D2 |
| 3 | WaaS DB: add `owner_user_id uuid NULL` to `tenants`, `audits`, `leads` plus indexes. One-off script (dry run by default, like `scripts/backfill-section-ids.ts`) that fills it by matching lowercase email to CRM `auth.users`. | yes, QA first | phase 2 |
| 4 | Code: write `owner_user_id` on create (create-tenant, onboarding steps, lead capture); ownership checks use `owner_user_id` first and lowercase email as fallback; set `tenants.crm_account_id` when a tenant converts. | no | phase 3 |
| 5 | WaaS DB: drop the vestigial `accounts`, `users` and trigger (only if 3.1 and 3.2 show no data worth keeping). | yes, QA first | phase 0 |

Rollback: phases 3 and 5 only add or drop unused objects, so each has a clear reverse. Phase 2 changes a trigger and repairs rows, so it needs a snapshot of `public.users` and `public.accounts` taken before the run.

## 6. Decisions needed from Tommy

1. **D1.** An audit with no tenant: keep it viewable by any signed-in user, restrict to the requester email, or keep the share link behaviour only?
2. **D2.** New self-serve signups: one new account per user (recommended) or keep the shared `my-account`?
3. **D3.** Source of truth for admins: env allowlist only, JWT claim only, or `users.role`? (Recommendation: JWT `app_metadata` claim, since WaaS RLS already depends on it, with the env allowlist as the bootstrap.)
4. **D4.** Is the CRM project the one shared with the eBay product? If yes, trigger changes in phase 2 must be checked against that product first.
5. **D5.** Should anonymous audit requesters be auto-created as auth users, or stay as an email string until they sign in (current behaviour)?

## 7. Risks

1. Cross-project `owner_user_id` is not enforced by the database. A deleted CRM user leaves a dangling uuid. Mitigation: never delete auth users, or add a periodic reconcile.
2. Changing `handle_new_user()` affects every signup path at once, including the trade signups that pass `industry`, `product` and `company_name` metadata. The trade signups need a test signup per product on QA.
3. Backfilling by email can attach rows to the wrong person if two people share a mailbox. Dry-run output is reviewed before the real run.
4. Phase 1 and 4 change access checks. Add tests that import the real helpers (Copilot catalog rows 8 and 14).
