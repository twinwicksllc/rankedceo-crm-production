# E3 Client Switch Plan (step 8 of DB_CONSOLIDATION_PLAN.md)

Status: DRAFT for Tommy's decision. Nothing in this document has been executed.
Written: 2026-10-21. Base: main `fcd4219`.

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

## 2. Gating decisions (one at a time; I recommend, you choose)

D1. How the 11 CRM logins reach `rankedceo-waas`. `auth.users` is separate per project, so moving table rows does not move logins.
- A (recommended): create the users in WaaS auth through the Supabase Admin invite API and have each set a new password / use magic link. 11 users is small; no password hashes handled.
- B: scripted recreation of auth users preserving ids (needs service-role access to both projects; password hashes cannot be copied without the Supabase support path).
- C: keep CRM project as the auth source only. Not a real consolidation; rejected unless A and B fail.
- Whichever is chosen, user ids must be preserved or `users.id` / `account_id` mappings rewritten, because `users.id` IS the auth uid.

D2. Data copy — **this is the gate that D1=A creates, and it is not a "copy the rows" step.**

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
6. Invite the users and build the old-to-new uid map (D2 step 1). **Do not copy any rows until the map exists.**
7. Reconcile and copy data (D2 steps 2-4), with the pool accounts matched, not re-inserted.
8. Rehearse (D3), then cut over: change **URL, anon key and service-role key** in Production, redeploy, run the manual checks (password, magic link, Google, onboarding, create company/contact/deal, avatar upload).
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
