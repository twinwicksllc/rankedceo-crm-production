# Phase 6 — WaaS: Live Site & Tenant Portal Polish

**Builds on:** Phase 5.5 (merged to `main`)
**Goal:** Complete the WaaS product loop — everything a tenant needs from
"site goes live" through to day-to-day self-service management, plus the
admin tooling to support them efficiently at scale.

Phase 6 is split into 4 sub-phases, each a standalone PR:

---

## Phase 6.1 — Tenant Portal Dashboard

**What:** The landing page a tenant sees when they visit `/edit/<token>` after
their site is live. Currently they drop straight into the raw editor. Phase 6.1
adds a proper **portal home** with an at-a-glance summary card and quick
actions.

### Features

| Feature               | Detail                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| **Site status card**  | Live URL, last deployed date, variant label, approval status badge     |
| **Quick actions**     | Edit content · View live site · Request changes · Download brand kit   |
| **Recent edits feed** | Last 5 edits from `client_variant_edit_events` (reuses Phase 5.5 data) |
| **AI rewrite usage**  | "You've used X AI rewrites this session" counter                       |
| **Domain status**     | Shows verified domain or "Domain pending" with support link            |

### Files

| File                                     | Status                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| `app/edit/[reviewToken]/portal-home.tsx` | NEW — portal landing page component                         |
| `app/edit/[reviewToken]/page.tsx`        | MODIFY — show portal home by default, editor on `?tab=edit` |
| `app/edit/[reviewToken]/layout.tsx`      | MODIFY — add tab nav (Overview / Edit / History)            |

### No new migration needed

All data comes from existing tables (`tenant_site_config`, `tenants`,
`client_variant_edit_events`).

---

## Phase 6.2 — Admin Tenant List & Search Improvements

**What:** The `/admin/dashboard` tenant list currently shows all tenants in a
flat list. Phase 6.2 adds filtering, search, status badges, and bulk actions.

### Features

| Feature           | Detail                                                        |
| ----------------- | ------------------------------------------------------------- |
| **Search**        | Live filter by business name, email, domain, trade            |
| **Status filter** | `onboarding` / `pending_review` / `active` / `suspended` tabs |
| **Sort**          | By created date, last deploy, business name                   |
| **Bulk actions**  | Send review link · Mark active · Suspend                      |
| **Stats bar**     | Total tenants · Active · Pending review · Onboarding          |
| **Export CSV**    | Download tenant list with key fields                          |

### Files

| File                                      | Status                                                         |
| ----------------------------------------- | -------------------------------------------------------------- |
| `app/admin/dashboard/page.tsx`            | MODIFY — add search/filter/sort/stats bar                      |
| `app/admin/dashboard/tenant-list.tsx`     | NEW — extracted + enhanced list component                      |
| `app/admin/dashboard/bulk-action-bar.tsx` | NEW — bulk action toolbar                                      |
| `lib/waas/actions/admin.ts`               | MODIFY — add `searchTenants`, `bulkUpdateTenantStatus` actions |

---

## Phase 6.3 — Domain Request Flow (Admin + Tenant)

**What:** The tenant currently submits a domain wishlist during onboarding. Phase
6.3 builds the **full request → admin review → provision → verify** flow as a
proper tracked workflow.

### Features

**Tenant side:**

- Domain request status tracker (Requested → Under Review → Provisioning →
  Live) shown in the portal home (from 6.1)
- Ability to submit a new domain request or change request post-onboarding
- Email notification stub (log to `activities` table for now; real email in 6.4)

**Admin side:**

- Domain requests queue in admin dashboard — sortable, filterable
- Per-request actions: Approve / Reject / Mark provisioning / Mark live
- Notes field for internal comments per request
- "Send status update to client" button (logs activity, triggers notification)

### Files

| File                                                            | Status                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `app/admin/dashboard/domain-requests/page.tsx`                  | NEW — domain requests queue                                            |
| `app/admin/dashboard/domain-requests/request-row.tsx`           | NEW — row component                                                    |
| `app/edit/[reviewToken]/domain-status-card.tsx`                 | NEW — tenant-facing status card                                        |
| `lib/waas/actions/admin.ts`                                     | MODIFY — add `updateDomainRequestStatus`, `getDomainRequests`          |
| `lib/waas/actions/client-edit.ts`                               | MODIFY — add `submitDomainChangeRequest`                               |
| `supabase/migrations/waas/017_waas_domain_request_workflow.sql` | NEW — adds `status_history` JSONB + `admin_notes` to `domain_requests` |

---

## Phase 6.4 — Tenant Email Notifications

**What:** Key lifecycle events trigger email notifications to the tenant.
Uses the existing `RESEND_API_KEY` / `SENDGRID_API_KEY` env var (whichever
is configured).

### Notification triggers

| Trigger                             | Recipient      | Template                          |
| ----------------------------------- | -------------- | --------------------------------- |
| Site variants ready for review      | Tenant         | "Your website designs are ready!" |
| Domain status update                | Tenant         | "Update on your domain: [domain]" |
| Site deployed / live                | Tenant         | "🎉 Your site is live at [url]"   |
| Approval received                   | Admin          | "Client approved variant [N]"     |
| Client edit (first edit of session) | Admin (digest) | Daily digest of edit activity     |

### Files

| File                                                      | Status                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `lib/waas/services/notifications.ts`                      | NEW — `sendTenantNotification(type, tenantId, data)`           |
| `lib/waas/services/email-templates.ts`                    | NEW — React Email compatible HTML templates                    |
| `lib/waas/actions/admin.ts`                               | MODIFY — call `sendTenantNotification` on deploy + review send |
| `lib/waas/actions/client-edit.ts`                         | MODIFY — call notification on approval                         |
| `supabase/migrations/waas/018_waas_notifications_log.sql` | NEW — `notification_log` table for audit trail                 |

---

## Phase 6 — Summary

| Sub-phase | Feature                                                | PR  |
| --------- | ------------------------------------------------------ | --- |
| **6.1**   | Tenant portal dashboard (overview tab + quick actions) | #38 |
| **6.2**   | Admin tenant list search, filter, bulk actions         | #39 |
| **6.3**   | Domain request workflow (admin queue + tenant tracker) | #40 |
| **6.4**   | Tenant email notifications (lifecycle events)          | #41 |

### Build order

6.1 → 6.2 → 6.3 → 6.4 (each PR is independent but 6.3 tenant card reuses 6.1 portal layout)

### Migrations

| Migration                              | Phase |
| -------------------------------------- | ----- |
| `017_waas_domain_request_workflow.sql` | 6.3   |
| `018_waas_notifications_log.sql`       | 6.4   |

### Env vars needed

| Var                                    | Phase | Notes                        |
| -------------------------------------- | ----- | ---------------------------- |
| `RESEND_API_KEY` or `SENDGRID_API_KEY` | 6.4   | Email sending                |
| `NOTIFICATION_FROM_EMAIL`              | 6.4   | e.g. `noreply@rankedceo.com` |

---

## Out-of-scope for Phase 6 (deferred to Phase 7+)

- **Font family picker** — client editor, Phase 7
- **Multi-image galleries** — Phase 7
- **AI image generation** — Phase 7+
- **SMS notifications** — Phase 7
- **Client billing portal** (self-serve plan upgrades) — Phase 7
- **White-label domain for the editor** (`edit.clientdomain.com`) — Phase 8
