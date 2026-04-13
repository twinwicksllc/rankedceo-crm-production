# Phase 4 Testing Guide — Template Injection Engine

## 📋 Prerequisites

### Required Environment Variables
Add these to your hosting platform (Vercel → Settings → Environment Variables):

```bash
# Supabase (WaaS tenant sites)
NEXT_PUBLIC_WAAS_SUPABASE_URL=https://your-project.supabase.co
WAAS_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Supabase (existing CRM — if separate)
NEXT_PUBLIC_SUPABASE_URL=https://your-crm-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Base URL (for revalidatePath)
APP_BASE_URL=https://your-deployed-url.vercel.app
```

> **Tip:** Get Supabase keys from → https://supabase.com/dashboard/project/_/settings/api

---

## 🚀 Step 1: Deploy the App

### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from root
cd rankedceo-crm-production
vercel --prod

# Or connect repo in Vercel dashboard → auto-deploy on push
```

### Option B: Railway
1. Go to railway.app → New Project
2. Select GitHub repo → rankedceo-crm-production
3. Add environment variables → Deploy
4. Railway generates a `.railway.app` domain

### Option C: Render
1. Go to render.com → New Web Service
2. Connect repo → Build Settings (blank uses defaults)
3. Add environment variables → Deploy

---

## 🧪 Step 2: Run Database Migrations

You need to run the Supabase migrations first.

### Using Supabase CLI
```bash
# Install Supabase CLI (if not installed)
npm i -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Manually in Supabase Dashboard
1. Go to → https://supabase.com/dashboard/project/_/sql
2. Run in order (each one separately):
   - **`supabase/migrations/waas/000a_waas_enums_preflight.sql`** — Create ENUMs
   - **`supabase/migrations/waas/000b_waas_main.sql`** — Create WaaS tables
   - **`supabase/migrations/waas/008_waas_templates.sql`** — Create template tables

3. Verify they ran:
   ```sql
   SELECT * FROM site_templates;
   SELECT * FROM tenants;
   ```

---

## 🌱 Step 3: Seed a Test Tenant

Insert a test tenant into the `tenants` table via Supabase SQL Editor:

```sql
-- Create a test tenant
INSERT INTO tenants (
  id,
  slug,
  subdomain,
  brand_config,
  package_tier,
  status,
  target_industry,
  target_location,
  legal_name,
  primary_trade,
  usp,
  calendly_url,
  financing_enabled,
  created_at,
  updated_at
) VALUES (
  'test-tenant-001',
  'test-plumbing',
  'plumbing-demo',
  '{
    "business_name": "Top Tier Plumbing",
    "tagline": "24/7 Emergency Plumbing Services",
    "hero_title": "Your Trusted Local Plumbers",
    "hero_subtitle": "Fast, reliable, and affordable plumbing solutions for homes and businesses.",
    "logo_url": "https://placehold.co/200x80/2563eb/white?text=Top+Tier",
    "primary_color": "#2563EB",
    "secondary_color": "#1E40AF",
    "accent_color": "#F59E0B",
    "background_color": "#FFFFFF",
    "text_color": "#1F2937",
    "font_heading": "Inter",
    "font_body": "Inter"
  }'::jsonb,
  'starter',
  'active',
  'Plumbing',
  'Austin, TX',
  'Top Tier Plumbing LLC',
  'plumbing',
  'Emergency repairs, drain cleaning, and water heater installation.',
  'https://calendly.com/demo-test/30min',
  true,
  NOW(),
  NOW()
);

-- Verify
SELECT slug, legal_name, status FROM tenants WHERE slug = 'test-plumbing';
```

---

## 🎨 Step 4: Configure Site Template

Assign a template to your tenant in `tenant_site_config`:

```sql
-- Assign 'modern' template to test tenant
INSERT INTO tenant_site_config (
  id,
  tenant_id,
  template_id,
  active_sections_json,
  meta_title,
  meta_description,
  created_at,
  updated_at
) VALUES (
  'site-config-test-001',
  'test-tenant-001',
  (SELECT id FROM site_templates WHERE slug = 'modern'),
  '[
    {"section": "hero", "enabled": true, "order": 1, "config": {"variant": "centered"}},
    {"section": "services", "enabled": true, "order": 2, "config": {"columns": 3}},
    {"section": "trust", "enabled": true, "order": 3, "config": {"variant": "badge-row"}},
    {"section": "financing", "enabled": true, "order": 4, "config": {}},
    {"section": "booking", "enabled": true, "order": 5, "config": {"variant": "inline"}},
    {"section": "reviews", "enabled": true, "order": 6, "config": {"showNFC": true}}
  ]'::jsonb,
  'Top Tier Plumbing | 24/7 Emergency Services in Austin, TX',
  'Fast, reliable plumbing solutions for homes and businesses. Emergency repairs, drain cleaning, water heater installation.',
  NOW(),
  NOW()
);

-- Verify
SELECT 
  t.slug,
  tmpl.name as template_name,
  sc.active_sections_json
FROM tenants t
LEFT JOIN tenant_site_config sc ON sc.tenant_id = t.id
LEFT JOIN site_templates tmpl ON tmpl.id = sc.template_id
WHERE t.slug = 'test-plumbing';
```

---

## 🔍 Step 5: Test Tenant Site Rendering

### URL Pattern
Access your tenant site at:
```
https://your-deployed-url.vercel.app/_sites/test-plumbing
```

### What to Verify

| Check | How to Verify | Expected Result |
|---|---|---|
| **Domain Routing** | Visit `/_sites/test-plumbing` | Page loads, no 404 |
| **Branding** | Check header/footer logo | Shows "Top Tier Plumbing" |
| **Colors** | Inspect hero background | Uses `#2563EB` (primary) |
| **Theme CSS Vars** | DevTools → Elements → `<style id="waas-theme">` | See `--brand-primary-rgb: 37 99 235`, etc. |
| **Section Rendering** | Scroll down | All 6 sections rendered in order |
| **Hero** | Top section | Headline "Your Trusted Local Plumbers" |
| **Services** | Grid section | Shows 3-column service grid |
| **Trust Bar** | Badge section | Shows 6 trust badges |
| **Financing** | Two cards | Optimus + Pricebook links visible |
| **Booking** | Calendly embed | Calendar widget loads |
| **Reviews** | Review section | Shows mock reviews + NFC promo |

### DevTools Verification

```javascript
// Console check for CSS variables
document.documentElement.style.getPropertyValue('--brand-primary-rgb')
// Expected: "37 99 235"

// Check brand colors applied to elements
getComputedStyle(document.querySelector('.bg-brand-primary')).backgroundColor
// Expected: "rgb(37, 99, 235)"
```

---

## 🧪 Step 6: Test Template Switching

### Via Admin (UI)
1. Log in admin at → `/admin/login`
2. Go to → `/admin/dashboard` → find tenant "test-tenant-001"
3. Click "Live Preview" tab

### What to Test

| Action | Expected |
|---|---|
| **Click "Modern" theme** | Iframe reloads with Modern template |
| **Click "Bold" theme** | Iframe reloads with Bold template (different hero variant) |
| **Click "Trust-First" theme** | Iframe loads with Trust-First template (prominent reviews) |
| **Section pills** | Show enabled sections for current theme |
| **"Open in new tab" button** | Opens `/_sites/test-plumbing` in new window |

### Manual SQL Template Switch
```sql
-- Switch to 'bold' template
UPDATE tenant_site_config
SET template_id = (SELECT id FROM site_templates WHERE slug = 'bold'),
    updated_at = NOW()
WHERE tenant_id = 'test-tenant-001';

-- Wait up to 60 seconds (ISR revalidate), then refresh site
```

---

## 📊 Step 7: Test SEO Metadata

Check page metadata via DevTools → Elements → `<head>`:

```html
<!-- Verify these exist -->
<meta property="og:title" content="Top Tier Plumbing | 24/7 Emergency Services in Austin, TX">
<meta property="og:description" content="Fast, reliable plumbing solutions...">
<meta property="og:image" content="...">
<meta property="twitter:card" content="summary_large_image">
```

### Use OpenGraph Preview
- Go to → https://cards-dev.twitter.com/validator
- Paste your `/_sites/test-plumbing` URL
- Verify card renders correctly

---

## 🐛 Step 8: Test Edge Cases

### Test 1: Invalid Tenant Slug
```
URL: /_sites/invalid-tenant
Expected: 404 Not Found page
```

### Test 2: Inactive Tenant
```sql
UPDATE tenants SET status = 'inactive' WHERE slug = 'test-plumbing';
```
Expected: 404 Not Found page

### Test 3: No Site Config
```sql
DELETE FROM tenant_site_config WHERE tenant_id = 'test-tenant-001';
```
Expected: Falls back to 'modern' default template

### Test 4: Financing Disabled
```sql
UPDATE tenants SET financing_enabled = false WHERE slug = 'test-plumbing';
```
Expected: FinancingBlock section does not render

---

## 🧹 Step 9: Cleanup (Optional)

```sql
-- Remove test tenant
DELETE FROM tenant_site_config WHERE tenant_id = 'test-tenant-001';
DELETE FROM tenants WHERE id = 'test-tenant-001';
```

---

## ✅ Testing Checklist

- [ ] App deployed to Vercel/Railway/Render
- [ ] All 3 migrations run (000a, 000b, 008)
- [ ] Test tenant created in `tenants` table
- [ ] Site config assigned in `tenant_site_config` table
- [ ] Tenant site loads at `/_sites/test-plumbing`
- [ ] All 6 sections render in correct order
- [ ] Brand colors apply via CSS variables
- [ ] Admin Live Preview tab works
- [ ] Theme toggle (Modern/Bold/Trust-First) reloads iframe
- [ ] SEO metadata present in `<head>`
- [ ] ISR changes propagate within 60 seconds

---

## 🚨 Common Issues

| Issue | Fix |
|---|---|
| **404 on tenant site** | Run migrations; check tenant status = 'active' |
| **CSS variables not applying** | Check `ThemeProvider` rendered; verify brand_config has colors |
| **Supabase connection error** | Verify env vars set; check service role key permissions |
| **Admin preview not loading** | Check `/_sites` route; verify iframe sandbox attrs |
| **Images not loading** | Ensure `next.config.js` has image domain allowlist |