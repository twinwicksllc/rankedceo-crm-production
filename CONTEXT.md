# CONTEXT.md — rankedceo-crm-production

> **Purpose:** Stable architecture reference. Contains the facts an AI assistant needs to work effectively across sessions — tech stack, key file map, secrets layout, and critical design decisions. Update when architecture changes, not every session.

---

## Project Overview

**rankedceo-crm-production** is a multi-product SaaS platform built for home service businesses (HVAC, plumbing, electrical, dental). It includes a CRM, an SEO audit tool, a WaaS (Website as a Service) builder, SMILE dental assessments, and landing page templates.

- **CRM:** https://crm.rankedceo.com
- **Audit Tool:** https://audit.rankedceo.com
- **Parent site (WordPress, no repo access):** https://rankedceo.com
- **Repository:** https://github.com/twinwicksllc/rankedceo-crm-production
- **Primary language:** TypeScript (Next.js)

---

## Tech Stack

| Layer          | Technology                                                   |
| -------------- | ------------------------------------------------------------ |
| Framework      | Next.js 14 (App Router) + TypeScript                         |
| UI             | Tailwind CSS + shadcn/ui components                          |
| Database       | Supabase (PostgreSQL)                                        |
| Auth           | Supabase Auth with Row Level Security                        |
| Payments       | Stripe                                                       |
| Email          | Supabase Email + custom templates (`components/email/`)      |
| PDF Generation | Custom PDF route (`app/api/audit/[auditId]/pdf/route.ts`)    |
| reCAPTCHA      | Google reCAPTCHA Enterprise (form protection)                |
| Scheduling     | Calendly integration                                         |
| Analytics      | Custom analytics (`lib/analytics/`, `components/analytics/`) |
| Deployment     | Vercel (multi-subdomain)                                     |
| CI/CD          | GitHub Actions (QA workflows)                                |
| Testing        | Playwright (smoke, weekly, monthly enduser QA)               |

---

## Repository Structure

```
rankedceo-crm-production/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Auth routes (login, signup)
│   ├── (dashboard)/             # CRM dashboard routes
│   ├── admin/                   # Admin panel
│   ├── api/                     # API routes
│   │   └── audit/[auditId]/pdf/ # Branded PDF generation
│   ├── audit/                   # Audit tool pages
│   ├── audit-landing/           # Audit landing page
│   ├── waas/                    # WaaS product pages
│   ├── waas-plans/              # WaaS pricing/plans
│   ├── smile/                   # SMILE dental assessments
│   ├── landing/                 # Generic landing page
│   ├── landing-electrical/      # Electrical industry landing
│   ├── landing-hvac/            # HVAC industry landing
│   ├── landing-plumbing/        # Plumbing industry landing
│   ├── pay/                     # Payment pages
│   ├── review/                  # Review collection
│   └── terms/, privacy/         # Legal pages
├── components/
│   ├── ui/                      # Base UI components
│   ├── audit/                   # Audit-specific components
│   ├── waas/                    # WaaS components
│   ├── smile/                   # SMILE components
│   ├── analytics/               # Analytics dashboard components
│   ├── email/                   # Email templates
│   ├── industry/                # Industry template components
│   └── landing/                 # Landing page components
├── lib/
│   ├── supabase/                # Supabase client (server + client)
│   ├── services/                # Business logic services
│   ├── actions/                 # Next.js Server Actions
│   ├── waas/                    # WaaS utilities
│   ├── analytics/               # Analytics utilities
│   └── types/                   # TypeScript types
├── hooks/                       # Custom React hooks
├── supabase/
│   └── migrations/              # SQL migrations (000001 → present)
├── .github/
│   └── workflows/
│       ├── qa-smoke.yml         # Smoke tests on PR
│       ├── qa-weekly.yml        # Weekly full regression
│       └── qa-monthly-enduser.yml # Monthly enduser flow
├── qa-agent/                    # Playwright QA agent
│   ├── scenarios/               # Test scenario definitions
│   └── src/                     # QA agent source
├── scripts/sql/                 # SQL utility scripts
├── middleware.ts                # Multi-subdomain routing
├── tsconfig.json                # TypeScript config — see design decisions
├── next.config.js
├── vercel.json
└── docs/
    ├── deployment/
    ├── fixes/
    ├── integrations/
    ├── qa/
    └── waas/
```

---

## Multi-Subdomain Architecture

**Critical:** The app serves two distinct subdomains from a single Next.js deployment on Vercel.

| Subdomain             | Purpose                    | Key routes                                    |
| --------------------- | -------------------------- | --------------------------------------------- |
| `crm.rankedceo.com`   | CRM dashboard, WaaS, SMILE | `app/(dashboard)/`, `app/waas/`, `app/smile/` |
| `audit.rankedceo.com` | SEO audit tool             | `app/audit/`, `app/audit-landing/`            |

**Routing logic:** `middleware.ts` inspects `request.headers.get('host')` and rewrites paths based on subdomain. Any changes to routing must be tested on both subdomains.

**WordPress parent site (`rankedceo.com`):** Separate WordPress installation. No direct repo access — integrations must use WordPress REST API, DNS routing (e.g., subdomain CNAME), or embeds. Never assume you can modify WordPress files.

---

## Key Files and Their Roles

| File/Path                              | Role                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `middleware.ts`                        | Subdomain routing — touch with caution                                                       |
| `app/api/audit/[auditId]/pdf/route.ts` | Branded PDF generation (Task 9, PR #135)                                                     |
| `lib/supabase/server.ts`               | Supabase server client (SSR/Server Actions)                                                  |
| `lib/supabase/client.ts`               | Supabase browser client                                                                      |
| `supabase/migrations/`                 | All DB schema migrations (sequential, named `000NNN_*`)                                      |
| `tsconfig.json`                        | TypeScript config — `ignoreDeprecations: "5.0"` is correct; do not change to any other value |
| `WAAS_FOUNDATION.md`                   | WaaS product spec and current status                                                         |
| `PRODUCT_SPRINT_ROADMAP.md`            | Current sprint roadmap and priorities                                                        |
| `CHANGELOG.md`                         | Running changelog (update with each PR)                                                      |

---

## GitHub Actions — CI/QA Workflows

| Workflow                 | Trigger           | What it does                             |
| ------------------------ | ----------------- | ---------------------------------------- |
| `qa-smoke.yml`           | PR opened/updated | Smoke test the critical paths            |
| `qa-weekly.yml`          | Weekly cron       | Full regression suite                    |
| `qa-monthly-enduser.yml` | Monthly cron      | Full enduser flow (signup → audit → PDF) |

**Note:** There is no auto-deploy workflow — Vercel deploys automatically on push to `main`. Supabase migrations must be applied manually via the Supabase dashboard or CLI (no `SUPABASE_DB_URL` in CI).

**Vercel build cache warning:** Vercel reuses incremental TypeScript type-check results across builds. A latent `tsconfig.json` error can be hidden for many deployments and only surface on branches that lack a prior cache (e.g., Dependabot PRs, fresh environments). Always verify type-check passes on a clean build when changing `tsconfig.json`.

---

## Environment Variables / Secrets

### Vercel (Production env)

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase browser access
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase admin access
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_RECAPTCHA_SECRET_KEY` / `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- `NEXT_PUBLIC_SITE_URL` — Base URL (differs per subdomain deployment)

### GitHub Actions Secrets

- `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN` (for any CLI usage)

---

## Supabase Database — Key Tables

| Table                | Purpose                          |
| -------------------- | -------------------------------- |
| `users` / `accounts` | Auth users and business accounts |
| `form_submissions`   | Lead capture form data           |
| `audits`             | SEO audit records                |
| `deals`              | CRM deal pipeline                |
| `smile_assessments`  | SMILE dental assessment records  |
| `subscriptions`      | Stripe subscription state        |

**RLS Policy:** All tables have Row Level Security enabled. See `RLS_COMPLETE_COVERAGE.md`. New tables **must** include RLS policies — do not skip this step.

**Migration naming:** Sequential `000NNN_description.sql` — always increment the number.

---

## Products Summary

| Product                | Status         | Key docs                                         |
| ---------------------- | -------------- | ------------------------------------------------ |
| CRM Dashboard          | Live           | `app/(dashboard)/`                               |
| SEO Audit Tool         | Live           | `app/audit/`, `PHASE_14_COMPLETE.md`             |
| WaaS Builder           | In development | `app/waas/`, `WAAS_FOUNDATION.md`                |
| SMILE Assessments      | Live           | `app/smile/`, `SMILE_HIPAA_COMPLIANCE_UPDATE.md` |
| Industry Landing Pages | Live           | `app/landing-*/`, `INDUSTRY_TEMPLATES_PLAN.md`   |
| Branded PDF Audit      | Live (Task 9)  | `app/api/audit/[auditId]/pdf/route.ts`           |

---

## Critical Design Decisions

1. **Single Vercel deployment, two subdomains.** Middleware-based routing — not separate projects. Always test routing changes on both `crm.*` and `audit.*`.
2. **No direct WordPress access.** `rankedceo.com` parent site cannot be modified via this repo. Plan integrations via API or DNS only.
3. **RLS is mandatory.** Every new Supabase table needs RLS policies before going live. See `RLS_COMPLETE_COVERAGE.md` for the pattern.
4. **SMILE = HIPAA-adjacent.** Dental assessment data gets extra care. See `SMILE_HIPAA_COMPLIANCE_UPDATE.md` before touching `app/smile/` or `components/smile/`.
5. **reCAPTCHA Enterprise (not v3).** Form protection uses the enterprise tier. Config in `RECAPTCHA_ENTERPRISE_INTEGRATION.md` — do not swap to standard v3 without testing.
6. **Migration files are sequential, immutable.** Never edit an existing migration file. Always create a new one with the next sequence number.
7. **Agent hooks present (`.agent_hooks/`).** Startup/shutdown hooks are configured for AI agent workflows. Check `.agent_hooks/startup/` for any pre-session setup steps.
8. **`tsconfig.json` — `ignoreDeprecations: "5.0"` is the correct value.** This suppresses deprecation warnings from `moduleResolution: "bundler"` in TypeScript 5.x. Do not change it to any other version string — `"6.0"` caused build failures (PR #139). The valid values are TypeScript version strings for versions that actually exist.

---

_Last updated: 2026-06-04_
