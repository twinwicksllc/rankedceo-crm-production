# STATE.md — rankedceo-crm-production

> **Purpose:** Single source of truth for the current phase, open work, and known blockers. Update this file at the start and end of every AI-assisted session.

---

## Current Phase

**Post-Phase 14 — Maintenance + WaaS Expansion**

- Phases 1–14 are complete and shipped
- CRM is live at [crm.rankedceo.com](https://crm.rankedceo.com)
- Audit tool is live at [audit.rankedceo.com](https://audit.rankedceo.com)
- WaaS (Website as a Service) product is in active development under `app/waas/`
- Next milestone: Terms & Policies site integration + WaaS feature expansion

---

## Recently Merged (last 5 PRs)

| PR | Title | Merged |
|----|-------|--------|
| #136 | chore(qa): extend smoke, full-lifecycle & enduser scenarios for Tasks 7-9 | 2026-05-27 |
| #135 | feat: branded PDF audit + deep link email (Task 9) | 2026-05-27 |
| #134 | (prior work — see git log) | — |

---

## Open Pull Requests

| PR | Title | Notes |
|----|-------|-------|
| #137 | chore(deps): bump axios from 1.15.2 to 1.16.1 (Dependabot) | Safe to merge — patch security update |

---

## In Progress / Planned

### 1. Terms & Policies Site Integration
- [ ] Integrate a terms and policies site into `crm.rankedceo.com` domain
- [ ] Determine approach: subdirectory vs. subdomain vs. embedded page
- [ ] Note: no direct access to WordPress parent site at `rankedceo.com` — integrations must be API/embed-based

### 2. WaaS (Website as a Service) Expansion
- [ ] WaaS foundation is in place (`app/waas/`, `app/waas-plans/`, `lib/waas/`, `components/waas/`)
- [ ] Review `WAAS_FOUNDATION.md` for current feature spec
- [ ] Continue from `PRODUCT_SPRINT_ROADMAP.md`

### 3. Dependabot PR #137
- [ ] Review and merge axios 1.15.2 → 1.16.1 (no breaking changes expected)

### 4. Industry Templates
- [ ] See `INDUSTRY_TEMPLATES_PLAN.md` for spec
- [ ] Affects: `components/industry/`, `app/landing-electrical/`, `app/landing-hvac/`, `app/landing-plumbing/`

---

## Known Blockers / Watchlist

- **No direct WordPress access:** `rankedceo.com` is a WordPress parent site with no repo access. Any integration must go through WordPress hooks, REST API, or DNS-level routing.
- **Multi-subdomain routing complexity:** `middleware.ts` handles routing between `crm.rankedceo.com` and `audit.rankedceo.com`. Changes to routing logic need to be tested across both subdomains.
- **RLS coverage:** RLS is applied to all tables (see `RLS_COMPLETE_COVERAGE.md`). New tables must include RLS policies before going to production.
- **SMILE integration:** SMILE assessments (`app/smile/`) have HIPAA compliance requirements per `SMILE_HIPAA_COMPLIANCE_UPDATE.md`. Changes to SMILE data flows need extra scrutiny.
- **reCAPTCHA Enterprise:** Integrated for form submissions. Config in `RECAPTCHA_ENTERPRISE_INTEGRATION.md`. Test in staging before changing any form submit logic.

---

## Architecture Snapshot

See [`CONTEXT.md`](CONTEXT.md) for the full architecture reference.

---

_Last updated: 2026-06-04_
