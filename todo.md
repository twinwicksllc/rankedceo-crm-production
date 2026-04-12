# Phase 3: AdvantagePoint — Onboarding Engine & Admin Control

## Branch: feature/phase3-onboarding-admin

## [x] 1. Setup & Database
- [x] Create branch
- [x] Migration 005: add `pending_review` to tenant status enum + onboarding fields
- [x] Migration 006: domain_requests table
- [x] Migration 007: Supabase Storage `logos` bucket policy

## [x] 2. Types & Server Actions
- [x] Extend WaasTenantStatus with `pending_review`
- [x] Add onboarding types (OnboardingFormData, DomainRequest, etc.)
- [x] Create lib/waas/actions/onboarding.ts (Server Actions)
- [x] Create lib/waas/actions/admin.ts (Server Actions)

## [x] 3. Multi-Step Onboarding Flow (/onboarding)
- [x] Step layout with progress bar (AdvantagePoint branded)
- [x] Step 1: Business Identity (name, address, trade)
- [x] Step 2: Domain Wishlist (search + 3 preferred extensions)
- [x] Step 3: Brand Identity (logo upload, color picker, SVG auto-generate)
- [x] Step 4: Integrations (Calendly URL, financing toggle, USP)
- [x] Form submission with auditId linking
- [x] Success/confirmation page

## [x] 4. Admin Command Center (/admin/dashboard)
- [x] Protected layout with auth check
- [x] Dashboard stats + tenant table (pending + active)
- [x] Tenant detail view (Brand Sheet, Audit results, Domain requests)
- [x] Deploy Site action button (status → active)

## [x] 5. AdvantagePoint Branding
- [x] Shared AdvantagePoint header/footer components
- [x] Apply to onboarding and admin routes

## [x] 6. Final
- [x] tsc --noEmit → zero errors ✅
- [x] Commit + push + PR + merge
- [x] Update todo.md with Phase 4 (Template Injection)

---

# Phase 4: Template Injection Engine

## Branch: feature/phase4-template-injection

## [ ] 1. Database
- [ ] Migration 008: `site_templates` table (slug, name, preview_url, config JSON)
- [ ] Migration 009: `tenant_site_config` table (tenant_id FK, template_slug, content JSON, custom_css, deployment_url, deployed_at)

## [ ] 2. Template Engine Core
- [ ] Create lib/waas/templates/types.ts — SiteTemplate, TenantSiteConfig, TemplateBlock types
- [ ] Create lib/waas/templates/registry.ts — hardcoded template registry (3 starter templates: modern, classic, bold)
- [ ] Create lib/waas/utils/template-renderer.ts — merge tenant brand data into template config

## [ ] 3. Template Selection UI (Admin)
- [ ] Add template picker to admin tenant detail view
- [ ] Preview modal with iframe sandbox
- [ ] "Apply Template" Server Action → saves to tenant_site_config

## [ ] 4. Site Preview & Export
- [ ] `/preview/[tenantId]` route — renders live site preview using tenant config
- [ ] Server Component pulling brand colors, logo, business name, USP
- [ ] Export as static HTML bundle (zip download)

## [ ] 5. Deployment Integration
- [ ] Server Action: `deployTenantSite(tenantId)` — pushes config to Vercel/Netlify API
- [ ] Webhook endpoint for deployment status callbacks
- [ ] Update tenant `deployment_url` + `deployed_at` on success

## [ ] 6. Final
- [ ] tsc --noEmit → zero errors
- [ ] Commit + push + PR + merge to main