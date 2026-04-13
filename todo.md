# Phase 4: AdvantagePoint — Template Injection Engine

## Branch: feature/phase4-template-injection

## [ ] 1. Setup
- [ ] Create branch: feature/phase4-template-injection
- [ ] Migration 008: site_templates + tenant_site_config tables

## [ ] 2. Theme Engine
- [ ] tailwind.config.js — CSS variable integration (--brand-primary, --brand-secondary, etc.)
- [ ] lib/waas/utils/theme.ts — map brand_config colors to CSS variables
- [ ] components/waas/ThemeProvider.tsx — injects CSS vars into root via style tag

## [ ] 3. Component Registry (/components/waas/sections/)
- [ ] HeroSection — SVG textmark + USP headline + CTA
- [ ] ServiceGrid — primary trade services grid
- [ ] TrustBar — SEO gap / competition badge from audit data
- [ ] FinancingBlock — conditional Optimus/Pricebook links
- [ ] BookingSection — Calendly embed widget
- [ ] ReviewNFCSection — Google Reviews + NFC tool promo

## [ ] 4. Renderer Engine (/app/_sites/[site]/page.tsx)
- [ ] lib/waas/templates/registry.ts — template definitions (modern, bold, trust-first)
- [ ] lib/waas/templates/types.ts — SiteTemplate, TenantSiteConfig, SectionConfig types
- [ ] components/waas/SectionRenderer.tsx — dynamic section loop renderer
- [ ] app/_sites/[site]/layout.tsx — master layout (header/footer, ThemeProvider)
- [ ] app/_sites/[site]/page.tsx — fetch tenant + config, render sections

## [ ] 5. Admin Preview Sandbox
- [ ] app/admin/dashboard/[tenantId]/preview-tab.tsx — Live Preview iframe tab
- [ ] app/admin/dashboard/[tenantId]/theme-switcher.tsx — Modern/Bold/Trust-First toggle
- [ ] Update app/admin/dashboard/[tenantId]/page.tsx — add Preview tab

## [ ] 6. Final
- [ ] tsc --noEmit → zero errors
- [ ] Commit + push + PR + merge