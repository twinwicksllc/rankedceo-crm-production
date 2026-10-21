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
- NOT VERIFIED: the live grants in `rankedceo-waas`. `tmp/waas_grants_check.sql` (read-only) answers it. Until it is run, treat the hole as probable, not proven.
- Why it matters now, not later: the 4 onboarding RPCs (`update_company_info`, `update_onboarding_step`, `skip_onboarding`, `update_preferences`) update `accounts WHERE id = p_account_id` with no ownership check. Only `complete_onboarding` checks the caller. In the CRM project these RPCs already exist with the same shape (READ, not checked live), so this is not new exposure from 030 itself, but moving production to the WaaS project should not carry it over.
- Fix = new migration 031 (separate PR, applied by hand like 030):
  1. `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on every SECURITY DEFINER function in `public`.
  2. Re-`GRANT EXECUTE` only to the roles that call each one (RLS helper functions need `authenticated`; the audit RPCs the WaaS public pages call stay as they are today; check against live before touching them).
  3. Add the same ownership check `complete_onboarding` has to the other 4 onboarding RPCs.
  4. Do NOT touch `handle_new_user()` (belongs to the other product).
- Risk of 031: revoking from `authenticated` on a function an RLS policy calls would break reads. Mitigation: the policy-dependency list is derived from `pg_policies` before writing the revokes, and the local harness runs 030+031 and then exercises each policy as `authenticated`.

## 2. Gating decisions (one at a time; I recommend, you choose)

D1. How the 11 CRM logins reach `rankedceo-waas`. `auth.users` is separate per project, so moving table rows does not move logins.
- A (recommended): create the users in WaaS auth through the Supabase Admin invite API and have each set a new password / use magic link. 11 users is small; no password hashes handled.
- B: scripted recreation of auth users preserving ids (needs service-role access to both projects; password hashes cannot be copied without the Supabase support path).
- C: keep CRM project as the auth source only. Not a real consolidation; rejected unless A and B fail.
- Whichever is chosen, user ids must be preserved or `users.id` / `account_id` mappings rewritten, because `users.id` IS the auth uid.

D2. Data copy. READ from plan doc: CRM tables are nearly empty (`agent_conversations` 31, `industry_leads` 5, `appointments` 2, `calendly_connections` 1, `accounts` 6 incl. 4 pool rows that 030 already seeds). Recommendation: copy those few rows by script after D1, with row counts compared before and after. Re-verify counts the day of cutover (they may have changed).

D3. Staging. Recommendation: rehearse on a Vercel Preview deployment with the env vars overridden to the WaaS project, run QA smoke there, before touching Production env. Needs no new spending. QA already targets `rankedceo-waas` per DEC-0024 (until the QA repurpose of the CRM project happens).

D4. Which project production admin code truly reads/writes. READ: `lib/waas/actions/admin/_shared.ts` uses the CRM env vars. ASSUMED: matches Vercel. Needs you to confirm which Supabase URL is set in Vercel Production (project ref only, never the key).

## 3. Supabase dashboard settings to replicate in `rankedceo-waas` (ASSUMED needed; compare against CRM project)

Auth settings live per project and are not carried by migrations: Site URL and redirect URLs (the CRM's `/api/auth/callback`), Google OAuth provider credentials, email templates and SMTP, email-confirmation setting, password rules. Storage buckets `avatars`, `client-uploads`, `listing-images` (WaaS currently has only `logos`) and their policies. Each is a manual dashboard step by you; I will provide the exact list after you give me the CRM-side values, with secrets never pasted.

## 4. Code changes

READ: the CRM client URL comes from `NEXT_PUBLIC_SUPABASE_URL` (17 files), the service key from `SUPABASE_SERVICE_ROLE_KEY` (31 files), WaaS from `NEXT_PUBLIC_WAAS_SUPABASE_URL` / `WAAS_SUPABASE_SERVICE_ROLE_KEY`. If both pairs hold the WaaS values, the app works with **no code change**. Therefore the switch is an env change + redeploy, which is quick to flip and quick to revert. `NEXT_PUBLIC_*` is baked into the browser bundle at build time, so a redeploy is required in both directions.

Known code follow-ups (not blockers for the env flip, but they break once `users.email` is NULL in WaaS): `onboarding-service.ts` and `settings-service.ts` still find the account by `users.email`. Fix in its own small PR, using `resolveAccountId` from #317, before cutover.

## 5. Sequence

1. Run `tmp/waas_grants_check.sql` in `rankedceo-waas` (read-only) -> confirms or clears section 1.
2. PR: migration 031 (grants + ownership checks), draft, local proof; you apply by hand, then re-run the grants check.
3. PR: `onboarding-service` / `settings-service` account lookup fix.
4. You answer D1-D4.
5. You replicate dashboard settings and buckets (section 3).
6. Create/invite users in WaaS auth (D1); copy data (D2) with before/after counts.
7. Vercel Preview deployment pointed at WaaS; run QA smoke + manual login (password, magic link, Google), onboarding, create company/contact/deal, avatar upload.
8. Cutover: change Production env vars, redeploy, repeat the manual checks.
9. Rollback: set env vars back to the CRM project values and redeploy. Data written to WaaS after cutover would not exist in the CRM project, so keep the cutover window short and during low usage. The CRM project is not deleted or repurposed (DEC-0024) until the rollback window has passed.

## 6. Out of scope here

The four table names with no live table (`waas_tenants`, `calendar_provider_connections`, `audit_abandonment_tracking`; `tenant_variant_regenerations` was created by 029) and the CRM project's `schema_migrations` bookkeeping repair. Both stay on the reminder list.
