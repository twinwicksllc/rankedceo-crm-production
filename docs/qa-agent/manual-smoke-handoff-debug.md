# Manual Smoke Debug Playbook: Admin Login Loop After Handoff (Production)

## Purpose

Use this runbook to reproduce and isolate the smoke failure where admin steps time out because the browser is stuck on:

https://crm.rankedceo.com/login?next=/admin/dashboard&adminOnly=1

This guide is intentionally step-by-step and mirrors the smoke scenario flow around:
- admin_assert_dashboard
- admin_navigate_dashboard_explicit
- handoff_client_to_admin
- admin_navigate_back_to_dashboard

## What You Need

1. Production CRM host (used throughout this guide):
   - https://crm.rankedceo.com
2. QA admin credentials:
   - QA_ADMIN_EMAIL
   - QA_ADMIN_PASSWORD
3. QA client token:
   - QA_CLIENT_REVIEW_TOKEN
4. Chrome or Edge with DevTools
5. A notes doc to record results for each step

## Test Data Template (Fill Before Starting)

- CRM URL: https://crm.rankedceo.com
- Admin email: ______________________________
- Client review token: ______________________
- Test date/time (UTC): _____________________
- Tester name: ______________________________

## Ground Rules

1. Use one fresh browser profile or Incognito window.
2. Keep DevTools open on every critical step.
3. Do not refresh unexpectedly between steps unless the step says to.
4. Record both URL and storage/cookie state at each checkpoint.

---

## Part A: Baseline Admin Login Health

### Step 1
Open a fresh Incognito window.

Expected:
- No pre-existing session cookies for rankedceo domains.

### Step 2
Go to:

https://crm.rankedceo.com/login?next=/admin/dashboard&adminOnly=1

Expected:
- Login form appears.
- Email and password fields are visible.

### Step 3
Open DevTools -> Application tab.
Check:
- Cookies for current host
- Local Storage for current host
- Session Storage for current host

Expected before login:
- No admin auth token yet.

### Step 4
Enter QA_ADMIN_EMAIL in the Email field.
Enter QA_ADMIN_PASSWORD in the Password field.
Click Sign in.

Expected:
- Redirect to /admin/dashboard.

### Step 5
At /admin/dashboard, capture evidence:
1. Current URL
2. Cookies list
3. Local Storage keys
4. Session Storage keys

Record specifically if any key or cookie contains text like:
- sb-
- supabase
- access_token
- refresh_token
- auth-token

Expected:
- Dashboard content visible (Command Center heading or tenant table).
- At least one auth indicator in cookies or storage.

---

## Part B: Simulate Persona Handoff (Admin -> Client -> Admin)

### Step 6
In same browser window and tab, navigate to client portal:

https://crm.rankedceo.com/edit/<QA_CLIENT_REVIEW_TOKEN>

Expected:
- Client portal loads.
- URL contains /edit/.

### Step 7
On client portal, interact with at least 2 tabs (for example Overview and Billing).

Expected:
- Tab content changes without auth interruption.

### Step 8
Without clearing anything, navigate back to admin dashboard:

https://crm.rankedceo.com/admin/dashboard

Expected pass condition:
- You stay on /admin/dashboard and dashboard renders.

Failure condition to record:
- Redirected to /login?next=/admin/dashboard&adminOnly=1

### Step 9
If redirected to login, do not sign in yet.
Capture:
1. Current URL
2. Cookies
3. Local Storage
4. Session Storage
5. Console errors in DevTools

Expected in failure case:
- Missing or incomplete admin auth cookie/storage markers.

---

## Part C: Rehydrate Validation (What the Fix Tries To Do)

### Step 10
From login redirect page, open DevTools -> Console and run this check manually:

Object.keys(localStorage)
Object.keys(sessionStorage)

Then inspect values for keys that include:
- sb-
- supabase
- auth-token
- access_token
- refresh_token

Expected:
- If rehydration worked, at least one auth key should be present before protected navigation.

### Step 11
Still on login redirect page, run:

window.location.href = '/admin/dashboard'

Expected pass:
- Lands on /admin/dashboard.

Failure:
- Returns to /login redirect.

### Step 12
If failure persists, sign in again manually and verify whether dashboard loads immediately.

Interpretation:
- If manual sign-in works every time but post-handoff does not, session persistence/rehydration is the failing layer.

---

## Part D: Cookie Domain and Host Scope Check

### Step 13
On successful admin session, inspect auth cookies and note:
- Name
- Domain
- Path
- SameSite
- Secure
- Expires/Max-Age

Expected for reliability:
- Cookie domain and host scope should match the preview host used during both admin and client pages.

### Step 14
Repeat Steps 6 through 9 using a second host if available (for example qa.rankedceo.com vs crm.rankedceo.com).

Goal:
- Detect cross-host cookie mismatch.

Interpretation:
- Works on one host and fails on another usually indicates domain-scoped cookie mismatch.

---

## Part E: Quick Decision Matrix

1. Admin login fails in Part A:
- Credentials or admin role access issue.

2. Part A passes, Part B fails after handoff:
- Session persistence or storage rehydration issue.

3. Part B only fails on one hostname:
- Cookie domain or host scope issue.

4. Cookies exist but storage token missing before admin navigation:
- Storage rehydrate timing or origin mismatch.

5. Storage token exists but still redirected:
- Server-side auth cookie not accepted or expired.

---

## Evidence Checklist (Attach to PR or Issue)

1. Screenshot at successful initial dashboard load
2. Screenshot at post-handoff redirect failure
3. Cookies export or screenshot before and after handoff
4. Local Storage keys before and after handoff
5. Session Storage keys before and after handoff
6. Console log excerpt around redirect
7. Exact URL transitions in order

---

## Suggested Run Order for 3 Iterations

1. Iteration 1: Baseline only (Part A)
2. Iteration 2: Full handoff cycle (Parts A + B)
3. Iteration 3: Host/domain validation (Parts A + B + D)

This 3-run sequence usually identifies whether the issue is:
- credentials,
- storage/cookie persistence,
- or host/domain scoping.
