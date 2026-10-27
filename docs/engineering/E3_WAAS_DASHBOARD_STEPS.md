# E3 steps: set up the rankedceo-waas dashboard

Status: DRAFT for Tommy. Nothing here has been done. It follows the settings list in `E3_CLIENT_SWITCH_PLAN.md` section 3 and DEC-0029 (the rehearsal runs from a Vercel preview).

Labels: **READ** = taken from the code. **VERIFIED** = checked by a command or query. **ASSUMED** = not checked; check it when you reach that step.

Two projects appear below. Name the one you are in before every change:

- **WaaS** = `rankedceo-waas`, ref `klgvdvryewykzlumbkei`. This is the project you change.
- **CRM** = `rankedceo-crm-production`, ref `wcednzaxmxwfiijzmjmx`. This is the project you only look at, to copy settings from. Change nothing in it.

Never paste a key, secret, password or token into chat. Tell me names and yes or no.

## How to work through this

Do the steps in order. Each step says what to do, then what to tell me. A step takes a few minutes. You can stop between steps and nothing is half-done, because each setting stands on its own. The rehearsal (DEC-0029) signs up with a password, so it needs steps 1, 2, 3 and 6. Step 4 (Google) is needed only if you also test Google sign-in on the preview (step 7, point 2). Step 5 is one check and can be done any time. Before the real switch, do all of them.

## Step 1. Site URL and redirect URLs (WaaS)

**Why.** Sign-in emails and Google sign-in send the person back to the app. Supabase only allows addresses on a list. The list lives in each project, and WaaS has the wrong or empty one. READ: the sign-in pages build the return address from whatever host the person is on, so every host needs an entry.

**The addresses the code uses (READ):**

| Where sign-in starts                                            | Return address the app asks for                                                                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm.rankedceo.com`, `rankedceo.com`, `www.rankedceo.com`       | `https://<that host>/api/auth/callback?next=...`                                                                                                         |
| `audit.rankedceo.com`                                           | `https://audit.rankedceo.com/audit/auth/confirm?next=...` and, for forgot-password, `https://audit.rankedceo.com/api/auth/callback?next=/reset-password` |
| `smile.`, `hvac.`, `plumbing.`, `electrical.` + `rankedceo.com` | `https://<that host>/` (just the front page)                                                                                                             |
| `qa.rankedceo.com`                                              | `https://qa.rankedceo.com/api/auth/callback?next=...`                                                                                                    |
| a Vercel preview, for the rehearsal (added in step 7, not here) | `https://<preview address>.vercel.app/api/auth/callback?next=...`                                                                                        |

Tenant websites such as `client-a.rankedceo.com` have no sign-in, so they need no entry (READ: `grep signIn app/_sites` found nothing).

**Do this.**

1. Open <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/url-configuration>. Check the project ref in the address bar reads `klgvdvryewykzlumbkei`.
2. Set **Site URL** to `https://crm.rankedceo.com`. (READ: `vercel.json` sets `NEXT_PUBLIC_APP_URL` to this.)
3. Under **Redirect URLs**, add these, one per line:
   - `https://*.rankedceo.com/**`
   - `https://rankedceo.com/**`
4. Save.

Do **not** add a `vercel.app` wildcard. Supabase sends the sign-in code to whatever address is on this list, and `https://*.vercel.app/**` would let anyone's Vercel app receive it. The rehearsal preview gets its own single, exact entry in step 7.

**Why a wildcard.** One `https://*.rankedceo.com/**` line covers `crm.`, `audit.`, `qa.` and the four industry hosts, and it is the shortest list to keep right. The cost is that any `rankedceo.com` subdomain can receive a sign-in. If you prefer a strict list, add one line per host from the table instead. Your call.

**Do not copy the old deploy guide.** `docs/deployment/DEPLOYMENT_GUIDE.md` lists `https://crm.rankedceo.com/auth/callback`. The code uses `/api/auth/callback`, so that guide is out of line with the code.

**Tell me:** done, and whether you used the wildcard or the strict list.

ASSUMED: whether Supabase matches an address with a `?next=...` query against an entry ending in `/**`. Step 7 tests it.

## Step 2. Email confirmation, password rules (WaaS, compare with CRM)

**Why.** The sign-up page has no "check your email" screen: after sign-up it always goes to `/onboarding` (READ: `app/(auth)/signup/page.tsx:72-75`). With **Confirm email** on, a new person has no session until they click the link in the email, so `/onboarding` sends them to `/login` (READ: `app/(dashboard)/onboarding/page.tsx:15-18`) and they get no on-screen hint. That is how the CRM project works today. VERIFIED by Tommy on 2026-10-27: **Confirm email is on in both projects**, and the minimum password length is 8 in both. The repo cannot tell us the CRM setting, so look at it. In the current Supabase dashboard, **Confirm email** is a switch in the **User Signups** section at the top of the Providers page, above the provider list, not inside the Email panel.

**Do this.**

1. Open the **CRM** project: <https://supabase.com/dashboard/project/wcednzaxmxwfiijzmjmx/auth/providers>. Look only. Scroll to the top: is **Confirm email** (User Signups section) on or off? Then click **Email** and write down **Minimum password length**, **Password requirements** and **Prevent use of leaked passwords**.
2. Open the **WaaS** project: <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/providers>. Make **Confirm email** (User Signups section, top of the page) match the CRM project. Then click **Email** and make **Minimum password length**, **Password requirements** and **Prevent use of leaked passwords** match too.
3. Save.

**Tell me:** the two values you saw in the CRM project, and whether WaaS now matches.

READ: the app requires at least 8 characters on four sign-up pages and the reset page, and checks nothing on the main `/signup` page. A server minimum below 8 would let that page accept weak passwords.

## Step 3. Email templates and sender (WaaS, compare with CRM)

**Why.** Sign-up, magic-link and password-reset emails use templates and a sender stored in each project. The repo has no copy of them (READ: no `supabase/config.toml`, no templates). If WaaS still has Supabase's default, people get a generic email from a Supabase address.

**Do this.**

1. Open the **CRM** project templates: <https://supabase.com/dashboard/project/wcednzaxmxwfiijzmjmx/auth/templates>. Look only. Open **Confirm signup**, **Magic Link** and **Reset Password**. Note whether the text was customised.
2. Open <https://supabase.com/dashboard/project/wcednzaxmxwfiijzmjmx/auth/smtp>. Note whether **Enable custom SMTP** is on, and the **Sender email**. Do not copy the password.
3. Open the **WaaS** project: <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/templates>. Make the three templates match the CRM ones (copy and paste the text).
4. Open <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/smtp>. If the CRM project uses custom SMTP, turn it on here with the same sender, and re-enter the SMTP password from wherever you keep it. Tell me if you cannot find it.

**Tell me:** whether the templates were customised, and whether custom SMTP is on in the CRM project. Never the password.

READ: a different set of emails (the ones the app sends itself, such as site-ready notices) goes through Resend or SendGrid using Vercel variables, not through this page.

## Step 4. Google sign-in (WaaS, compare with CRM)

**Why.** Two pages offer "Sign in with Google": the CRM login and the audit login (READ). Google must be enabled in WaaS with the same Google app, and Google must be told the WaaS project's return address.

**Do this.**

1. Open the **CRM** project: <https://supabase.com/dashboard/project/wcednzaxmxwfiijzmjmx/auth/providers>. Click **Google**. Note: is it on? Does **Skip nonce check** show on? The **Client ID** is shown. Keep this tab open.
2. Open the **WaaS** project: <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/providers>. Click **Google**. Turn it on. Copy the **Client ID** from the CRM tab into the field. Do the same for **Client Secret**: copy it from your password manager or from the Google Cloud console, not from chat. Match **Skip nonce check** to the CRM project. Save.
3. On the same WaaS Google panel, copy the **Callback URL (for OAuth)**. It looks like `https://klgvdvryewykzlumbkei.supabase.co/auth/v1/callback`.
4. Open the Google Cloud console for the Google app this client belongs to (APIs and Services, then Credentials, then the OAuth client). Under **Authorized redirect URIs**, add the WaaS callback URL from step 3. Keep the CRM one, so rollback still works. Save.

**Tell me:** done, and whether the Google panel in WaaS shows enabled.

ASSUMED: the callback address format above is how Supabase OAuth works in general; the WaaS panel in point 3 above shows the exact one, so use that.

## Step 5. Storage (WaaS)

**Nothing to copy by hand.** READ and VERIFIED by `grep .storage`: the code uses only two buckets, `logos` and `client-uploads`. Both go through the WaaS service-role key and are created by the code when missing, so no bucket needs to be made. `avatars` and `listing-images` are not used by any code, and no avatar upload exists.

**Do this (one check).**

1. Open <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/storage/buckets>.
2. Confirm `logos` is listed and marked **Public**.

**Tell me:** whether `logos` is there and public. If it is missing, say so; the code will create it on the first logo upload.

## Step 6. Admin access (Vercel, not Supabase)

**Why.** The `/admin` area lets in anyone on the `WAAS_ADMIN_EMAILS` list. READ: new sign-ups get the role `rep`, so the list is the only way in. The rehearsal preview needs the variable too.

**Do this.**

1. In Vercel, open the project `ranked-ceo-crm`, then **Settings**, then **Environment Variables**.
2. Find `WAAS_ADMIN_EMAILS`. Check it is enabled for **Preview** as well as **Production**. (You confirmed it is set for Production.)

**Tell me:** whether Preview is ticked. Never the value.

## Step 7. Test it (WaaS, after steps 1 to 4)

This proves the settings work, before the rehearsal depends on them. It uses the Vercel preview from the rehearsal plan (`E3_REHEARSAL_PLAN.md`, step 3), so do it as part of that, not before.

**First, allow that one preview address, and only it.**

1. Copy the preview's exact address from Vercel (for example `https://ranked-ceo-xxxx-tom-fenwicks-projects.vercel.app`). Check it is the preview you created for this rehearsal.
2. Open <https://supabase.com/dashboard/project/klgvdvryewykzlumbkei/auth/url-configuration> (project ref `klgvdvryewykzlumbkei`). Under **Redirect URLs**, add exactly that address followed by `/**`. Save.
3. When the rehearsal is finished (rollback test done), come back here and **delete that line**.

**Then test.**

1. On the preview address, open `/login` and request a **magic link** for a new test email. The email should arrive from the sender you set in step 3, and the link should return to the preview address. If it opens a Supabase error saying the redirect is not allowed, step 1 is missing an entry. Tell me the address in the error bar.
2. Click **Sign in with Google**. It should return to the preview address. If Google says `redirect_uri_mismatch`, step 4 point 4 is missing the WaaS callback address.

**Tell me:** which of the two worked.

## What I cannot check for you

- The current Site URL, redirect list, Google app, email templates, SMTP and password rules in the **CRM** project. They are not in the repo. Steps 2 to 4 have you read them.
- Whether Supabase accepts a return address with a `?next=...` query against a `/**` entry. Step 7 tests it.
- Whether the CRM project had Supabase's own CAPTCHA on. The app checks reCAPTCHA itself before sign-up (READ), so this matters only if you turned the Supabase one on.
- Whether a rehearsal preview address is accepted by the reCAPTCHA key. The rehearsal plan lists this as ASSUMED.
