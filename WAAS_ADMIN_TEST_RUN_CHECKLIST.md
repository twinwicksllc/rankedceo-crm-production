# WaaS Admin Test Run Checklist

Use this for each fresh end-to-end test run across audit -> onboarding -> command center -> review -> deploy.

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
