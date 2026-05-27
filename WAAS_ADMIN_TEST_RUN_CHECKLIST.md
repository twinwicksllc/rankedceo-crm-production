# WaaS Admin Test Run Checklist

Use this for each fresh end-to-end test run across audit -> onboarding -> command center -> review -> deploy.

Standalone companion docs:
- docs/qa/WEEKLY_VISUAL_TEST_PROGRAM.md
- docs/qa/TESTER_INVITE_TEMPLATES.md

## One-Page Weekly Visual Script (Non-Technical)

Run this quick script first. It is designed for non-technical testers to click through core pages and confirm visual quality.

### Fill In Before You Start
- Base URL: ____________________
- Review Token: ____________________
- Audit ID: ____________________

### Direct Entry Links
- Login: `<BASE_URL>/login`
- Admin Dashboard: `<BASE_URL>/admin/dashboard`
- Audit Start: `<BASE_URL>/audit/start`
- Audit Result: `<BASE_URL>/audit/<AUDIT_ID>`
- Audit PDF: `<BASE_URL>/api/audit/<AUDIT_ID>/pdf`
- Client Review: `<BASE_URL>/review/<REVIEW_TOKEN>`
- Client Edit Tab: `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit`
- Client Approval Deep Link: `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit&approve=1`
- Client Preview: `<BASE_URL>/edit/<REVIEW_TOKEN>/preview`
- Domain Requests: `<BASE_URL>/admin/dashboard/domain-requests`
- Redirect checks:
	- `<BASE_URL>/waas`
	- `<BASE_URL>/waas/tenants`
	- `<BASE_URL>/waas/audits`

### 25-Minute Weekly Script
1. Open Login and sign in.
2. Open Admin Dashboard and confirm queue/table loads.
3. Open Audit Start and submit one valid URL.
4. Open Audit Result (or wait for a completed audit) and confirm grade + sections are readable.
5. Open Audit PDF and confirm it downloads/opens with clean branding.
6. Open Client Review and confirm the page is understandable.
7. Open Client Edit Tab and confirm editor content loads.
8. Open Client Approval Deep Link and confirm approval panel/modal appears.
9. Open Client Preview and confirm page renders on desktop and mobile widths.
10. Open Domain Requests and confirm page loads without layout breaks.
11. Open the 3 redirect URLs and confirm each lands on Admin Dashboard.

### Simple Visual Scorecard

Mark each item: `Pass`, `Minor Issue`, `Fail`, or `N/A`.

| Area | Link Used | Result | Notes |
|---|---|---|---|
| Login and session | /login |  |  |
| Admin dashboard readability | /admin/dashboard |  |  |
| Audit start clarity | /audit/start |  |  |
| Audit result readability | /audit/<AUDIT_ID> |  |  |
| PDF quality and branding | /api/audit/<AUDIT_ID>/pdf |  |  |
| Client review clarity | /review/<REVIEW_TOKEN> |  |  |
| Editor usability | /edit/<REVIEW_TOKEN>?tab=edit |  |  |
| Approval UX clarity | /edit/<REVIEW_TOKEN>?tab=edit&approve=1 |  |  |
| Preview visual quality | /edit/<REVIEW_TOKEN>/preview |  |  |
| Admin domain requests | /admin/dashboard/domain-requests |  |  |
| Redirect behavior | /waas, /waas/tenants, /waas/audits |  |  |

### Weekly Pass Rule
- Pass: No `Fail` rows and no more than 2 `Minor Issue` rows.
- Needs Follow-up: Any `Fail`, or 3+ `Minor Issue` rows.

### Defect Capture (If Anything Looks Wrong)
- What link were you on?
- What did you expect to see?
- What actually happened?
- Attach screenshot or screen recording.

## Client-Safe UAT Mode (External Testers)

Use this version when sharing testing with non-admin users or clients. It avoids admin-only pages.

### Fill In Before You Start
- Base URL: ____________________
- Review Token: ____________________
- Audit ID: ____________________

### Client-Safe Entry Links
- Login: `<BASE_URL>/login`
- Audit Start: `<BASE_URL>/audit/start`
- Audit Result: `<BASE_URL>/audit/<AUDIT_ID>`
- Audit PDF: `<BASE_URL>/api/audit/<AUDIT_ID>/pdf`
- Client Review: `<BASE_URL>/review/<REVIEW_TOKEN>`
- Client Edit Tab: `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit`
- Client Approval Deep Link: `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit&approve=1`
- Client Preview: `<BASE_URL>/edit/<REVIEW_TOKEN>/preview`

### 15-Minute Client UAT Script
1. Open Login and sign in.
2. Open Audit Start and confirm instructions are easy to understand.
3. Submit one audit and wait for completion.
4. Open Audit Result and confirm key sections are readable.
5. Open Audit PDF and confirm it opens/downloads cleanly.
6. Open Client Review and confirm the page is understandable.
7. Open Client Edit Tab and confirm editor content appears.
8. Open Client Approval Deep Link and confirm approval prompt appears.
9. Open Client Preview and check mobile + desktop readability.

### Client UAT Scorecard

Mark each item: `Pass`, `Minor Issue`, `Fail`, or `N/A`.

| Area | Link Used | Result | Notes |
|---|---|---|---|
| Login and session | /login |  |  |
| Audit start clarity | /audit/start |  |  |
| Audit result readability | /audit/<AUDIT_ID> |  |  |
| PDF quality and branding | /api/audit/<AUDIT_ID>/pdf |  |  |
| Client review clarity | /review/<REVIEW_TOKEN> |  |  |
| Editor usability | /edit/<REVIEW_TOKEN>?tab=edit |  |  |
| Approval UX clarity | /edit/<REVIEW_TOKEN>?tab=edit&approve=1 |  |  |
| Preview visual quality | /edit/<REVIEW_TOKEN>/preview |  |  |

### Client UAT Pass Rule
- Pass: No `Fail` rows and no more than 2 `Minor Issue` rows.
- Needs Follow-up: Any `Fail`, or 3+ `Minor Issue` rows.

### Copy/Paste Invite Message (External Testers)

Subject: Quick Website Experience Test (15 minutes)

Hi <TESTER_NAME>,

Please run a short visual test and share any confusing or broken screens.

Use these links:
- Login: <BASE_URL>/login
- Audit Start: <BASE_URL>/audit/start
- Audit Result: <BASE_URL>/audit/<AUDIT_ID>
- Audit PDF: <BASE_URL>/api/audit/<AUDIT_ID>/pdf
- Client Review: <BASE_URL>/review/<REVIEW_TOKEN>
- Client Edit: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit
- Approval Screen: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit&approve=1
- Client Preview: <BASE_URL>/edit/<REVIEW_TOKEN>/preview

What to do:
1. Sign in.
2. Click each link in order.
3. Confirm each page is clear, readable, and easy to use on desktop and mobile.
4. If anything looks off, send:
	- The link you were on
	- What you expected
	- What happened
	- A screenshot

Result choices for each page: Pass, Minor Issue, or Fail.

Thanks.

### Copy/Paste Invite Message (Internal Staff)

Subject: Weekly Audit + WaaS Visual QA Run (25 minutes)

Hi team,

Please complete this week's visual QA pass for Audit + WaaS.

Run links:
- Login: <BASE_URL>/login
- Admin Dashboard: <BASE_URL>/admin/dashboard
- Audit Start: <BASE_URL>/audit/start
- Audit Result: <BASE_URL>/audit/<AUDIT_ID>
- Audit PDF: <BASE_URL>/api/audit/<AUDIT_ID>/pdf
- Client Review: <BASE_URL>/review/<REVIEW_TOKEN>
- Client Edit: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit
- Approval Screen: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit&approve=1
- Client Preview: <BASE_URL>/edit/<REVIEW_TOKEN>/preview
- Domain Requests: <BASE_URL>/admin/dashboard/domain-requests
- Redirect checks: <BASE_URL>/waas, <BASE_URL>/waas/tenants, <BASE_URL>/waas/audits

What to do:
1. Open links in order and verify each page loads correctly.
2. Confirm key UI elements are readable and actions are clear.
3. Check desktop and mobile viewport rendering for review/edit/preview pages.
4. Log results per page as Pass, Minor Issue, or Fail.
5. Report any issue with route, expected result, actual result, and screenshot.

Pass rule:
- No Fail rows and no more than 2 Minor Issue rows.

Thanks.

## Run Metadata
- Test ID:
- Date:
- Tester:
- Environment: Production / Preview / Local
- Browser/Profile:
- Commit/Deploy Reference:

## Pre-Run Setup
- [ ] Hard refresh app and confirm latest deploy is live.
- [ ] Archive old test tenants in Command Center.
- [ ] Prepare a unique identity set:
Business name variant, email alias, and location.
- [ ] Confirm expected entry point URL.

## 1) Audit Funnel
- [ ] Submit audit start form with valid target URL.
- [ ] Include at least one competitor URL.
- [ ] Confirm audit result page loads successfully.
- [ ] Click Get Started CTA.
- [ ] Confirm onboarding URL includes audit context:
Accept either `auditId` or `audit_id` query parameter.

Pass/Fail:
Notes:

## 2) Onboarding Flow
### Step 1: Business Identity
- [ ] Save succeeds and advances.

### Step 2: Domain Wishlist
- [ ] Add domains.
- [ ] Save succeeds and advances.

### Step 3: Brand Identity
- [ ] Upload/select logo and colors.
- [ ] Save succeeds and advances.

### Step 4: Integrations/USP
- [ ] Submit succeeds.
- [ ] Completion screen appears.

Pass/Fail:
Notes:

## 3) Command Center Queue Integrity
- [ ] New tenant appears in pending/onboarding queue.
- [ ] Stat cards match visible table rows.
- [ ] Row includes working Review and Client Link.
- [ ] Archive removes row from queue.
- [ ] Archived Recently panel shows item.
- [ ] Undo restore returns item to queue.
- [ ] Archive Older Duplicates keeps newest and archives older retries.

Pass/Fail:
Notes:

## 4) Tenant Detail Page
- [ ] Brand Sheet populated.
- [ ] Domain Requests populated.
Fallback accepted when imported from onboarding wishlist.
- [ ] Original Audit card populated.
Fallback by submitter email accepted when source_audit_id is missing.
- [ ] Site Settings save works:
Meta title, meta description, OG image URL, custom CSS.
- [ ] Deployment Package readiness block renders checks.

Pass/Fail:
Notes:

## 5) Review Page
- [ ] Review page loads for tenant token/id.
- [ ] Variant previews render.
- [ ] Select variant saves.
- [ ] Mix direction save works.
- [ ] Regenerate selected direction works.
- [ ] Version history updates in review and tenant detail.

Pass/Fail:
Notes:

## 6) Deploy Path
- [ ] Deploy button appears in expected statuses.
- [ ] Blockers are explicit when not ready.
- [ ] After resolving blockers, deploy succeeds.
- [ ] Tenant moves to Active Sites and appears in active table.

Pass/Fail:
Notes:

## 7) Regression Checks
- [ ] /waas redirects to /admin/dashboard.
- [ ] /waas/tenants redirects to /admin/dashboard.
- [ ] /waas/audits redirects to /admin/dashboard.
- [ ] Website Builder nav item is visible in CRM navigation.
- [ ] No tenant queue load warning appears in command center.

Pass/Fail:
Notes:

## Defect Log
1. ID:
Severity:
Route:
Repro Steps:
Expected:
Actual:
Screenshot/Video:

2. ID:
Severity:
Route:
Repro Steps:
Expected:
Actual:
Screenshot/Video:

## Overall Result
- Overall: Pass / Fail
- Blocking defects count:
- Non-blocking defects count:
- Ready for real client submissions: Yes / No
