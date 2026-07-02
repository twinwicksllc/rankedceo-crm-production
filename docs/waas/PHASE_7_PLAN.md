# Phase 7 — WaaS: Editor Polish, Hero Images & Tenant Billing

**Builds on:** Phase 6.4 (merged to `main`, commit `a90c3ce`)
**Goal:** Complete the client editor's visual customisation layer, add hero/section
background image support to the rendered sites, and introduce a lightweight
self-serve billing flow so tenants can view and manage their plan.

Phase 7 is split into 4 sub-phases, each a standalone PR:

---

## Phase 7.1 — Font Family Picker

**What:** Let tenants pick a heading font and a body font for their site inside
the client editor. The selection is stored in `brand_config.fonts` and picked up
immediately by `ThemeProvider` / CSS variables — no new migration needed.

### Features

| Feature                           | Detail                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Font picker in editor**         | Dropdown in the "Brand" group of `FieldNavigator` — one for heading, one for body                                                                                                          |
| **Curated Google Fonts list**     | ~12 hand-picked pairs appropriate for trades/home services (Inter, Poppins, Montserrat, Roboto, Lato, Oswald, Raleway, Nunito, Playfair Display, Source Sans Pro, Open Sans, Merriweather) |
| **Live preview**                  | Selecting a font immediately swaps the CSS variables in the editor preview iframe / portal preview                                                                                         |
| **Persisted via existing action** | `updateClientBrandConfig` already handles `brand_config.fonts.heading` and `brand_config.fonts.body` — no new server action needed                                                         |
| **Google Fonts loader**           | Inject a `<link>` to `fonts.googleapis.com` in `ThemeProvider` and site `<head>` based on the selected font slugs                                                                          |

### Files

| File                                           | Status                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `lib/waas/client-edit/font-options.ts`         | NEW — curated font list `FONT_OPTIONS[]` with `{ slug, label, googleFamily, category }`                              |
| `app/edit/[reviewToken]/font-picker.tsx`       | NEW — `'use client'` font selector component (heading + body dropdowns with live preview swatches)                   |
| `app/edit/[reviewToken]/editor-shell.tsx`      | MODIFY — add font picker to the Brand section of the field navigator sidebar                                         |
| `app/edit/[reviewToken]/inline-edit-modal.tsx` | MODIFY — add `'font'` as a new `EditableFieldKind` rendered by `FontPicker`                                          |
| `lib/waas/client-edit/editable-fields.ts`      | MODIFY — expose `brand_config.fonts.heading` and `brand_config.fonts.body` as `EditableField` items of kind `font`   |
| `components/waas/ThemeProvider.tsx`            | MODIFY — inject `<link rel="preconnect">` + `<link rel="stylesheet">` for Google Fonts based on `brand_config.fonts` |
| `app/_sites/[site]/layout.tsx`                 | MODIFY — pass `brandConfig.fonts` to `ThemeProvider` so live sites load the correct Google Font                      |

### No new migration needed

`brand_config.fonts` is a JSONB field in the existing `tenants` table. `WaasBrandFonts` type already defined in `lib/waas/types.ts`.

---

## Phase 7.2 — Hero Background Image

**What:** Each tenant's hero section currently uses a solid colour background or
a dot-grid pattern. Phase 7.2 lets admins (and optionally clients) set a hero
background photo that renders as a full-bleed, branded image behind the hero text.

### Features

| Feature                           | Detail                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero image upload (admin)**     | In the tenant detail page (`/admin/dashboard/[tenantId]`) — image upload field in the "Brand / Design" tab with preview thumbnail                   |
| **Hero image editable by client** | Surfaced as an `image` field in the editor's Hero section group (uses existing `ImageUploadZone`)                                                   |
| **Stored in `brand_config`**      | `brand_config.hero_image_url` — no migration needed (JSONB)                                                                                         |
| **Rendered in HeroSection**       | Both `centered` and `split` variants gain an `<Image>` or CSS `background-image` overlay with a semi-transparent dark scrim so text remains legible |
| **Content path support**          | `content-paths.ts` allowlist extended with `brand_config.hero_image_url`                                                                            |
| **Storage**                       | Uploaded to `waas-assets` Supabase bucket (already exists from Phase 5.3), folder `tenants/{tenantId}/hero/`                                        |

### Files

| File                                                    | Status                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `lib/waas/client-edit/editable-fields.ts`               | MODIFY — add `brand_config.hero_image_url` as `image` kind field in the Hero group                  |
| `lib/waas/client-edit/content-paths.ts`                 | MODIFY — add `brand_config.hero_image_url` to the safe-write allowlist                              |
| `components/waas/sections/HeroSection.tsx`              | MODIFY — render hero background image when `brand_config.hero_image_url` is set, with scrim overlay |
| `lib/waas/templates/types.ts`                           | MODIFY — add `hero_image_url?: string                                                               | null`to`BrandConfig` interface     |
| `lib/waas/types.ts`                                     | MODIFY — add `hero_image_url?: string                                                               | null`to`WaasBrandConfig` interface |
| `app/admin/dashboard/[tenantId]/site-settings-form.tsx` | MODIFY — add hero image upload field in the design settings section                                 |

### No new migration needed

`hero_image_url` is stored as a new key inside the existing `brand_config` JSONB column.

---

## Phase 7.3 — Photo Gallery Section

**What:** Add a new `gallery` section type that renders a responsive image grid on
the live site. Tenants can upload photos directly from the client editor.

### Features

| Feature                          | Detail                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **New section type: `gallery`**  | Renders a 2–4 column masonry-style responsive image grid                                                                      |
| **Template opt-in**              | Added as `enabled: false` by default in all three templates (`modern`, `bold`, `trust-first`) — admin or client can enable it |
| **Client editable**              | Up to 8 gallery slots surfaced as `image` fields in the editor navigator                                                      |
| **Caption support**              | Each photo has an optional caption (short `text` field)                                                                       |
| **Reuses upload infrastructure** | `ImageUploadZone` + Supabase `waas-assets` bucket, folder `tenants/{tenantId}/gallery/`                                       |
| **Section toggle**               | On/off toggle in the editor (Phase 5.3 pattern — `updateClientSectionToggle`)                                                 |

### Files

| File                                                    | Status                                                                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/waas/019_waas_gallery_section.sql` | NEW — no schema change needed (gallery items stored inside `sections_json`); migration only adds `gallery` to the section type comment/check |
| `lib/waas/templates/types.ts`                           | MODIFY — add `GalleryItemContent`, `GallerySectionContent` interfaces; add `'gallery'` to `SectionId` union                                  |
| `lib/waas/templates/registry.ts`                        | MODIFY — add `gallery` section (disabled by default) to all three template definitions                                                       |
| `lib/waas/client-edit/editable-fields.ts`               | MODIFY — surface gallery image slots and captions as editable fields                                                                         |
| `components/waas/sections/GallerySection.tsx`           | NEW — responsive image grid component                                                                                                        |
| `components/waas/SectionRenderer.tsx`                   | MODIFY — add `case 'gallery'`                                                                                                                |
| `lib/waas/services/generate-site-content.ts`            | MODIFY — add stub gallery content generation (empty slots — images must be uploaded by client)                                               |

### Migration note

Migration `019` is a no-op schema change (the `sections_json` JSONB already accommodates any section shape). It exists as a documentation artifact and to add a Postgres comment on the column listing all known section types.

---

## Phase 7.4 — Tenant Self-Serve Billing Portal

**What:** Tenants visiting `/edit/<token>` can now see their current plan and
upgrade/downgrade via a Stripe Billing Portal session. Admin can also change a
tenant's plan tier from the dashboard. This closes the monetisation loop for WaaS.

### Features

**Tenant portal (Overview tab):**

- "Your Plan" card on the portal home showing current tier (`hosting` / `standard` / `premium`) with feature comparison chips
- "Upgrade Plan" button → creates a Stripe Billing Portal session and redirects
- "Current usage" stats: AI rewrite credits used, storage used (from existing data)
- Post-upgrade webhook updates `tenants.package_tier` automatically

**Admin dashboard:**

- "Change Plan" dropdown on tenant detail page (admin-side manual override without Stripe, for internal accounts / comps)
- Plan badge visible in tenant list (Phase 6.2 `TenantList` component)

**Stripe integration:**

- Reuses the existing `lib/stripe.ts` + `STRIPE_PRICE_IDS` already in the codebase (CRM billing)
- New WaaS-specific price IDs via `WAAS_STRIPE_PRICE_HOSTING`, `WAAS_STRIPE_PRICE_STANDARD`, `WAAS_STRIPE_PRICE_PREMIUM` env vars
- Stripe customer stored in `tenants.stripe_customer_id` (new column via migration)
- Webhook handler at `/api/waas/webhooks/stripe` updates `package_tier` on `customer.subscription.updated`

### Files

| File                                                    | Status                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/waas/019_waas_gallery_section.sql` | NEW (see 7.3 — same migration file, both changes combined)                                                                   |
| `supabase/migrations/waas/020_waas_tenant_billing.sql`  | NEW — adds `stripe_customer_id TEXT`, `stripe_subscription_id TEXT`, `plan_interval TEXT` columns to `tenants`               |
| `lib/waas/actions/billing.ts`                           | NEW — `createBillingPortalSession(reviewToken)`, `getTenantBillingStatus(tenantId)`, `adminUpdateTenantPlan(tenantId, tier)` |
| `app/edit/[reviewToken]/plan-card.tsx`                  | NEW — `'use client'` plan overview card with upgrade CTA for portal home                                                     |
| `app/edit/[reviewToken]/portal-home.tsx`                | MODIFY — add `PlanCard` below the status card                                                                                |
| `app/api/waas/webhooks/stripe/route.ts`                 | NEW — Stripe webhook handler for `customer.subscription.updated` / `deleted` events                                          |
| `app/admin/dashboard/[tenantId]/page.tsx`               | MODIFY — add "Change Plan" admin control                                                                                     |
| `lib/waas/types.ts`                                     | MODIFY — add `stripe_customer_id`, `stripe_subscription_id` to `WaasTenant`                                                  |

---

## Phase 7 — Summary

| Sub-phase | Feature                                                           | PR  |
| --------- | ----------------------------------------------------------------- | --- |
| **7.1**   | Font family picker (heading + body, Google Fonts)                 | #43 |
| **7.2**   | Hero background image (admin upload + client editable)            | #44 |
| **7.3**   | Photo gallery section (new section type, client-uploadable)       | #45 |
| **7.4**   | Tenant self-serve billing portal (Stripe, plan upgrade/downgrade) | #46 |

### Build order

7.1 → 7.2 → 7.3 → 7.4

- 7.1 and 7.2 are independent and can be built in parallel
- 7.3 depends on 7.2 (shares `ImageUploadZone` patterns established there)
- 7.4 is independent of 7.1–7.3 but builds on Phase 6.1 portal home

### Migrations

| Migration                      | Phase | Description                                                                  |
| ------------------------------ | ----- | ---------------------------------------------------------------------------- |
| `019_waas_gallery_section.sql` | 7.3   | Documents gallery section type; no schema change                             |
| `020_waas_tenant_billing.sql`  | 7.4   | `stripe_customer_id`, `stripe_subscription_id`, `plan_interval` on `tenants` |

### Env vars needed

| Var                          | Phase | Notes                                          |
| ---------------------------- | ----- | ---------------------------------------------- |
| `WAAS_STRIPE_PRICE_HOSTING`  | 7.4   | Stripe price ID for Hosting tier               |
| `WAAS_STRIPE_PRICE_STANDARD` | 7.4   | Stripe price ID for Standard tier              |
| `WAAS_STRIPE_PRICE_PREMIUM`  | 7.4   | Stripe price ID for Premium tier               |
| `STRIPE_WEBHOOK_SECRET`      | 7.4   | Signing secret for `/api/waas/webhooks/stripe` |

> Note: `STRIPE_SECRET_KEY` is already set (used by CRM billing).

---

## Out-of-scope for Phase 7 (deferred to Phase 8+)

- **SMS notifications** — Phase 8 (requires A2P registration / Twilio setup)
- **White-label editor domain** (`edit.clientdomain.com`) — Phase 8
- **AI image generation** (hero + gallery auto-fill) — Phase 8+
- **Blog section** — Phase 8
- **Client mobile app** — Phase 9+
- **Commission engine** — CRM track, not WaaS
