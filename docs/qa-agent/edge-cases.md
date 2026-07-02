# QA Agent — Edge Case Runbook

This document describes the four edge case scenarios included in the QA Agent and provides triage guidance for each failure mode they detect.

---

## Overview

| Scenario | File                           | Modes        | Steps | What it tests                                        |
| -------- | ------------------------------ | ------------ | ----- | ---------------------------------------------------- |
| Edge 01  | `edge_01_auth_failure.yaml`    | smoke + full | 19    | Wrong password, recovery, invalid token, empty email |
| Edge 02  | `edge_02_billing_error.yaml`   | full only    | 18    | Declined card, portal integrity after failure        |
| Edge 03  | `edge_03_empty_state.yaml`     | smoke + full | 23    | Zero-data rendering across all major pages           |
| Edge 04  | `edge_04_webhook_timeout.yaml` | full only    | 21    | Stripe webhook delay, idempotency, pending state     |

---

## Edge 01 — Auth Failure & Recovery

### What it tests

Bad credentials produce visible error feedback and keep the user on the login page. After entering correct credentials, the user lands on the admin dashboard. An invalid review token in the client portal renders a graceful response (not a blank page or crash). Submitting the login form with an empty email field does not navigate away.

### Failure triage

**Step `e01_s05_assert_error_message` fails** (`contains: "Invalid"`)

The login form does not display an error message after a failed authentication attempt. Check:

- The Supabase `signInWithPassword` error is not being caught and displayed in the form
- The form state (`useState` or `useFormState`) is receiving the error correctly
- The error element is rendered conditionally and is present in the DOM (not just visually hidden)

**Step `e01_s06_assert_still_on_login` fails** (`pattern: "/admin/login"`)

The application redirected away from the login page after a failed auth attempt. This is a **security regression**. Check:

- The Next.js server action or route handler for login is not returning a redirect on error
- The Supabase error is not being treated as a success

**Step `e01_s09_assert_dashboard` fails** (`pattern: "/admin/dashboard"`)

Valid credentials did not redirect to the dashboard. This could mean:

- The test environment's admin account password was rotated — update `QA_ADMIN_PASSWORD` in CI secrets
- The Supabase auth service is experiencing an outage
- A middleware change is intercepting the post-login redirect

**Step `e01_s13_assert_not_blank` fails** (`contains: ""`)

The client portal rendered a completely blank body when given an invalid review token. This means the SSR page for `/edit/[reviewToken]` is throwing an unhandled error rather than returning a 404. Check:

- The `getReviewByToken` query is not throwing on null result
- The page has an error boundary or try/catch around the token lookup

---

## Edge 02 — Billing Errors & Declined Card

### What it tests

The billing flow handles a Stripe-declined card (test card `4000 0000 0000 0002`) without silently creating an active subscription. After a failed checkout, the client portal remains accessible. The admin dashboard continues to function normally.

### Failure triage

**Step `e02_s12_click_upgrade` fails** (upgrade button not found)

The `[data-testid="upgrade-btn-pro"]` element is not present in the billing tab. Check:

- The billing tab is rendering plan cards (`upgrade-plan-card-pro`)
- The tenant's current plan is not already `pro` (upgrade button would be hidden if already subscribed)
- The Stripe products/prices are correctly configured and the billing UI is not in a loading/error state

**Step `e02_s16_assert_portal_intact` fails** (portal root missing after declined checkout)

The client portal is broken after a failed checkout attempt. This is a **critical** finding. Check:

- The Stripe checkout redirect flow is not corrupting the session or review token
- The `successUrl` / `cancelUrl` on the Stripe Checkout Session is set correctly
- The portal page is not dependent on a subscription status that was incorrectly mutated by a failed checkout

### Note on declined card simulation

As of Sprint 4, the `StripeAdapter` does not yet have a `declined` mode that fills `4000 0000 0000 0002` automatically. Step `e02_s14_wait_post_decline` is a wait placeholder. When `StripeAdapter` is extended in a future sprint:

1. Add a `declined` mode alongside `test` and `mock`
2. Have the declined mode fill the iframe with `4000 0000 0000 0002` (same Stripe Elements iframe fill pattern as the `test` mode)
3. Assert the Stripe error message appears in the checkout UI
4. Replace the wait placeholder with an `assert_text` step checking for the error message

---

## Edge 03 — Empty & Zero-Data State Checks

### What it tests

All major pages render without crashing when there is no data. Revenue widget with $0 MRR, clients table with zero tenants, QA reports page with no runs, QA scenarios page with no custom scenarios, client portal tabs with zero reviews.

### Failure triage

**Step `e03_s06_assert_revenue_widget` or `e03_s07_assert_clients_table` fails**

A dashboard widget or table is missing when there is no data. This is almost always caused by `null` or `undefined` returned from a Supabase query being passed to a React component that expects an array. Check:

- The server component or server action is returning `[]` (not `null`) when the query has no results
- The client component is using `?? []` or similar null-coalescing when mapping over the data
- Zod schemas used for API response parsing are treating missing fields as required (use `.optional()` or `.default([])`)

**Step `e03_s08_assert_no_js_crash` or `e03_s11_assert_no_crash_on_empty_runs` fails**

The page is rendering a Next.js error boundary (the "Application error: a client-side exception has occurred" screen). Check the browser console for the actual error. The most common causes in empty-state scenarios are:

- `Cannot read properties of null (reading 'map')` — a component mapping over null data
- `ChunkLoadError` — a JavaScript chunk failed to load (CDN or deploy issue)
- `Minified React error #130` — rendering a value that is not a valid React element

**Step `e03_s19_assert_overview_content` or `e03_s21_assert_reviews_content` fails**

A client portal tab is crashing on zero data. The most common cause is a chart library (e.g. Recharts, Chart.js) receiving an empty array `[]` or `null` as data and not handling it gracefully. Check:

- The chart component has a conditional render: if `data.length === 0`, show an empty state
- The data passed to the chart is `[]` not `null`

---

## Edge 04 — Stripe Webhook Timeout & Delayed Delivery

### What it tests

When a Stripe webhook is delayed (simulated by a 30s + 15s pause), the application:

- Does not prematurely activate a subscription before the webhook fires
- Keeps the client portal accessible during the pending state
- Does not create duplicate subscription records when the webhook finally fires (idempotency)

### Failure triage

**Steps `e04_s13_pause_for_webhook` / `e04_s14_pause_for_webhook_delivery` are slow**

These are intentional pauses (30s + 15s = 45s total). This is expected — the scenario is designed to test the window between a Stripe Checkout completion and the webhook firing. The CI job timeout should be set generously (15 minutes minimum for full scenarios).

**Step `e04_s16_assert_portal_still_works` fails** (portal root missing during webhook delay)

The client portal is crashing while waiting for the webhook. This means the portal has a hard dependency on subscription status. Check:

- The `BillingTab` or plan detection logic is not throwing when `subscription.status === 'incomplete'`
- The portal page gracefully handles all subscription states: `trialing`, `active`, `incomplete`, `past_due`, `canceled`

**Step `e04_s21_assert_no_duplicate_sub_page` fails with critical severity**

Subscription idempotency is broken. This means the Stripe webhook handler is not checking for an existing subscription before creating a new one. Check:

- The `customer.subscription.created` webhook handler uses `upsert` not `insert`
- The Stripe event is checked for `metadata.processed` or a similar idempotency flag
- The Stripe Dashboard shows the event was delivered only once (check "Webhooks" → "Event deliveries")

### Running this scenario

This scenario requires real Stripe test mode (`BILLING_MOCK` must be unset or `false`). It also requires the Stripe CLI to be running locally if you want to test delayed delivery:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe --events checkout.session.completed
```

To simulate a delay, use Stripe CLI's `--delay-webhooks` flag (available in Stripe CLI v1.19+).
