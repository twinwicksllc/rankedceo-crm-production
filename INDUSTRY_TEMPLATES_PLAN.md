# Industry Template Packs — Full Development Plan

## RankedCEO CRM: HVAC, Plumbing & Electrical Subdomain Products

**Date:** February 22, 2025  
**Status:** Planning Phase — Approved, Ready for Development  
**Based On:** Smile Dashboard architecture (`smile.rankedceo.com`)

---

## 1. Executive Summary

We are building three new industry-specific subdomain products that mirror the Smile Dashboard architecture. Each product gets its own subdomain, branded entry point, lead intake form, and operator dashboard — all powered by the same Next.js codebase and Supabase backend.

| Product        | Subdomain                  | Color           | Icon         | Industry   |
| -------------- | -------------------------- | --------------- | ------------ | ---------- |
| Smile MakeOver | `smile.rankedceo.com`      | Purple          | 🦷           | Dental     |
| HVAC Pro       | `hvac.rankedceo.com`       | Blue `#2563EB`  | 🔥 Flame     | HVAC       |
| Plumb Pro      | `plumbing.rankedceo.com`   | Teal `#0D9488`  | 🔧 Wrench    | Plumbing   |
| Spark Pro      | `electrical.rankedceo.com` | Amber `#D97706` | 💡 Lightbulb | Electrical |

---

## 2. Key Design Decisions

### 2.1 Per-Industry Signup Flows (Industry Isolation)

Each subdomain has its **own signup page** that embeds the industry into the user's Supabase auth metadata at registration time:

```typescript
// On signup at hvac.rankedceo.com/signup
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { industry: "hvac" }, // stored in auth.users.raw_user_meta_data
  },
});
```

The **middleware** then enforces industry isolation on every request:

- A user with `industry: 'hvac'` visiting `smile.rankedceo.com` → redirected to `hvac.rankedceo.com`
- A user with `industry: 'smile'` visiting `hvac.rankedceo.com` → redirected to `smile.rankedceo.com`
- Unauthenticated users on any subdomain → allowed to access the public lead form only

This prevents cross-industry "poking around" at the application layer. RLS at the database layer provides a second line of defense.

### 2.2 Pool Account for Unattributed Leads

When a customer visits a lead form **without** an `operatorId` in the URL (e.g., direct traffic, shared link without ID), the lead is assigned to a **pool account** per industry.

```
Pool Accounts (pre-seeded in DB):
  - hvac_pool    → account_id: [fixed UUID]
  - plumbing_pool → account_id: [fixed UUID]
  - electrical_pool → account_id: [fixed UUID]
```

These pool accounts act as a holding area. Operators with admin access can later:

- Claim unattributed leads
- Assign them to specific operators
- Use them for lead marketplace features in the future

This means `auth_user_id` can be NULL on `industry_leads` rows (public submissions without an operator link), but `account_id` will always be set (either the operator's account or the pool account).

### 2.3 RLS Policy Fix for NULL auth_user_id

The current Smile RLS pattern `USING (auth.uid() = auth_user_id)` **blocks visibility of leads with NULL auth_user_id**. We fix this with an account-level policy instead:

```sql
-- OLD (blocks NULL auth_user_id rows):
USING (auth.uid() = auth_user_id)

-- NEW (account-level, handles NULLs correctly):
USING (account_id = get_current_user_account_id())
```

This means:

- Operator logs in → sees all leads for their account (including unattributed ones assigned to their account)
- Pool account leads are only visible to admins who have access to the pool account
- NULL `auth_user_id` rows are never blocked

### 2.4 No HIPAA Compliance in Contractor Forms

The `components/industry/lead-form-shell.tsx` will be a **clean, non-HIPAA version** of the Smile form shell:

- No HIPAA notice banner
- No medical/health data fields
- No "HIPAA Protected" badge
- Standard privacy policy language instead: _"Your information is kept private and only shared with your service provider."_
- No special data handling requirements

### 2.5 Logos — Lucide Icons (No Image Files)

Using Lucide React icons styled with Tailwind instead of image files:

- HVAC Pro: `<Flame />` icon in blue
- Plumb Pro: `<Wrench />` icon in teal
- Spark Pro: `<Lightbulb />` icon in amber
- Each dashboard header renders the icon + product name as the "logo"

### 2.6 NEBP Scripts — Backend Only

Inbound openers and discovery questions are stored as data constants in `lib/data/industry-scripts.ts` for use by the AI employee backend. They are **not rendered in the operator dashboard UI** in this phase.

---

## 3. Architecture Overview

### 3.1 How Smile Works Today (Reference Model)

```
smile.rankedceo.com
        │
        ▼
middleware.ts  ──── detects subdomain "smile"
        │           rewrites all paths to /smile/*
        ▼
app/smile/
├── layout.tsx          ← subdomain guard + branding metadata
├── page.tsx            ← protected dashboard (auth required)
├── smile-dashboard.tsx ← client dashboard component
└── assessment/
    ├── page.tsx        ← public intake form (no auth needed)
    └── success/
        └── page.tsx    ← confirmation page

components/smile/
└── assessment-form.tsx ← multi-step form component

lib/actions/
└── smile-assessment.ts ← server actions (submit, fetch)
```

### 3.2 New Architecture (3 New Products)

```
hvac.rankedceo.com / plumbing.rankedceo.com / electrical.rankedceo.com
        │
        ▼
middleware.ts  ──── detects subdomain + enforces industry isolation
        │
        ▼
app/{industry}/
├── layout.tsx              ← subdomain guard + industry branding
├── page.tsx                ← protected operator dashboard
├── {industry}-dashboard.tsx ← client dashboard component
└── lead/
    ├── page.tsx            ← public lead form (no auth needed)
    └── success/
        └── page.tsx        ← confirmation page

app/{industry}/(auth)/
├── login/page.tsx          ← industry-specific login
└── signup/page.tsx         ← industry-specific signup (sets metadata)

components/{industry}/
└── {industry}-lead-form.tsx ← industry-specific form steps

components/industry/         ← SHARED (non-HIPAA)
├── lead-form-shell.tsx      ← multi-step wrapper (progress, nav buttons)
├── lead-card.tsx            ← lead list card
├── lead-status-badge.tsx    ← status badge
├── urgency-badge.tsx        ← urgency indicator
├── lead-filters.tsx         ← search/filter bar
└── dashboard-stats.tsx      ← stats cards

lib/actions/
└── industry-lead.ts         ← shared server actions (all 3 industries)

lib/types/
└── industry-lead.ts         ← shared TypeScript types

lib/validations/
└── industry-lead.ts         ← shared Zod schemas

lib/data/
└── industry-scripts.ts      ← NEBP openers + discovery questions (backend only)

supabase/migrations/
└── 20240222000000_create_industry_leads.sql
```

---

## 4. Middleware Updates (Critical)

The updated `middleware.ts` handles **subdomain detection + industry isolation**:

```typescript
const INDUSTRY_SUBDOMAINS = [
  "smile",
  "hvac",
  "plumbing",
  "electrical",
] as const;
type IndustrySubdomain = (typeof INDUSTRY_SUBDOMAINS)[number];

// Industry subdomain → user metadata industry value mapping
const INDUSTRY_MAP: Record<IndustrySubdomain, string> = {
  smile: "smile",
  hvac: "hvac",
  plumbing: "plumbing",
  electrical: "electrical",
};

// Public paths that don't require auth (lead forms, success pages)
const PUBLIC_INDUSTRY_PATHS = [
  "/lead",
  "/assessment",
  "/success",
  "/login",
  "/signup",
];

if (INDUSTRY_SUBDOMAINS.includes(subdomain as IndustrySubdomain)) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // Allow shared auth/API routes
  const isSharedRoute = ["/api/auth", "/onboarding"].some((p) =>
    pathname.startsWith(p),
  );
  if (isSharedRoute) return response;

  // Check if this is a public path (no auth enforcement)
  const isPublicPath = PUBLIC_INDUSTRY_PATHS.some((p) => pathname.includes(p));

  if (!isPublicPath) {
    // Enforce industry isolation for authenticated routes
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const userIndustry = user.user_metadata?.industry;
      const expectedIndustry = INDUSTRY_MAP[subdomain as IndustrySubdomain];

      if (userIndustry && userIndustry !== expectedIndustry) {
        // Wrong industry — redirect to their correct subdomain
        const correctUrl = new URL(request.url);
        correctUrl.hostname = correctUrl.hostname.replace(
          subdomain,
          userIndustry,
        );
        return NextResponse.redirect(correctUrl);
      }
    }
  }

  // Rewrite to /{subdomain}/* internally
  if (!pathname.startsWith(`/${subdomain}`)) {
    url.pathname = `/${subdomain}${pathname}`;
  }

  const rewrite = NextResponse.rewrite(url);
  response.cookies.getAll().forEach((cookie) => {
    rewrite.cookies.set(cookie.name, cookie.value);
  });
  return rewrite;
}
```

---

## 5. Database Design

### 5.1 Unified `industry_leads` Table

```sql
CREATE TABLE public.industry_leads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  auth_user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- auth_user_id is NULLABLE — public submissions without operatorId use pool account

  industry                 TEXT NOT NULL,

  -- Contact Info (shared)
  customer_name            TEXT NOT NULL,
  customer_email           TEXT NOT NULL,
  customer_phone           TEXT NOT NULL,
  service_address          TEXT,
  city                     TEXT,
  state                    TEXT,
  zip_code                 TEXT,

  -- Service Request (shared)
  urgency                  TEXT NOT NULL DEFAULT 'scheduled',
  preferred_contact_method TEXT DEFAULT 'phone',
  preferred_time           TEXT,
  notes                    TEXT,

  -- Industry-specific data (JSONB — flexible per industry)
  service_details          JSONB DEFAULT '{}',

  -- Status & Assignment
  status                   TEXT NOT NULL DEFAULT 'new',
  estimated_value          NUMERIC(10,2),
  assigned_to              TEXT,

  -- Timestamps
  submitted_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT industry_leads_industry_check
    CHECK (industry IN ('hvac', 'plumbing', 'electrical')),
  CONSTRAINT industry_leads_status_check
    CHECK (status IN ('new', 'contacted', 'scheduled', 'completed', 'lost')),
  CONSTRAINT industry_leads_urgency_check
    CHECK (urgency IN ('emergency', 'urgent', 'scheduled', 'estimate_only')),
  CONSTRAINT industry_leads_email_check
    CHECK (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
```

### 5.2 Pool Accounts (Pre-seeded)

```sql
-- Pool accounts for unattributed leads (run once in Supabase)
INSERT INTO public.accounts (id, name, slug, status, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'HVAC Pool', 'hvac-pool', 'active', 'pool'),
  ('00000000-0000-0000-0000-000000000002', 'Plumbing Pool', 'plumbing-pool', 'active', 'pool'),
  ('00000000-0000-0000-0000-000000000003', 'Electrical Pool', 'electrical-pool', 'active', 'pool')
ON CONFLICT (id) DO NOTHING;
```

These fixed UUIDs are stored as constants in `lib/data/pool-accounts.ts`:

```typescript
export const POOL_ACCOUNTS = {
  hvac: "00000000-0000-0000-0000-000000000001",
  plumbing: "00000000-0000-0000-0000-000000000002",
  electrical: "00000000-0000-0000-0000-000000000003",
} as const;
```

### 5.3 RLS Policies (Fixed for NULL auth_user_id)

```sql
-- Enable RLS
ALTER TABLE public.industry_leads ENABLE ROW LEVEL SECURITY;

-- Operators can view all leads for their account (handles NULL auth_user_id correctly)
CREATE POLICY "Operators can view account leads"
  ON public.industry_leads FOR SELECT TO authenticated
  USING (account_id = get_current_user_account_id());

-- Operators can manage their account's leads
CREATE POLICY "Operators can manage account leads"
  ON public.industry_leads FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id())
  WITH CHECK (account_id = get_current_user_account_id());

-- Anonymous public can INSERT leads (no auth required for lead forms)
CREATE POLICY "Public can submit leads"
  ON public.industry_leads FOR INSERT TO anon
  WITH CHECK (true);
```

### 5.4 Indexes

```sql
CREATE INDEX idx_industry_leads_account_id   ON public.industry_leads(account_id);
CREATE INDEX idx_industry_leads_auth_user_id ON public.industry_leads(auth_user_id);
CREATE INDEX idx_industry_leads_industry     ON public.industry_leads(industry);
CREATE INDEX idx_industry_leads_status       ON public.industry_leads(status);
CREATE INDEX idx_industry_leads_urgency      ON public.industry_leads(urgency);
CREATE INDEX idx_industry_leads_submitted_at ON public.industry_leads(submitted_at DESC);
```

---

## 6. Per-Industry Signup Flow

### 6.1 How It Works

Each subdomain has its own signup page at `app/{industry}/(auth)/signup/page.tsx`.

The signup page is nearly identical to the main CRM signup but:

1. Passes `industry` in `options.data` to Supabase auth
2. Uses industry branding (color, icon, name)
3. Redirects to the industry dashboard after signup

```typescript
// app/hvac/(auth)/signup/page.tsx
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      industry: "hvac", // stored in auth.users.raw_user_meta_data
      product: "hvac_pro", // product identifier
    },
    emailRedirectTo: `https://hvac.rankedceo.com/`,
  },
});
```

### 6.2 Industry Isolation Logic (Middleware)

| User's `industry` metadata | Visiting subdomain    | Result                               |
| -------------------------- | --------------------- | ------------------------------------ |
| `hvac`                     | `hvac.rankedceo.com`  | ✅ Allowed                           |
| `hvac`                     | `smile.rankedceo.com` | ❌ Redirect to `hvac.rankedceo.com`  |
| `smile`                    | `hvac.rankedceo.com`  | ❌ Redirect to `smile.rankedceo.com` |
| `null` (no industry)       | any subdomain         | ✅ Allowed (public lead form only)   |
| not logged in              | any subdomain         | ✅ Allowed (public lead form only)   |

### 6.3 Login Pages

Each subdomain also gets its own login page at `app/{industry}/(auth)/login/page.tsx`:

- Same logic as signup — sets `emailRedirectTo` to the correct subdomain
- After login, checks `user.user_metadata.industry` and redirects accordingly
- If industry mismatch, shows error: _"This account is registered for [X] Pro. Please visit [correct subdomain]."_

---

## 7. Lead Attribution Flow

### 7.1 With Operator Link (Attributed)

```
Operator shares: hvac.rankedceo.com/lead?operatorId={auth_user_id}
        │
        ▼
Lead form loads → operatorId stored in state
        │
        ▼
On submit → server action looks up operator's account_id
        │
        ▼
industry_leads row inserted:
  account_id   = operator's account_id  ✅
  auth_user_id = operatorId             ✅
  industry     = 'hvac'
```

### 7.2 Without Operator Link (Unattributed → Pool)

```
Customer visits: hvac.rankedceo.com/lead  (no operatorId)
        │
        ▼
Lead form loads → operatorId = null
        │
        ▼
On submit → server action uses POOL_ACCOUNTS.hvac
        │
        ▼
industry_leads row inserted:
  account_id   = '00000000-0000-0000-0000-000000000001'  ✅ (hvac pool)
  auth_user_id = NULL                                     ✅ (no operator)
  industry     = 'hvac'
```

### 7.3 Pool Lead Assignment (Future)

Admin can later:

- View all pool leads in an admin dashboard
- Assign pool leads to specific operators
- Update `account_id` and `auth_user_id` on the row
- Offer leads via a lead marketplace

---

## 8. Industry-Specific Form Details

### 8.1 HVAC Pro — Form Steps

| Step | Title               | Key Fields                                                                                     |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------- |
| 1    | Contact Info        | name*, email*, phone*, service_address, city, state, zip                                       |
| 2    | Service Type        | service_type (AC repair/heating/install/maintenance/duct/thermostat), system_age, system_brand |
| 3    | Problem Description | problem_description, symptoms (checkboxes), urgency*, last_service_date                        |
| 4    | Property Details    | property_type (residential/commercial), square_footage, num_units                              |
| 5    | Scheduling          | preferred_time, preferred_contact_method, has_warranty, additional_notes                       |

**Symptoms Checkboxes:**

- Not cooling / Not heating
- Strange noise
- Bad smell
- High energy bill
- Leaking water
- Thermostat issues
- Uneven temperatures
- System won't turn on

**service_details JSONB example:**

```json
{
  "service_type": "ac_repair",
  "system_age": "8 years",
  "system_brand": "Carrier",
  "symptoms": ["not_cooling", "strange_noise"],
  "property_type": "residential",
  "square_footage": "2000",
  "has_warranty": true,
  "last_service_date": "2 years ago"
}
```

---

### 8.2 Plumb Pro — Form Steps

| Step | Title               | Key Fields                                                                            |
| ---- | ------------------- | ------------------------------------------------------------------------------------- |
| 1    | Contact Info        | name*, email*, phone*, service_address, city, state, zip                              |
| 2    | Service Type        | service_type (leak/drain/water heater/pipe/fixture/sewer/emergency), location_in_home |
| 3    | Problem Description | problem_description, symptoms (checkboxes), urgency*, is_water_shutoff_needed         |
| 4    | Property Details    | property_type, home_age, has_shutoff_valve_access, water_source (city/well)           |
| 5    | Scheduling          | preferred_time, preferred_contact_method, has_home_warranty, additional_notes         |

**Symptoms Checkboxes:**

- Dripping faucet
- Slow drain
- No hot water
- Low water pressure
- Water stain / damage
- Gurgling sounds
- Sewage smell
- Running toilet
- Burst pipe

**service_details JSONB example:**

```json
{
  "service_type": "leak_repair",
  "location_in_home": "bathroom",
  "symptoms": ["dripping_faucet", "water_stain"],
  "is_water_shutoff_needed": false,
  "property_type": "residential",
  "home_age": "15 years",
  "has_shutoff_valve_access": true,
  "water_source": "city"
}
```

---

### 8.3 Spark Pro — Form Steps

| Step | Title               | Key Fields                                                                                                |
| ---- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| 1    | Contact Info        | name*, email*, phone*, service_address, city, state, zip                                                  |
| 2    | Service Type        | service_type (panel upgrade/outlet/wiring/lighting/EV charger/generator/inspection/emergency), panel_type |
| 3    | Problem Description | problem_description, symptoms (checkboxes), urgency*, is_power_out                                        |
| 4    | Property Details    | property_type, home_age, panel_amperage (100/200/unknown), num_stories                                    |
| 5    | Scheduling          | preferred_time, preferred_contact_method, permit_needed, additional_notes                                 |

**Symptoms Checkboxes:**

- Flickering lights
- Frequently tripping breakers
- Burning smell
- Sparks from outlet
- Power outage (partial)
- Outlets not working
- Buzzing sounds
- High electric bill

**service_details JSONB example:**

```json
{
  "service_type": "panel_upgrade",
  "panel_type": "fuse_box",
  "symptoms": ["frequent_trips", "flickering_lights"],
  "is_power_out": false,
  "property_type": "residential",
  "home_age": "40 years",
  "panel_amperage": "100",
  "permit_needed": true
}
```

---

## 9. NEBP Scripts (Backend Only — Not in UI)

Stored in `lib/data/industry-scripts.ts`. Not rendered in any dashboard.

### 9.1 HVAC Pro

**Inbound Opener:**

> "Hi, this is [Name] calling from [Company]. I'm reaching out because you recently submitted a service request for your HVAC system. I wanted to make sure we get you taken care of quickly — can I ask, is this something that's affecting your comfort right now, or are you looking to get ahead of it before the season changes?"

**Discovery Questions:**

1. "How old is your current system?"
2. "Have you noticed any unusual sounds, smells, or changes in your energy bill?"
3. "Is this your primary residence or a rental/commercial property?"
4. "Have you had any previous work done on this system?"
5. "What's most important to you — getting it fixed fast, or finding the most cost-effective solution?"

**Appointment Booking Logic:**

- Emergency → Same-day slot first, then next available
- Urgent → Next 2 business days
- Scheduled → 3 available slots in next 7 days
- Estimate Only → Free estimate within 48 hours

---

### 9.2 Plumb Pro

**Inbound Opener:**

> "Hi, this is [Name] from [Company]. I'm following up on your plumbing service request. I want to make sure we get someone out to you quickly — can you tell me, is there any active water damage happening right now, or has the situation stabilized?"

**Discovery Questions:**

1. "Where exactly is the issue located — kitchen, bathroom, basement, or outside?"
2. "Is there any visible water damage or standing water?"
3. "Do you know where your main water shutoff valve is?"
4. "How long has this been going on?"
5. "Is this a rental property or your own home?"

**Appointment Booking Logic:**

- Emergency (active leak/flooding) → Same-day, escalate immediately
- Urgent → Within 24 hours
- Scheduled → Next 3-5 business days
- Estimate Only → Free estimate within 48 hours

---

### 9.3 Spark Pro

**Inbound Opener:**

> "Hi, this is [Name] from [Company]. I'm calling about your electrical service request. Safety is our top priority — can I ask, is everything currently safe in your home, or are you experiencing any flickering lights, burning smells, or tripped breakers that won't reset?"

**Discovery Questions:**

1. "Is this a safety concern or more of an upgrade/improvement project?"
2. "How old is your electrical panel?"
3. "Are you experiencing any flickering lights or frequently tripping breakers?"
4. "Is this for a residential home or commercial property?"
5. "Do you know the amperage of your current panel — is it 100 amp or 200 amp?"

**Appointment Booking Logic:**

- Emergency (power out, burning smell, sparks) → Same-day, safety escalation
- Urgent (frequent trips, flickering) → Within 24-48 hours
- Scheduled (upgrades, new installs) → Next 5-7 business days
- Estimate Only → Free estimate within 48 hours

---

## 10. Complete File Structure

```
app/
├── smile/                              ← EXISTING (reference, unchanged)
│
├── hvac/                               ← NEW
│   ├── (auth)/
│   │   ├── login/page.tsx              ← HVAC-branded login
│   │   └── signup/page.tsx             ← HVAC signup (sets industry: 'hvac')
│   ├── layout.tsx                      ← subdomain guard + blue branding
│   ├── page.tsx                        ← protected operator dashboard
│   ├── hvac-dashboard.tsx              ← client dashboard component
│   └── lead/
│       ├── page.tsx                    ← public lead form
│       └── success/page.tsx            ← confirmation
│
├── plumbing/                           ← NEW
│   ├── (auth)/
│   │   ├── login/page.tsx              ← Plumbing-branded login
│   │   └── signup/page.tsx             ← Plumbing signup (sets industry: 'plumbing')
│   ├── layout.tsx                      ← subdomain guard + teal branding
│   ├── page.tsx                        ← protected operator dashboard
│   ├── plumbing-dashboard.tsx          ← client dashboard component
│   └── lead/
│       ├── page.tsx                    ← public lead form
│       └── success/page.tsx            ← confirmation
│
└── electrical/                         ← NEW
    ├── (auth)/
    │   ├── login/page.tsx              ← Electrical-branded login
    │   └── signup/page.tsx             ← Electrical signup (sets industry: 'electrical')
    ├── layout.tsx                      ← subdomain guard + amber branding
    ├── page.tsx                        ← protected operator dashboard
    ├── electrical-dashboard.tsx        ← client dashboard component
    └── lead/
        ├── page.tsx                    ← public lead form
        └── success/page.tsx            ← confirmation

components/
├── smile/                              ← EXISTING (unchanged)
│
├── industry/                           ← NEW (shared, non-HIPAA)
│   ├── lead-form-shell.tsx             ← multi-step wrapper (progress bar, nav)
│   ├── lead-card.tsx                   ← lead list card
│   ├── lead-status-badge.tsx           ← status badge with colors
│   ├── urgency-badge.tsx               ← urgency indicator (Emergency/Urgent/etc)
│   ├── lead-filters.tsx                ← search + filter bar
│   └── dashboard-stats.tsx             ← stats cards (total, emergency, value, rate)
│
├── hvac/
│   └── hvac-lead-form.tsx              ← HVAC-specific 5-step form
│
├── plumbing/
│   └── plumbing-lead-form.tsx          ← Plumbing-specific 5-step form
│
└── electrical/
    └── electrical-lead-form.tsx        ← Electrical-specific 5-step form

lib/
├── actions/
│   ├── smile-assessment.ts             ← EXISTING (unchanged)
│   └── industry-lead.ts                ← NEW (shared for all 3 industries)
│
├── types/
│   └── industry-lead.ts                ← NEW (shared TypeScript types)
│
├── validations/
│   └── industry-lead.ts                ← NEW (shared Zod schemas)
│
└── data/
    ├── industry-scripts.ts             ← NEW (NEBP openers + discovery Qs, backend only)
    └── pool-accounts.ts                ← NEW (pool account UUID constants)

supabase/migrations/
└── 20240222000000_create_industry_leads.sql  ← NEW (one table + pool accounts)

middleware.ts                           ← UPDATED (industry isolation logic)
```

---

## 11. Development Phases

### Phase A: Shared Infrastructure

**~1.5 hours**

- [ ] `lib/types/industry-lead.ts` — TypeScript types
- [ ] `lib/validations/industry-lead.ts` — Zod schemas
- [ ] `lib/data/pool-accounts.ts` — Pool account UUID constants
- [ ] `lib/data/industry-scripts.ts` — NEBP scripts (backend only)
- [ ] `lib/actions/industry-lead.ts` — Server actions (submit, fetch, update)
- [ ] `supabase/migrations/20240222000000_create_industry_leads.sql` — DB migration
- [ ] `components/industry/lead-form-shell.tsx` — Shared non-HIPAA form wrapper
- [ ] `components/industry/lead-card.tsx` — Lead card component
- [ ] `components/industry/lead-status-badge.tsx` — Status badge
- [ ] `components/industry/urgency-badge.tsx` — Urgency badge
- [ ] `components/industry/lead-filters.tsx` — Filter bar
- [ ] `components/industry/dashboard-stats.tsx` — Stats cards
- [ ] `middleware.ts` — Updated with industry isolation + 3 new subdomains

### Phase B: HVAC Pro

**~1.5 hours**

- [ ] `components/hvac/hvac-lead-form.tsx` — 5-step HVAC form
- [ ] `app/hvac/layout.tsx` — Blue branding, subdomain guard
- [ ] `app/hvac/(auth)/signup/page.tsx` — HVAC signup with industry metadata
- [ ] `app/hvac/(auth)/login/page.tsx` — HVAC login
- [ ] `app/hvac/page.tsx` — Protected dashboard
- [ ] `app/hvac/hvac-dashboard.tsx` — Operator dashboard client component
- [ ] `app/hvac/lead/page.tsx` — Public lead form
- [ ] `app/hvac/lead/success/page.tsx` — Confirmation page

### Phase C: Plumb Pro

**~1 hour** (reuse HVAC patterns)

- [ ] `components/plumbing/plumbing-lead-form.tsx`
- [ ] All `app/plumbing/` files (same structure as HVAC, teal branding)

### Phase D: Spark Pro

**~1 hour** (reuse patterns)

- [ ] `components/electrical/electrical-lead-form.tsx`
- [ ] All `app/electrical/` files (same structure as HVAC, amber branding)

### Phase E: Database & DNS

**~30 minutes**

- [ ] Run `20240222000000_create_industry_leads.sql` in Supabase SQL Editor
- [ ] Seed pool accounts in Supabase
- [ ] Add 3 custom domains in Vercel project settings
- [ ] Add 3 CNAME records in GoDaddy:
  - `hvac` → `cname.vercel-dns.com`
  - `plumbing` → `cname.vercel-dns.com`
  - `electrical` → `cname.vercel-dns.com`
- [ ] Test all 3 subdomains end-to-end

**Total Estimated Time: ~5.5 hours**

---

## 12. Dashboard Features (All 3 Industries)

### Stats Row

| Stat                | Description                                  |
| ------------------- | -------------------------------------------- |
| Total Leads         | This month vs. last month (with trend arrow) |
| 🔴 Urgent/Emergency | Leads needing immediate attention            |
| 💰 Avg Job Value    | Estimated revenue per lead                   |
| 📈 Conversion Rate  | Leads → booked appointments                  |

### Lead List

- Customer name, phone, city
- Service type (from service_details JSONB)
- Urgency badge (color-coded: red=Emergency, orange=Urgent, blue=Scheduled, gray=Estimate)
- Status badge (New / Contacted / Scheduled / Completed / Lost)
- Time since submission
- Quick action: "Mark Contacted" button

### Shareable Lead Link

- Display: `{industry}.rankedceo.com/lead?operatorId={user.id}`
- Copy-to-clipboard button
- Note: _"Share this link with customers to capture leads directly to your dashboard"_

### AI Activity Feed

- Placeholder for future AI employee integration
- Shows recent lead submissions
- Urgency alerts

---

## 13. What's NOT in This Phase

To keep scope focused, the following are explicitly **deferred**:

- ❌ Email/SMS notifications on new lead (Phase 2)
- ❌ NEBP scripts visible in dashboard UI (Phase 2)
- ❌ Calendar/appointment booking integration (Phase 3)
- ❌ Pool lead admin dashboard / lead marketplace (Phase 3)
- ❌ QR code generation for lead links (Phase 2)
- ❌ Lead scoring with Gemini AI (Phase 3)
- ❌ Google Business Profile / Ranked Local Momentum (Phase 3)
- ❌ Billing / subscription management (Phase 3)

---

## 14. Summary

| Item               | Detail                                         |
| ------------------ | ---------------------------------------------- |
| New Products       | 3 (HVAC Pro, Plumb Pro, Spark Pro)             |
| New Subdomains     | 3 (hvac, plumbing, electrical)                 |
| New DB Tables      | 1 unified (`industry_leads`)                   |
| Pool Accounts      | 3 pre-seeded (one per industry)                |
| Industry Isolation | Enforced in middleware via auth metadata       |
| NULL auth_user_id  | Handled via account-level RLS (not user-level) |
| HIPAA              | Not applicable (contractor forms only)         |
| Logos              | Lucide icons (Flame, Wrench, Lightbulb)        |
| NEBP Scripts       | Backend data only, not in UI                   |
| Notifications      | Deferred to Phase 2                            |
| New Files          | ~35 files                                      |
| Dev Time           | ~5.5 hours                                     |

---

**Status: ✅ Plan Approved — Ready to Begin Phase A**
