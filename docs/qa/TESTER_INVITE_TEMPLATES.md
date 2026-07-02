# Tester Invite Templates

Use these copy/paste templates to invite testers.

For the full audit -> customer WaaS -> admin WaaS completion path, use [WAAS_AUDIT_CUSTOMER_ADMIN_WALKTHROUGH.md](WAAS_AUDIT_CUSTOMER_ADMIN_WALKTHROUGH.md).

## External Tester Invite (Client-Safe)

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

## Internal Staff Invite (Full Weekly Visual Pass)

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
