# Audit + Customer/Admin WaaS Creation Walkthrough

Use this when you need the full completion path:
Audit -> Customer WaaS creation -> Customer portal -> Admin WaaS review/deploy.

## What You Need
- Base URL: ____________________
- Audit ID: ____________________
- Review Token: ____________________
- Tenant ID: ____________________
- Tester Name: ____________________
- Date: ____________________
- Browser/Device: ____________________

## 1) Audit Creation

### Open the audit funnel
- Go to `<BASE_URL>/audit/start`
- If prompted to log in, complete login and return to the page.

### Complete the audit
1. Enter a valid website URL.
2. Add at least one competitor URL if the form asks for it.
3. Submit the audit.
4. Wait for the result page to load.

### Confirm the audit output
- Open `<BASE_URL>/audit/<AUDIT_ID>` and confirm the summary is readable.
- Open `<BASE_URL>/api/audit/<AUDIT_ID>/pdf` and confirm the PDF downloads or opens cleanly.

Pass if:
- The audit starts successfully.
- The result page loads.
- The PDF is branded and readable.

## 2) Customer WaaS Creation

### Open customer onboarding
- Go to `<BASE_URL>/get-started?auditId=<AUDIT_ID>`
- If the audit already finished, use the link from the audit result page.

### Complete the customer setup steps
1. Business step: enter business name, address, contact, and trade.
2. Domains step: add one or more domain preferences.
3. Brand step: add logo and brand colors if available.
4. Template step: review the suggested template and continue.
5. Integrations step: complete the final setup form and submit.

### Confirm customer success
- The success screen should show the business name and a review token link.
- Open `<BASE_URL>/edit/<REVIEW_TOKEN>` to confirm the customer portal opens.

### Customer portal checks
- Open `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=overview` and confirm the overview reads clearly.
- Open `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=edit` and confirm the editor loads.
- Open `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=history` and confirm history is available.
- Open `<BASE_URL>/edit/<REVIEW_TOKEN>?tab=billing` and confirm the billing tab loads.
- Open `<BASE_URL>/edit/<REVIEW_TOKEN>/preview` and confirm the preview renders.

Pass if:
- The onboarding flow reaches success.
- The review token opens the customer portal.
- The overview, edit, history, billing, and preview views all load.

## 3) Admin WaaS Review and Creation Check

### Open the command center
- Go to `<BASE_URL>/admin/dashboard`
- Confirm the pending and active tenant tables load.

### Open the tenant detail page
- From the pending or active list, open the tenant detail link.
- Or go directly to `<BASE_URL>/admin/dashboard/<TENANT_ID>`.

### Confirm admin creation/review fields
1. Brand Sheet shows logo, colors, and business name.
2. Domain Requests shows saved domain data.
3. Original Audit shows the linked audit summary.
4. Client Review Status shows the review token state.
5. Deployment Package shows readiness status and section counts.

### Validate admin action paths
- Open the Live Preview tab and confirm the site preview loads.
- Open the AI Variants tab and confirm variant data appears.
- If the tenant is pending/onboarding, confirm the Deploy Site button is present.

Pass if:
- Admin dashboard loads.
- Tenant detail loads.
- Review/deploy controls are visible and readable.

## 4) Final Completion Rule

The walkthrough is complete when all three tracks are true:
1. Audit starts, finishes, and shows a readable PDF.
2. Customer onboarding finishes and the customer portal opens.
3. Admin dashboard and tenant detail show a complete WaaS record with review/deploy actions.

## 5) Defect Notes
- Route:
- Expected:
- Actual:
- Screenshot or recording:
