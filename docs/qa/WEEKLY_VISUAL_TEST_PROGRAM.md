# Weekly Visual Test Program

Use this script for a non-technical visual pass of Audit + WaaS.

If you need the full end-to-end completion path, use [WAAS_AUDIT_CUSTOMER_ADMIN_WALKTHROUGH.md](WAAS_AUDIT_CUSTOMER_ADMIN_WALKTHROUGH.md).

## Fill In Before You Start

- Base URL: ____________________
- Review Token: ____________________
- Audit ID: ____________________
- Tester Name: ____________________
- Date: ____________________
- Browser/Device: ____________________

## Direct Entry Links

- Login: <BASE_URL>/login
- Admin Dashboard: <BASE_URL>/admin/dashboard
- Audit Start: <BASE_URL>/audit/start
- Audit Result: <BASE_URL>/audit/<AUDIT_ID>
- Audit PDF: <BASE_URL>/api/audit/<AUDIT_ID>/pdf
- Client Review: <BASE_URL>/review/<REVIEW_TOKEN>
- Client Edit Tab: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit
- Client Approval Deep Link: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit&approve=1
- Client Preview: <BASE_URL>/edit/<REVIEW_TOKEN>/preview
- Domain Requests: <BASE_URL>/admin/dashboard/domain-requests
- Redirect checks:
  - <BASE_URL>/waas
  - <BASE_URL>/waas/tenants
  - <BASE_URL>/waas/audits

## 25-Minute Weekly Script

1. Open Login and sign in.
2. Open Admin Dashboard and confirm queue/table loads.
3. Open Audit Start and submit one valid URL.
4. Open Audit Result (or wait for a completed audit) and confirm grade plus sections are readable.
5. Open Audit PDF and confirm it downloads/opens with clean branding.
6. Open Client Review and confirm page copy is understandable.
7. Open Client Edit Tab and confirm editor content loads.
8. Open Client Approval Deep Link and confirm approval panel/modal appears.
9. Open Client Preview and confirm page renders on desktop and mobile widths.
10. Open Domain Requests and confirm page loads without layout breaks.
11. Open the 3 redirect URLs and confirm each lands on Admin Dashboard.

## Visual Scorecard

Mark each item: Pass, Minor Issue, Fail, or N/A.

| Area                        | Link Used                               | Result | Notes |
| --------------------------- | --------------------------------------- | ------ | ----- |
| Login and session           | /login                                  |        |       |
| Admin dashboard readability | /admin/dashboard                        |        |       |
| Audit start clarity         | /audit/start                            |        |       |
| Audit result readability    | /audit/<AUDIT_ID>                       |        |       |
| PDF quality and branding    | /api/audit/<AUDIT_ID>/pdf               |        |       |
| Client review clarity       | /review/<REVIEW_TOKEN>                  |        |       |
| Editor usability            | /edit/<REVIEW_TOKEN>?tab=edit           |        |       |
| Approval UX clarity         | /edit/<REVIEW_TOKEN>?tab=edit&approve=1 |        |       |
| Preview visual quality      | /edit/<REVIEW_TOKEN>/preview            |        |       |
| Admin domain requests       | /admin/dashboard/domain-requests        |        |       |
| Redirect behavior           | /waas, /waas/tenants, /waas/audits      |        |       |

## Pass Rule

- Pass: No Fail rows and no more than 2 Minor Issue rows.
- Needs Follow-up: Any Fail, or 3+ Minor Issue rows.

## Defect Capture

- Link/route:
- Expected:
- Actual:
- Screenshot or video:

---

# Client-Safe UAT Program (External Testers)

Use this version for client/external users. No admin-only pages.

For the full completion path, start with [WAAS_AUDIT_CUSTOMER_ADMIN_WALKTHROUGH.md](WAAS_AUDIT_CUSTOMER_ADMIN_WALKTHROUGH.md).

## Fill In Before You Start

- Base URL: ____________________
- Review Token: ____________________
- Audit ID: ____________________

## Client-Safe Entry Links

- Login: <BASE_URL>/login
- Audit Start: <BASE_URL>/audit/start
- Audit Result: <BASE_URL>/audit/<AUDIT_ID>
- Audit PDF: <BASE_URL>/api/audit/<AUDIT_ID>/pdf
- Client Review: <BASE_URL>/review/<REVIEW_TOKEN>
- Client Edit Tab: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit
- Client Approval Deep Link: <BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit&approve=1
- Client Preview: <BASE_URL>/edit/<REVIEW_TOKEN>/preview

## 15-Minute Client UAT Script

1. Open Login and sign in.
2. Open Audit Start and confirm instructions are easy to understand.
3. Submit one audit and wait for completion.
4. Open Audit Result and confirm key sections are readable.
5. Open Audit PDF and confirm it opens/downloads cleanly.
6. Open Client Review and confirm the page is understandable.
7. Open Client Edit Tab and confirm editor content appears.
8. Open Client Approval Deep Link and confirm approval prompt appears.
9. Open Client Preview and check mobile and desktop readability.

## Client UAT Scorecard

Mark each item: Pass, Minor Issue, Fail, or N/A.

| Area                     | Link Used                               | Result | Notes |
| ------------------------ | --------------------------------------- | ------ | ----- |
| Login and session        | /login                                  |        |       |
| Audit start clarity      | /audit/start                            |        |       |
| Audit result readability | /audit/<AUDIT_ID>                       |        |       |
| PDF quality and branding | /api/audit/<AUDIT_ID>/pdf               |        |       |
| Client review clarity    | /review/<REVIEW_TOKEN>                  |        |       |
| Editor usability         | /edit/<REVIEW_TOKEN>?tab=edit           |        |       |
| Approval UX clarity      | /edit/<REVIEW_TOKEN>?tab=edit&approve=1 |        |       |
| Preview visual quality   | /edit/<REVIEW_TOKEN>/preview            |        |       |

## Client UAT Pass Rule

- Pass: No Fail rows and no more than 2 Minor Issue rows.
- Needs Follow-up: Any Fail, or 3+ Minor Issue rows.
