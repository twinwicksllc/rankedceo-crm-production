# RankedCEO WaaS — Phase 1 Foundation

## Overview

This document describes the Website-as-a-Service (WaaS) foundation built in Phase 1. The WaaS module runs **inside the existing RankedCEO Next.js monorepo** as an isolated layer, sharing the build pipeline and Vercel deployment while using a **completely separate Supabase project** for tenant data.

---

## Architecture

### Multi-Tenant Routing Priority

Every incoming HTTP request flows through a single `middleware.ts` that evaluates routing in this order:

```
Request: client-a.com/services
         ↓
1. Static asset? → Pass through immediately
         ↓
2. Industry subdomain? (smile/hvac/plumbing/electrical) → /app/{industry}/*
         ↓
3. WaaS tenant? (DB lookup via resolve_tenant_by_hostname RPC)
   ├─ Found → Rewrite to /_sites/{slug}/services
   └─ Not found → Continue
         ↓
4. CRM domain? (crm.rankedceo.com / rankedceo.com)
   ├─ Public path → Pass through
   └─ Protected path + no auth → Redirect to /login
```

### Folder Structure

```
rankedceo-crm-production/
├── middleware.ts                    # Unified router (CRM + Industry + WaaS)
│
├── app/
│   ├── _sites/
│   │   └── [site]/                  # WaaS tenant rendering
│   │       ├── layout.tsx           # Brand config injection (CSS vars)
│   │       └── page.tsx             # Tenant home page (placeholder)
│   │
│   ├── waas/                        # WaaS platform admin (CRM-auth gated)
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Admin dashboard
│   │   ├── tenants/                 # (Phase 2: tenant management UI)
│   │   └── audits/                  # (Phase 2: audit report viewer)
│   │
│   └── api/
│       └── waas/
│           ├── tenants/
│           │   ├── route.ts         # GET list, POST create
│           │   └── [id]/route.ts    # GET, PATCH, DELETE single tenant
│           └── audits/
│               ├── route.ts         # GET list, POST create prospect audit
│               └── [id]/
│                   └── status/
│                       └── route.ts # GET status (public polling)
│
├── lib/
│   └── waas/
│       ├── types.ts                 # All TypeScript types & interfaces
│       ├── supabase.ts              # WaaS Supabase clients + helpers
│       └── services/                # (Phase 2: audit worker, domain verifier)
│
└── supabase/
    └── migrations/
        └── waas/
            ├── 001_waas_tenants.sql # Tenants table + RLS + RPC
            └── 002_waas_audits.sql  # Audits table + RLS + RPCs
```

---

## Database Setup (New Supabase Project)

### Step 1: Create New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Name it: `rankedceo-waas` (or similar)
4. Choose region closest to your users
5. Save the database password securely

### Step 2: Run Migrations

In the Supabase SQL Editor, run migrations **in order**:

```sql
-- Run first:
-- Contents of: supabase/migrations/waas/001_waas_tenants.sql

-- Run second:
-- Contents of: supabase/migrations/waas/002_waas_audits.sql
```

### Step 3: Copy Environment Variables

From the Supabase project settings → API:

```bash
NEXT_PUBLIC_WAAS_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY=eyJ...
WAAS_SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only, never expose to browser
```

---

## Database Schema

### `tenants` Table

| Column              | Type                   | Description                                        |
|---------------------|------------------------|----------------------------------------------------|
| `id`                | UUID (PK)              | Auto-generated                                     |
| `slug`              | TEXT UNIQUE NOT NULL   | URL-safe identifier (e.g. `client-a`)              |
| `domain`            | TEXT UNIQUE            | Custom domain (e.g. `client-a.com`)                |
| `subdomain`         | TEXT UNIQUE            | Subdomain (e.g. `client-a` → `client-a.rankedceo.com`) |
| `brand_config`      | JSONB                  | Colors, logo, fonts, contact info, social links    |
| `package_tier`      | ENUM                   | `hosting` \| `standard` \| `premium`              |
| `status`            | ENUM                   | `onboarding` \| `active` \| `suspended` \| `cancelled` |
| `crm_account_id`    | UUID (soft ref)        | Links to CRM `accounts.id` (different DB)          |
| `domain_verified`   | BOOLEAN                | Whether custom domain CNAME is verified            |
| `target_industry`   | TEXT                   | e.g. `plumbing`, `hvac`, `real_estate`             |
| `target_location`   | TEXT                   | e.g. `Chicago, IL`                                 |

### `audits` Table

| Column              | Type                   | Description                                        |
|---------------------|------------------------|----------------------------------------------------|
| `id`                | UUID (PK)              | Auto-generated, used for polling                   |
| `tenant_id`         | UUID (FK → tenants)    | Null for prospect audits                           |
| `audit_type`        | ENUM                   | `prospect` \| `tenant` \| `competitor`            |
| `status`            | ENUM                   | `pending` \| `running` \| `completed` \| `failed` \| `expired` |
| `target_url`        | TEXT NOT NULL          | The website being audited                          |
| `competitor_urls`   | TEXT[]                 | Up to 5 competitor URLs                            |
| `report_data`       | JSONB                  | Full SEO report (scores, rankings, issues, etc.)   |
| `requestor_*`       | TEXT                   | Lead capture fields (name, email, phone, company)  |
| `expires_at`        | TIMESTAMPTZ            | Default: 90 days from creation                     |

### Row Level Security

| Table     | Policy                    | Who                              |
|-----------|---------------------------|----------------------------------|
| `tenants` | Read active tenants       | `anon` (for middleware lookup)   |
| `tenants` | Full CRUD                 | `waas_admin` role                |
| `audits`  | Insert prospect audits    | `anon` (public audit tool)       |
| `audits`  | Read own prospect audits  | `anon`                           |
| `audits`  | Full CRUD                 | `waas_admin` role                |

---

## Tenant Context Propagation

When middleware resolves a WaaS tenant, it injects context into request headers so downstream page components can access brand config without additional DB queries:

```typescript
// Headers injected by middleware:
'x-waas-tenant-id'    → tenant UUID
'x-waas-tenant-slug'  → e.g. 'client-a'
'x-waas-brand-config' → JSON-encoded WaasBrandConfig
'x-waas-package-tier' → 'hosting' | 'standard' | 'premium'
'x-waas-industry'     → e.g. 'plumbing'
'x-waas-location'     → e.g. 'Chicago, IL'

// Reading in a Server Component:
import { headers } from 'next/headers'
import { WAAS_HEADERS } from '@/lib/waas/types'

const brand = JSON.parse(headers().get(WAAS_HEADERS.BRAND_CONFIG) ?? '{}')
```

---

## API Reference

### Tenant APIs (Auth Required)

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/api/waas/tenants`         | List all tenants         |
| POST   | `/api/waas/tenants`         | Create tenant            |
| GET    | `/api/waas/tenants/[id]`    | Get tenant by ID         |
| PATCH  | `/api/waas/tenants/[id]`    | Update tenant            |
| DELETE | `/api/waas/tenants/[id]`    | Soft delete tenant       |

**POST /api/waas/tenants** request body:
```json
{
  "slug": "client-a",
  "subdomain": "client-a",
  "domain": "client-a.com",
  "package_tier": "standard",
  "target_industry": "plumbing",
  "target_location": "Chicago, IL",
  "brand_config": {
    "business_name": "Client A Plumbing",
    "tagline": "Fast & Reliable",
    "colors": {
      "primary": "#2563EB",
      "secondary": "#1E40AF"
    },
    "contact": {
      "phone": "(555) 123-4567",
      "email": "info@client-a.com"
    }
  }
}
```

### Audit APIs

| Method | Endpoint                              | Auth     | Description                    |
|--------|---------------------------------------|----------|--------------------------------|
| GET    | `/api/waas/audits`                    | Required | List audits (admin)            |
| POST   | `/api/waas/audits`                    | None     | Create prospect audit (public) |
| GET    | `/api/waas/audits/[id]/status`        | None     | Poll audit status              |

**POST /api/waas/audits** request body:
```json
{
  "target_url": "https://old-plumber-site.com",
  "competitor_urls": [
    "https://competitor1.com",
    "https://competitor2.com",
    "https://competitor3.com"
  ],
  "requestor_name": "John Smith",
  "requestor_email": "john@example.com",
  "requestor_phone": "(555) 987-6543",
  "requestor_company": "Smith Plumbing"
}
```

**Response:**
```json
{
  "audit_id": "uuid-here",
  "status": "pending",
  "poll_url": "/api/waas/audits/uuid-here/status",
  "expires_in": "90 days"
}
```

---

## Local Development

### Testing WaaS Tenant Routing Locally

Add entries to `/etc/hosts` (macOS/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1  demo.localhost
127.0.0.1  client-a.localhost
```

Then visit `http://demo.localhost:3000` — middleware will look up `demo` in the WaaS DB and rewrite to `/_sites/demo/`.

**Note:** Requires `NEXT_PUBLIC_WAAS_SUPABASE_URL` to be set. If not set, WaaS lookup is skipped and the request falls through to CRM routing.

### Using Mock Mode (No DB Required)

Set `WAAS_SEO_PROVIDER=mock` in `.env.local` to use dummy SEO data for audit development.

---

## Vercel Configuration

### Custom Domain Setup for Tenants

1. In Vercel project settings → Domains, add a **wildcard domain**: `*.rankedceo.com`
2. For custom domains (e.g. `client-a.com`), add them individually in Vercel
3. Update the tenant record: `PATCH /api/waas/tenants/[id]` with `{ "domain": "client-a.com" }`
4. Once Vercel verifies the domain, update: `{ "domain_verified": true }`

### Required Vercel Environment Variables

Add these in Vercel project settings → Environment Variables:

```
NEXT_PUBLIC_WAAS_SUPABASE_URL      = (all environments)
NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY = (all environments)
WAAS_SUPABASE_SERVICE_ROLE_KEY     = (production + preview only, server-side)
SERPER_API_KEY                     = (production only)
WAAS_SEO_PROVIDER                  = serper  (production) | mock (preview)
```

---

## Package Tier Features

| Feature                  | Hosting | Standard | Premium |
|--------------------------|---------|----------|---------|
| Website hosting          | ✅      | ✅       | ✅      |
| Custom domain            | ❌      | ✅       | ✅      |
| SEO audit tool           | ❌      | ✅       | ✅      |
| Competitor analysis      | ❌      | ✅       | ✅      |
| AI insights              | ❌      | ❌       | ✅      |
| White-label branding     | ❌      | ❌       | ✅      |
| Audits per month         | 0       | 10       | Unlimited |

---

## Phase 2 Roadmap

The following features are scoped for Phase 2:

- **Audit Worker**: Background job (Vercel Cron / Inngest) that calls Serper.dev or DataForSEO, processes results, and writes to `report_data`
- **Audit UI**: Full report viewer with scores, charts, keyword rankings, technical issues
- **Tenant Admin UI**: Full CRUD for managing tenants, brand config editor, domain verifier
- **Page Builder**: Template system for tenant websites (HVAC, Plumbing, Real Estate themes)
- **Domain Verifier**: Automated CNAME verification flow with Vercel API
- **Billing Integration**: Stripe subscription management per tenant

---

## Security Notes

1. **`WAAS_SUPABASE_SERVICE_ROLE_KEY`** bypasses RLS — only use server-side in API routes, never expose to browser
2. **`NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY`** is safe for browser — RLS policies restrict access appropriately
3. The `resolve_tenant_by_hostname` RPC is `SECURITY DEFINER` — it runs as the DB owner but only returns `active` tenants
4. Prospect audits are rate-limited by the `anon` RLS policy — add IP-based rate limiting in Phase 2
5. WaaS admin routes at `/waas/*` and `/api/waas/*` require CRM authentication (existing Supabase session)

---

*Phase 1 completed. Foundation is solid. Ready for Phase 2.*