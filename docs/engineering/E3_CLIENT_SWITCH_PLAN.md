# E3 Client Switch Plan (step 8 of DB_CONSOLIDATION_PLAN.md)

Status: DRAFT for Tommy's decision. Nothing in this document has been executed.
Written: 2026-10-21. Base: main `fcd4219`. Section 1b added 2026-10-22 (base `e34ca73`).

"Client switch" = pointing the CRM app at `rankedceo-waas` (ref `klgvdvryewykzlumbkei`) instead of `rankedceo-crm-production` (ref `wcednzaxmxwfiijzmjmx`), so there is one project.

How facts are labelled below: **VERIFIED** = I ran a command or query and saw the result. **READ** = I read code or docs, did not run it. **ASSUMED** = not checked; must be checked before relying on it.

---

## 0. Where we are

- VERIFIED: migration 030 is applied in `rankedceo-waas`. Post-check 1-8 passed (23 tables, 23 RLS, 58 policies, 27 functions, 22 triggers). `handle_new_user` md5 unchanged; `auth.users` triggers unchanged. Sign-up smoke test (#9) passed after my test was fixed.
- READ: the app still talks to the CRM project for everything CRM-side. Nothing has been switched.

## 1. Correction to my own work: 030 section 7b does NOT lock down the functions

I said 030 locked down the SECURITY DEFINER functions. That was too strong.

- READ (Supabase docs, "Database functions > Function privileges"): by default any role can run a database function, including `anon`. Revoking from `PUBLIC` alone is not enough; you must also revoke from `anon` and `authenticated` explicitly. Supabase GitHub issue #43884 describes the same default.
- VERIFIED (on my local throwaway Postgres, NOT on your live project): with Supabase-style default privileges added to the harness, all 18 SECURITY DEFINER functions from 030 were executable by `anon`. I then called `update_company_info` and `update_onboarding_step` as `anon` against another account's id and changed that account's name. That is a real hole **if the live project has the same default privileges**.
- VERIFIED live (Tommy ran the read-only query on 2026-10-21): `anon_exec = true` on all 25 SECURITY DEFINER functions in `rankedceo-waas`, and `pg_default_acl` grants `anon`/`authenticated` EXECUTE on every new function in `public`. The hole is confirmed, not theoretical. Note the ACLs show `complete_onboarding` lost its `PUBLIC` grant (so 030 §7b did work) but kept direct `anon` and `authenticated` grants, which is exactly the gap.
- Why it matters now, not later: the 4 onboarding RPCs (`update_company_info`, `update_onboarding_step`, `skip_onboarding`, `update_preferences`) update `accounts WHERE id = p_account_id` with no ownership check. Only `complete_onboarding` checks the caller. In the CRM project these RPCs already exist with the same shape (READ, not checked live), so this is not new exposure from 030 itself, but moving production to the WaaS project should not carry it over.
- Fix = migration 031 (`supabase/migrations/waas/031_harden_function_grants.sql`, PR #319, applied by hand like 030). It does **not** revoke everything from everyone. The exact set:
  1. Revokes EXECUTE from `PUBLIC`, `anon` **and** `authenticated` on a named list: the 7 trigger functions, the 3 audit RPCs (`capture_audit_lead`, `create_prospect_audit`, `get_audit_status`), the 6 account/conversation RPCs, the 5 onboarding RPCs, `get_current_user_id`, `get_current_user_account_id`, `get_active_commission_rate`, `assert_own_account`.
  2. Grants back to `authenticated` for the 12 functions a signed-in user actually calls (including `get_current_user_account_id`, which RLS policies need), and to `service_role` for the audit RPCs plus those 12.
  3. Keeps `anon` on `resolve_tenant_by_hostname` only, because `lib/waas/supabase.ts` falls back to the anon key.
  4. Adds `assert_own_account()` and rewrites the 4 onboarding RPCs to use it.
  5. Revokes `TRUNCATE`/`REFERENCES`/`TRIGGER` from `anon`/`authenticated` on all `public` tables, and from the default table grant.
  6. **Exceptions, deliberately left alone:** the `handle_new_user()` body (other product), and the smile functions `get_smile_account_id`, `get_smile_pool_account_id`, `submit_smile_assessment_with_pool` — no caller in this repo, and changing them blind could break the other product. `submit_smile_assessment_with_pool` therefore stays anon-executable and takes `p_account_id`; that is D5 below, not something 031 fixes.
- Risk of 031: revoking from `authenticated` on a function an RLS policy calls would break reads. Mitigation: the policy-dependency list is derived from `pg_policies` before writing the revokes, and the local harness runs 030+031 and then exercises each policy as `authenticated`.

## 1b. Corrections to sections 2 and 5 (2026-10-22, both ASSUMED until the one-user test)

> Superseded in part by section 1c (2026-10-22): no logins are moved, so Correction 1 and the one-user test are not needed for the cutover. They stay written down in case real users ever have to be moved between projects. Correction 2 still applies to every new sign-up.

Two statements below were incomplete. Both corrections are READ from source code, not run against the hosted project. Treat both as **ASSUMED** until a one-user test in `rankedceo-waas` has run (see "The one-user test" at the end of this section).

Sources read: `supabase/auth` at `c3348e8f1cb3` (`internal/api/admin.go`, `internal/api/invite.go`, `internal/api/external.go`, `internal/models/linking.go`, `internal/conf/configuration.go`) and `supabase/supabase-js` at `db8c3a450e06` (`packages/core/auth-js/src/lib/types.ts`). The hosted project may run a different auth version.

### Correction 1: the user id can be kept, so D2 may need no id rewrite

D2 says "The Admin invite API mints a **new** auth UUID". That is true of the invite endpoint only.

- READ: `POST /invite` (`invite.go`) accepts only `email` and `data`. It always creates a new id.
- READ: `POST /admin/users` (`adminUserCreate` in `admin.go`) accepts `id`. A non-nil uuid replaces the generated id before the row is written. It also accepts `email_confirm` and `password_hash`. If neither `password` nor `password_hash` is given, it sets a random 64-character password. supabase-js exposes the same fields on `auth.admin.createUser()` (`AdminUserAttributes.id`, `email_confirm`, `password_hash`).
- If the hosted project honours `id`, each login can be created in `rankedceo-waas` with the same uid it has in `rankedceo-crm-production`. Then `users.id`, every user-id column and every `account_id` mapping stays valid with no rewrite. The old-to-new table in D2 step 1 becomes an identity map, kept as an audit record of who was created, when, and by whom. D2 step 2 becomes a check that proves nothing needs rewriting.
- Fallback if the test fails: invite, plus an `old_uid -> new_uid` table and the full rewrite in D2 step 2, as written.

Conditions on that path (READ from the same source; each must hold in the test):

- **Create users with `email_confirm: true`.** For a Google sign-in, `external.go` treats an existing _unconfirmed_ user specially: it calls `RemoveUnconfirmedIdentities`, then confirms the user only if Google reports the email as verified or the project auto-confirms emails. Otherwise it sends a confirmation email and refuses the sign-in. Creating confirmed users avoids that branch.
- **Google linking must not be isolated.** `linking.go` links a new Google identity to an existing user that has the same verified email only when Google shares the default linking domain. If `rankedceo-waas` maps `google` to its own linking domain (the `ProviderLinkingDomains` setting, or the deprecated `ProvidersWithOwnLinkingDomain`), a Google sign-in creates a **second** user with a new uid. ASSUMED: hosted Supabase does not expose this setting in the dashboard, so the test is the check.
- **Do not send `password_hash` by default.** Copying hashes needs a method Tommy confirms. The default is that each user sets a new password or uses a magic link. The random password the API generates is never used or shown.

### Correction 2: every created user also gets a junk account in `rankedceo-waas`

Section 2 does not say this, and it changes D2 step 3.

- READ (`waas/027_baseline_accounts_users.sql:70-95`, and the live body matched it in audit 2, `DB_CONSOLIDATION_PLAN.md` section 3): `rankedceo-waas` has `on_auth_user_created` → `handle_new_user()`. For every new `auth.users` row it inserts one `accounts` row named from `raw_user_meta_data.full_name`, else `'My Account'`, and one `users` row with `id = <the new uid>` pointing at that account.
- This fires on any insert into `auth.users`, so **invite and create both trigger it**.
- So after creating the 11 users, `rankedceo-waas` holds 11 new `accounts` rows (not all of them named `'My Account'`, if any user has `full_name` metadata) and 11 `users` rows pointing at them. If the CRM `public.users` row is then copied with the same id, it collides with the trigger's row on the primary key.
- The data copy must therefore **update** each trigger-made `users` row (point `account_id` at the real account, fill the CRM columns) and then delete the trigger-made accounts. It must not insert over them.
- The set of accounts to delete is identified by id, captured at create time (the `account_id` of the trigger-made `users` row, recorded next to each created uid). It is not identified by name. A post-check must prove that no other row references a deleted account.
- This is the step most likely to corrupt data, so it is rehearsed (D3) before it runs on the real users.
- `handle_new_user()` itself is not changed. That rule is set out in DEC-0022 ("Rules that still apply") and in `USER_IDENTITY_CONSISTENCY_PLAN.md`.

A related hazard, for deleting the test user. `rankedceo-waas` also has `on_auth_user_deleted` → `handle_user_delete()` (audit, `DB_CONSOLIDATION_PLAN.md` section 4). Its live body was read in audit 2 but is not recorded in this repo. The CRM migration copy (`000005_fix_users_accounts_with_correct_schema.sql:271-299`) deletes the `users` row and then marks or updates the account. In `waas/027`, `public.users.id` references `auth.users(id) ON DELETE CASCADE`. If the live table matches (not verified), deleting an auth user removes its `users` row whatever that body does. So the test user's cleanup must check which rows remain afterwards, and must never be run against a real user's uid.

### The one-user test (decides D2 and settles both corrections)

Run by Tommy in `rankedceo-waas` with a service-role call. The service-role key is never pasted into chat, a PR or a log.

1. Create one throwaway user with `POST /admin/users`, a chosen uuid, `email_confirm: true` and no password.
2. Confirm that the returned id equals the supplied uuid.
3. Confirm the trigger's side effect: exactly one new `accounts` row and one `users` row with `id` = the supplied uuid.
4. Sign in as that user by magic link.
5. If a Google account with a verified email is available for the test, sign in with Google on the same address. Confirm that `auth.identities` gains a `google` row for the **same** user id, and that `auth.users` gains no new user.
6. Delete the test user. Confirm what `handle_user_delete()` and the cascade left behind, and remove any leftover account by id.

Record what was observed in the PR that turns these corrections from ASSUMED into VERIFIED.

## 1c. No login migration (2026-10-22, DEC-0026)

Tommy, 2026-10-22: there are no external users. The only logins are Tommy, his partner and test users, and they can create new logins at any time.

- **Dropped:**
  - moving the 11 CRM logins (D1);
  - the uid map and the id rewrite (D2 steps 1 and 2);
  - choosing which profile-less logins get a profile (D6 in `docs/waas/USER_IDENTITY_CONSISTENCY_PLAN.md`).
- **New path.** After the cutover, Tommy and his partner sign up again in `rankedceo-waas` (password, magic link or Google). Each sign-up fires `handle_new_user()`, which creates one `accounts` row and one `users` row (Correction 2). READ (`lib/supabase/ensure-crm-profile.ts:144-165`): `ensureCrmProfile()` then finds that `users` row by id and does nothing, so the two do not both write. The first real sign-up after the cutover is the check.
- **What those new rows look like** (READ from `waas/027` and `waas/030`):
  - `users.role` gets the column default `'rep'`. `users.email` and `users.name` are NULL. Account lookups go by id (`resolveAccountId`, #323), so a NULL email does not break them.
  - `'rep'` is not an admin role. Access to `/admin` then comes only from the `WAAS_ADMIN_EMAILS` / `WAAS_ADMIN_EMAIL` allowlist or the `app_metadata` admin claim (`lib/auth/admin.ts`). Whether the allowlist is set in Vercel Production is **not verified**. It must be before the cutover, or nobody can open the admin dashboard.
  - Each sign-up gets its own account. If Tommy and his partner should share one account, one `users.account_id` update is needed afterwards (Tommy's call).
- **Left alone:**
  - the 11 CRM logins stay in `rankedceo-crm-production`, untouched, until DEC-0024 repurposes that project;
  - the 2 existing `rankedceo-waas` auth users are kept.
- **Still open: which rows, if any, come across.** "No external users" covers logins, not data. `industry_leads` and `agent_conversations` hold leads captured from public forms and the website chat, which may be real prospects. Since DEC-0025, the admin tools have also been writing to the CRM project's copies of the WaaS tables. D2 steps 3 and 4 apply only to the rows Tommy decides to keep.

## 2. Gating decisions (one at a time; I recommend, you choose)

D1. How the 11 CRM logins reach `rankedceo-waas`. `auth.users` is separate per project, so moving table rows does not move logins. **Settled 2026-10-22 (DEC-0026): they are not moved. See section 1c.** The options below were written before that and are kept for the record.
- A (recommended): create the users in WaaS auth through the Supabase Admin invite API and have each set a new password / use magic link. 11 users is small; no password hashes handled.
- B: scripted recreation of auth users preserving ids (needs service-role access to both projects; password hashes cannot be copied without the Supabase support path).
- C: keep CRM project as the auth source only. Not a real consolidation; rejected unless A and B fail.
- Whichever is chosen, user ids must be preserved or `users.id` / `account_id` mappings rewritten, because `users.id` IS the auth uid.

D2. Data copy — **this is the gate that D1=A creates, and it is not a "copy the rows" step.**

> Narrowed 2026-10-22, see section 1c (DEC-0026). No logins are moved, so steps 1 and 2 are dropped. Steps 3 and 4 apply only to the rows Tommy decides to copy. Section 1b corrected the text below; it matters only if logins are ever moved.
>
> Corrected 2026-10-22, see section 1b. The text below holds for the invite endpoint. `POST /admin/users` can keep the original uid (Correction 1), which would turn step 2 into a check. Every created user also gets a trigger-made account and `users` row (Correction 2), which changes step 3. Both are ASSUMED until the one-user test.

The Admin invite API mints a **new** auth UUID. This repo keys `public.users.id` to the auth UUID, and `accounts.id` is referenced by every CRM table. So inviting first and copying rows afterwards would attach the copied rows to the wrong people, and `ensureCrmProfile()` would then create a second profile for each invited user.

D2 therefore needs, in this order:
1. Invite the 11 users and record `old_crm_uid -> new_waas_uid` for each (a table, not a spreadsheet in someone's head).
2. Rewrite `public.users.id` and **every** column that stores a user id before the rows land in waas. At minimum `users.id`; then find the rest by query, not by memory: every FK to `users(id)` in the CRM schema, plus text/uuid columns that hold a user id without an FK. The list must come from `information_schema` on the CRM project, not from this document.
3. Reconcile against what is **already** in waas, which is not empty: 6 `accounts` rows and 2 `users` rows exist, and 030 seeded the 4 pool accounts. A blanket copy can collide on primary keys or duplicate the pool rows. Every copied row needs an explicit "already represented / insert new / skip" decision, and the 4 pool accounts must be matched by their seeded ids rather than re-inserted.
4. Verify: per-table row counts before and after, plus a per-user check that each invited user resolves to exactly one account and sees only their own rows.

READ from the plan doc: the rows are few (`agent_conversations` 31, `industry_leads` 5, `appointments` 2, `calendly_connections` 1, `accounts` 6 incl. 4 pool rows). Counts must be re-verified the day of cutover; they will have changed.

D3. Staging. `rankedceo-waas` is **not** a safe rehearsal target as-is: per DEC-0024 the QA agent already writes browser-driven rows into its `public` schema, and a rehearsal that creates companies, contacts and deals would mix test rows into the data we are about to call production. Options:
- A (recommended): a disposable Supabase project (or a restored branch) for the rehearsal, torn down afterwards. Cost is the open question, and "no new expenses until revenue" applies, so this needs your call.
- B: rehearse against `rankedceo-waas` using one dedicated test account, with a written list of every row created and a cleanup script that deletes exactly those rows, run and verified before cutover.
- C: no rehearsal; cut over and rely on rollback. Only acceptable if the cutover window is short and rollback has been tested once.
Whichever is chosen, the rehearsal must not touch the 6 existing `accounts` or the 4 seeded pool accounts.

D4. Which project production admin code truly reads/writes. READ: `lib/waas/actions/admin/_shared.ts` uses the CRM env vars. ASSUMED: matches Vercel. Needs you to confirm which Supabase URL is set in Vercel Production (project ref only, never the key).

D5. `submit_smile_assessment_with_pool` stays anon-executable and accepts `p_account_id`, so an anon caller can write an assessment into any account. Nothing in this repo calls it, so 031 leaves it alone rather than break the other product blind. Options: A (recommended) add an ownership/allow-list check inside the function in a follow-up migration once the other product's caller is identified; B revoke anon and let it fail loudly, accepting that the other product's public form breaks; C accept the risk in writing and move on. **This must be decided before the cutover**, because after the switch this function is reachable in the project that serves production.

## 3. Supabase dashboard settings to replicate in `rankedceo-waas` (ASSUMED needed; compare against CRM project)

Auth settings live per project and are not carried by migrations: Site URL and redirect URLs (the CRM's `/api/auth/callback`), Google OAuth provider credentials, email templates and SMTP, email-confirmation setting, password rules. Storage buckets `avatars`, `client-uploads`, `listing-images` (WaaS currently has only `logos`) and their policies. Each is a manual dashboard step by you; I will provide the exact list after you give me the CRM-side values, with secrets never pasted.

## 4. Code changes

READ: the CRM client URL comes from `NEXT_PUBLIC_SUPABASE_URL` (17 files), the **anon key** from `NEXT_PUBLIC_SUPABASE_ANON_KEY` (10 files, including `lib/supabase/client.ts`, `server.ts`, `audit-client.ts`, `middleware.ts`, `middleware.ts` at the root, and `app/api/auth/callback/route.ts`), and the service key from `SUPABASE_SERVICE_ROLE_KEY` (31 files). WaaS uses `NEXT_PUBLIC_WAAS_SUPABASE_URL`, `NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY` and `WAAS_SUPABASE_SERVICE_ROLE_KEY`.

**Three** CRM variables must move together, not two: URL, anon key, service-role key. The anon key is project-specific; pointing the URL at waas while leaving the CRM anon key in place makes every browser and API auth call fail, and it fails at login, not at build. If all three hold the waas values, the app works with **no code change**, so the switch is an env change plus a redeploy and rollback is the same in reverse. `NEXT_PUBLIC_*` is baked into the browser bundle at build time, so a redeploy is required in both directions.

Known code follow-ups. These break once `users.email` is NULL in waas, so they are **cutover blockers**, not nice-to-haves. VERIFIED by grep, every signed-in-account lookup by email:
- `lib/services/onboarding-service.ts:22`
- `lib/services/settings-service.ts:22, 40, 57`
- `lib/services/commission-service.ts:29` (commission pages)
- `lib/actions/industry-lead.ts:132, 277` (industry-lead reads and stats)
All of them move to `resolveAccountId` from #317 in one small PR before cutover.

Two other `.eq("email", ...)` sites are **not** this problem and stay as they are: `lib/services/form-submission-service.ts:154` and `app/api/audit/abandonment-check/route.ts:216, 231` look up a lead by the email a visitor submitted, not the signed-in user's account.

## 5. Sequence

The check scripts now live in the repo, so an operator can reproduce every gate from a checkout: `docs/engineering/checks/waas_function_grants_check.sql`, `030_precheck.sql`, `030_postcheck.sql`, `031_postcheck.sql`.

1. Run `docs/engineering/checks/waas_function_grants_check.sql` in `rankedceo-waas` (read-only). Already done on 2026-10-21: the hole is confirmed.
2. Merge #319, apply `031_harden_function_grants.sql` by hand, run `031_postcheck.sql` (10 rows, all PASS, `handle_new_user` md5 unchanged).
3. PR: move the 8 email-based account lookups in section 4 to `resolveAccountId`.
4. Decide D2, D3, D4, D5. D1 is settled: A.
5. Replicate dashboard settings and buckets (section 3).
6. No logins are created in advance (section 1c, DEC-0026). Confirm that the admin allowlist is set in Vercel Production.
7. Copy only the rows Tommy decides to keep (D2 steps 3-4), with the pool accounts matched, not re-inserted. If nothing is kept, skip this step.
8. Rehearse (D3), then cut over: change **URL, anon key and service-role key** in Production, redeploy, then run the manual checks. Tommy and his partner sign up fresh (password, magic link, Google), then onboarding, create company/contact/deal, and avatar upload.
9. Rollback: set the same three variables back to the CRM project values and redeploy. Data written to waas after cutover would not exist in the CRM project, so keep the window short and during low usage. The CRM project is not deleted or repurposed (DEC-0024) until the rollback window has passed.

## 6. Out of scope here

The three table names with no live table (`waas_tenants`, `calendar_provider_connections`, `audit_abandonment_tracking`; `tenant_variant_regenerations` was created by 029) and the CRM project's `schema_migrations` bookkeeping repair. Both stay on the reminder list.

### 1a. What 031 does, and what it was proven against

Written 2026-10-21, tested locally only. Applied to nothing.

- Default privileges: future functions created by `postgres` in `public` no longer grant EXECUTE to `anon`/`authenticated`, and no longer grant to `PUBLIC` globally.
- Revokes EXECUTE from `PUBLIC` and `anon` on: the 7 trigger functions, the 3 audit RPCs, the 6 account-scoped/conversation RPCs, the 5 onboarding RPCs, `get_current_user_id`, `get_current_user_account_id`, `get_active_commission_rate`, `assert_own_account`.
- Re-grants to `authenticated` where a signed-in user calls it (including `get_current_user_account_id`, which RLS policies need) and to `service_role` for the audit RPCs.
- Keeps `anon` on `resolve_tenant_by_hostname` only (the code falls back to the anon key).
- Adds `assert_own_account()` and rewrites `update_company_info`, `update_onboarding_step`, `skip_onboarding`, `update_preferences` to use it, so `p_account_id` can no longer name someone else's account. `service_role` callers bypass the check.
- Removes `TRUNCATE`, `REFERENCES`, `TRIGGER` from `anon`/`authenticated` on all `public` tables and from the default table grant. RLS cannot gate `TRUNCATE`, and PostgREST never uses it.
- Deliberately untouched: the `handle_new_user()` body, and the smile-assessment functions (`get_smile_account_id`, `get_smile_pool_account_id`, `submit_smile_assessment_with_pool`). No caller in this repo; changing them blind could break the other product. `submit_smile_assessment_with_pool` is still anon-executable and accepts `p_account_id`, so an anon caller can write an assessment into any account. That is a separate decision.

Proof (`tmp/test_031.py`, throwaway Postgres, 030 then 031): 10/10 pass. anon is refused on the onboarding RPCs; a signed-in user updates their own account; the same user is refused on another account with "Cannot modify another account"; an RLS policy using `get_current_user_account_id()` still returns only the user's own rows; anon cannot `TRUNCATE`; the signup trigger still fires with its EXECUTE grant revoked; `resolve_tenant_by_hostname` still works for anon; `service_role` can act on any account; 031 re-runs cleanly. `npm run check` passes.

Not covered by that proof: the real PostgREST role/JWT plumbing. The service-role bypass reads `request.jwt.claims`, which PostgREST sets; the harness sets it by hand.
