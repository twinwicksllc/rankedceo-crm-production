# E3 rehearsal plan (DEC-0029, scope narrowed by DEC-0030)

Status: DRAFT for Tommy. Nothing here has been run against `rankedceo-waas`.

Labels: **VERIFIED** = I ran it. **READ** = I read code or docs, did not run it. **ASSUMED** = not checked; check it when you reach that step.

Project names used below: `rankedceo-waas` (ref `klgvdvryewykzlumbkei`) is the project the rehearsal writes to and cleans up. `rankedceo-crm-production` (ref `wcednzaxmxwfiijzmjmx`) is the project the app uses today and the one the rollback test returns to.

## What the rehearsal creates

One test login and the rows below. Each claim is READ from the code unless marked.

| Where                                                                                                                          | What                                                                              | How the cleanup finds it                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `auth.users`                                                                                                                   | the login (sign-up page, password)                                                | by email                                                                                          |
| `accounts`, `users`                                                                                                            | one each, made by the `handle_new_user()` trigger in `waas/027`                   | by the login's id                                                                                 |
| `accounts` (update only)                                                                                                       | the CRM onboarding RPCs update the login's own account row                        | goes with the account                                                                             |
| `tenants`                                                                                                                      | `/get-started` step 1 inserts one; later steps update it                          | `submitted_by_email` = the email typed in step 1                                                  |
| `domain_requests`, `tenant_site_config`, `tenant_site_variants`                                                                | `/get-started` steps 2 to 6 and the site build that follows                       | by the tenant id                                                                                  |
| `notification_log`                                                                                                             | the site build can send an email to the tenant's contact address and logs it      | by tenant id, or recipient = the email                                                            |
| `industry_leads`                                                                                                               | the HVAC lead form, and possibly one more from the chat                           | by `lead_email` = the email. **Filed under the HVAC pool account**, never matched by that account |
| `agent_conversations`                                                                                                          | the website chat. **Filed under the HVAC pool account**                           | by `lead_email` = the email, or by the chat session id                                            |
| Storage `logos`                                                                                                                | `<tenant id>/logo.<ext>` if you upload a logo in `/get-started` step 3            | listed by the preview; removed by hand                                                            |
| `tenant_site_versions`, `tenant_site_deployments`, `tenant_variant_regenerations`, `client_*` tables, storage `client-uploads` | written by the client editor and admin tools, which this flow does not use (READ) | covered by the same tenant-id rule if you do use them                                             |

- READ: no avatar upload and no company, contact or deal creation are in the flow (DEC-0030). No code in this repo uploads an avatar.
- READ: the `/get-started` tables are written through the WaaS variables (`NEXT_PUBLIC_WAAS_SUPABASE_URL`, `WAAS_SUPABASE_SERVICE_ROLE_KEY`), which already point at `rankedceo-waas`. Only sign-up, the dashboard and the CRM onboarding RPCs move with the three CRM variables.
- READ: the lead form and the chat use the admin client and file under the HVAC pool account `00000000-0000-0000-0001-000000000001` unless an `operatorId` is passed. Do not pass one.
- UNVERIFIED: the live body of `handle_user_delete()`. It is not recorded in this repo. Step 2 reads it.
- UNVERIFIED: whether other triggers or policies in the live project write rows this list does not show. The cleanup's scan covers this (see "What the script refuses").

## Rules

1. Use one test login. Never run the cleanup with a real person's email. The script refuses a login older than 3 days, an account with more than one user, and an account not made at that login's sign-up (VERIFIED on a throwaway Postgres). **Those checks alone do not stop a mistyped email.** A real customer who signed up yesterday has one user and an account made at sign-up, so they look exactly like a rehearsal login. In a test on a throwaway Postgres (2026-10-27), the first version of the script, which had a 30-day window and no confirmation, deleted such a customer's account and lead. The protection is that a committed delete must be given the account id that the preview printed (`p_confirm_account`, steps 9 and 10): a mistyped email resolves to a different account, so the ids differ and nothing is deleted.
2. Type the test email in `/get-started` step 1 and in the HVAC lead form exactly. The cleanup keys on it.
3. Do not add `?auditId=` to `/get-started`. That links the tenant to an existing audit row.
4. Do not pass `operatorId` to the lead form.
5. Do not sign up a login while the preview points at `rankedceo-crm-production`.
6. Run the dry run (step 9) before the committing run (step 10). The default of the script is the dry run.
7. Never paste a key, password or token into chat or a ticket. Names and results only.

## Steps

### 1. Record the baseline (`rankedceo-waas`, read-only)

Open <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/sql/new>. Check the project ref in the address bar reads `klgvdvryewykzlumbkei`. Paste and run:

```sql
select
  (select count(*) from public.accounts) as accounts_total,
  (select count(*) from public.accounts
    where id in ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000002',
                 '00000000-0000-0000-0003-000000000003', '00000000-0000-4000-a000-000000000004')) as pool_rows,
  (select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), ''))
    from public.accounts a
    where a.id in ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000002',
                   '00000000-0000-0000-0003-000000000003', '00000000-0000-4000-a000-000000000004')) as pool_md5,
  (select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), ''))
    from public.accounts a
    where a.id not in ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000002',
                       '00000000-0000-0000-0003-000000000003', '00000000-0000-4000-a000-000000000004')) as other_md5;
```

Save the four values (they are not secrets). `pool_rows` must be `4`. If it is not, stop and tell me.

- VERIFIED: on a throwaway Postgres, these values equal the fingerprints the VERIFY mode prints after a committed cleanup.
- ASSUMED: the `accounts` rows of other products in the project do not change while you rehearse. If a real sign-up happens meanwhile, `accounts_total` and `other_md5` will differ for a reason that is not the script; the per-table preview and verify still hold.

### 2. Read the delete-trigger body (`rankedceo-waas`, read-only)

Same SQL editor. Run:

```sql
select pg_get_functiondef('public.handle_user_delete'::regproc);
```

Paste the result to me. It decides whether deleting the login in step 11 is safe.

- READ: the CRM repo copies of this function are different from each other (`supabase/migrations/000003_...` does nothing; `000005_...` updates `is_deleted`, `deleted_at` and `user_count` on `accounts`). The `waas/027` and `waas/030` accounts table has none of those three columns, so if the live body is the second one, deleting the login would fail. Not checked live.

### 3. Point one preview at `rankedceo-waas`

In Vercel, open the CRM project, Settings, Environment Variables. (I do not know your team and project slugs, so there is no direct link.)

- Create a branch for the preview, for example `rehearsal/e3-switch`, from `main`. It needs no code change (E3 plan section 4, READ).
- Add three variables scoped to **Preview** and that branch only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, set to the `rankedceo-waas` values. Get them from Supabase, `rankedceo-waas`, Settings, API Keys: <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/settings/api-keys>. Do not paste them anywhere else.
- Before you save, write down the existing Preview and Production values' project refs (the ref only, from the URL). You need them for step 14.
- Redeploy the branch. `NEXT_PUBLIC_*` values are baked in at build time (READ, E3 plan section 4).
- ASSUMED: Vercel lets a Preview variable be limited to one branch. If it does not, use a Preview-only override and accept that every preview of the project points at `rankedceo-waas` until step 14.
- ASSUMED: the preview URL must be in the Auth redirect list of `rankedceo-waas` for magic link and Google sign-in: <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/url-configuration>. Password sign-up does not need it. If sign-up requires a confirmation email, that link needs it.

### 4. Sign up

On the preview, open `/signup`. Use an address you can read mail at, in the form you will type everywhere else. Choose a password. Sign up, then continue.

- READ: the page runs reCAPTCHA, calls `supabase.auth.signUp`, and sends you to `/onboarding`.
- ASSUMED: the reCAPTCHA key accepts the preview's domain. A failure here is a finding about the preview, not about the cleanup.
- VERIFIED by Tommy on 2026-10-27: **Confirm email is on** in both `rankedceo-waas` and the CRM project. READ: with it on, signing up gives no session, the page sends you to `/onboarding`, and `/onboarding` sends you on to `/login` with no message (`app/(dashboard)/onboarding/page.tsx:15-18`). That is expected, not a failure. Open the confirmation email, click its link (it returns through `/api/auth/callback`, so the redirect list from the dashboard steps must be saved first), and you arrive signed in. If the email does not arrive, or its link goes to the wrong address, stop and tell me; the dashboard steps (email templates and sender) are the place to look. The login's age for the cleanup script counts from sign-up, not from the click.
- READ: the `on_auth_user_created` trigger then makes one `accounts` row (name `My Account`) and one `users` row with `id` = the login's id, with `role` `rep` and `email`, `name` empty.
- Optional: sign in once with a magic link or Google on the same address. If it creates a second login, that second login is not covered by this script. Tell me before cleaning up.

### 5. CRM onboarding

At `/onboarding`, click through every step to the end (company info, team, preferences, complete).

- READ: each step calls an RPC (`update_company_info`, `update_onboarding_step`, `update_preferences`, `complete_onboarding`) that updates the login's own `accounts` row. `waas/031` makes each of them refuse another account.
- Skip the team step's invitations: the code only logs them.

### 6. Website onboarding

Open `/get-started` (no query string). Walk all six steps. In step 1 type the test email in the email field. In step 3, upload a small logo image if you want the storage path exercised.

- READ: step 1 inserts the `tenants` row; steps 2 to 6 write `domain_requests`, `tenant_site_config`, `tenant_site_variants` and start the site build.
- READ: the site build may send an email through Resend or SendGrid to the test address, and logs it in `notification_log`. If you do not want an email, say so before step 3 and I will name the variable to unset on the preview.

### 7. One lead and one chat message

- Open `/hvac/lead` on the preview, fill the form with the test email, submit. You land on `/hvac/lead/success`, which has the chat widget.
- In the chat widget send one message that includes the test email.
- In the browser, open developer tools, Application, Session Storage, copy the value of `agent_session_id`. Keep it.
- ASSUMED: `/hvac/lead` is reachable by path on a `*.vercel.app` preview, because the industry pages are ordinary routes. If the middleware insists on a subdomain, tell me.
- READ: the chat can insert a second `industry_leads` row when it extracts an email or phone. The script matches it only if the email is the test email.

### 8. Run the PREVIEW

Open the SQL editor, paste the whole of `docs/engineering/checks/rehearsal_cleanup.sql`. At the bottom, change `REPLACE-ME@example.com` to the test email and `p_session_ids` to `array['<the agent_session_id value>']`. Leave `p_mode => 'preview'`. Run. The output is one table. Find the row with section `CONFIRM`: its `detail` column holds the **account id** and the account name (`My Account`). Copy that id, and check the name is the one you expect. You will paste it in step 10.

Check:

- `GUARD` rows read `PASS`.
- `PREVIEW` has one row per table. Every table you touched in steps 4 to 7 shows a count. The `TOTAL` row reads `PASS`.
- `BLOCK` reads `PASS`. If any table shows `FAIL`, **stop**: a table the script does not handle holds rows that mention the test login. Send me the output.
- `INFO` rows: the pool-account lead and chat rows that were made since the login but not matched. Open them in the table editor. A real visitor can land there. If one is yours, send me the output.
- `STORAGE` lists the objects to remove in step 12.
- `FINGERPRINT` `pool accounts present and flagged` reads `PASS`, and the two md5 rows equal step 1 `pool_md5` and `other_md5`.
- ASSUMED: the Supabase SQL editor may show a confirmation prompt for a query that contains `delete`. Read it, confirm it names project `klgvdvryewykzlumbkei`, and continue; do this in step 9 and 10 only.
- ASSUMED: the SQL editor runs the file as one session and shows the result of the last statement. The function is created as a temporary object and disappears when the session ends.

### 9. Dry-run the cleanup

Same file. Change `p_mode` to `'delete'`. Leave `p_commit => false`. Run.

- Expected: `DELETE` rows with the same counts as the preview, then `RESULT` = `ROLLED BACK`. Nothing changed.
- VERIFIED (throwaway Postgres): the dry run changes no row in any public table, and the default arguments are a dry run.
- If it raises, read the message. Every raise says `Nothing was changed` or `Rolled back`. Send me the text.

### 10. Run the cleanup for real

Same file. Set `p_commit => true` and set `p_confirm_account => '<the account id from step 8>'` (inside the quotes, nothing else). Run. If the id is missing or belongs to a different account, the script stops with `REFUSED: a committed delete needs p_confirm_account` and changes nothing; the dry run in step 9 does not need the id.

- Expected: `RESULT` = `COMMITTED`, the `DELETE` counts equal the preview, and `pool accounts md5 after` and `other accounts md5 after` read `PASS`.
- VERIFIED (throwaway Postgres): a committed run left every public table identical to its state before the test login existed; a second run deleted zero rows and did not error.

### 11. Delete the login in the dashboard

Open <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/users>, find the test email, delete the user.

- The script does not delete the login by default, because of step 2. If step 2 showed a harmless body, you may instead set `p_delete_auth_user => true` in step 10.
- READ (`supabase/auth` migrations): Supabase deletes the login's `identities`, `sessions`, one-time tokens and MFA rows with it (foreign keys with `ON DELETE CASCADE`). `audit_log_entries` has no foreign key and keeps its rows.
- If the dashboard delete errors, the script's deletions are already committed. Send me the error text. Nothing else breaks.

### 12. Remove the storage objects

Open <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/storage/buckets>. In the buckets named in the preview's `STORAGE` row, open the folder named after the tenant id and delete it.

- VERIFIED: Supabase refuses SQL deletes on storage tables (message "Direct deletion from storage tables is not allowed", from the `supabase/storage` repo), so the script only lists them.
- Leave the buckets themselves.

### 13. Run VERIFY

SQL editor, same file, `p_mode => 'verify'`, same email and session id. Run.

- Expected: `auth.users with this email` = `PASS`; every other `VERIFY` row = `PASS`. (If you skipped step 11, that first row reads `PENDING` and a `public.users row` check appears; both are expected until the login is deleted.) A `REVIEW` row means an older row with the same email exists from before the rehearsal; read its dates. Once the login is gone the script cannot tell the rehearsal's rows from older ones by date, so it shows every row with the email and its dates.
- Expected: the `STORAGE` row = `PASS` (no object whose tenant is gone).
- Expected: `pool accounts md5` equals step 1 `pool_md5`; `all other accounts` md5 equals `other_md5`; `accounts rows in total` equals `accounts_total`.
- Then run the step 1 query again. All four values must equal the saved ones.

### 14. Rollback test

In Vercel, set the three Preview variables of the branch back to the `rankedceo-crm-production` values (the ones you noted in step 3), or delete the three overrides if the CRM values were the inherited ones. Redeploy.

- Check that `/login` loads and an existing CRM login signs in and reaches the dashboard. Do not sign up anyone.
- ASSUMED: password sign-in does not need the preview URL in the CRM project's redirect list. Magic link and Google do.
- Not covered: this rehearses rollback of the preview, not of Production (DEC-0029).

### 15. Record the result

Tell me, in plain words: which steps passed, any `FAIL`, `BLOCK`, `REVIEW` or `MANUAL` row, the `handle_user_delete()` body, and the Auth settings you found (confirm email, redirect list). I record them in the E3 plan.

## What the script does and does not do

Script: `docs/engineering/checks/rehearsal_cleanup.sql`.

**It refuses (raises, nothing changes):** a placeholder or empty email; an email with no auth user (preview and delete); a login older than 3 days; a committed delete when no account resolves for the login at all (for example the sign-up trigger made no `users` row), because there is then no id to confirm and it fails closed; a committed delete whose `p_confirm_account` is missing or is not the account the email resolves to; a login whose account is one of the four pool accounts or flagged `is_pool_account`; an account with more than one user; an account not made when the login was. It also refuses to delete when a table it does not handle holds a row that mentions the test login, account, tenant or email, or when more than 200 rows would go. After the deletes it rolls the whole run back if a per-table count differs from the preview, a matching row is left, the pool accounts or any other account row changed, or the total row count of all public tables fell by anything other than the previewed total.

- VERIFIED (throwaway Postgres, PGlite, schema from the real `waas/027`, `029`, `030`): each of those refusals fired, and a hostile trigger that deleted an unlisted row, edited a pool account, or edited an ordinary account was caught and rolled back. Each deliberate break I made to the script (removing the pool guard, widening the lead delete to the pool account, removing the scan, removing each post-delete check, ignoring the dry run) made at least one test fail.
- VERIFIED: the HVAC pool account's own leads (visitors) and chats survived, including a lead made after the login by someone else, and an earlier lead that used the same email.
- READ: the test schema was built from the repo migrations, not from the live project. The live project may carry tables, triggers or policies the repo does not show. The scan and the total-row check exist for that, and the first live run is the preview.
- VERIFIED (2026-10-27, independent re-test on a throwaway Postgres, PGlite, with the real `waas/000a` to `030` migrations): the first version of the script had a 30-day age window and no confirmation. It deleted the account and the lead of a real customer who had signed up 5 days earlier, because that customer has one user and an account made at sign-up, exactly like a rehearsal login, and the preview showed only counts. The script now uses a 3-day window and requires `p_confirm_account` (the account id the preview prints) for a committed delete. Checked: a customer who signed up 1 day ago (inside the window) is refused without the id, refused with another account's id, and untouched by a dry run; a genuine rehearsal login is deleted with the right id; removing the confirmation check, widening the window, loosening the id check, or removing the pool guard each made the matching test fail. The tests are not kept in the repo (no PGlite harness exists here); the first live run is still a read-only preview.

**It cannot:** delete storage objects, delete rows in `auth.*` other than the login (and only when asked), or find a pool-account lead or chat that carries a different email or none and no session id. Those are listed under `INFO` for you to read.

- ASSUMED: PostgreSQL features used (`pg_temp` function, `query_to_xml`, `xpath`, `RAISE` with SQLSTATE) behave on the project's Postgres version as they did on the throwaway one (PostgreSQL 18). Run the preview first; a syntax error shows at once and changes nothing.
