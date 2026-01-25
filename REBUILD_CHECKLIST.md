# RankedCEO CRM - Rebuild Checklist

Quick reference for tracking progress during the rebuild.

## Phase 1: Foundation (30 min) ✅ COMPLETE
- [x] `app/layout.tsx` - Root layout
- [x] `app/globals.css` - Global styles
- [x] `lib/utils.ts` - Utility functions
- [x] `components/ui/*` - 7 core UI components (button, input, label, card, badge, alert, progress)
- [x] `app/page.tsx` - Homepage
- [x] Test: `npm run build` succeeds
- [x] Commit: "feat: Add foundation"

## Phase 2: Authentication (45 min)
- [ ] `lib/supabase/client.ts`
- [ ] `lib/supabase/server.ts`
- [ ] `lib/supabase/middleware.ts`
- [ ] `middleware.ts`
- [ ] `app/(auth)/login/page.tsx`
- [ ] `app/(auth)/signup/page.tsx`
- [ ] `app/api/auth/logout/route.ts`
- [ ] Test: Signup → Login flow
- [ ] Commit: "feat: Add authentication"

## Phase 3: Dashboard (30 min) ✅ COMPLETE
- [x] `app/(dashboard)/layout.tsx`
- [x] `app/(dashboard)/page.tsx`
- [x] `types/database.ts`
- [x] `types/index.ts`
- [x] Test: Dashboard loads
- [x] Commit: "feat: Add dashboard layout"

## Phase 4: Contacts (60 min)
- [ ] `app/(dashboard)/contacts/page.tsx`
- [ ] `app/(dashboard)/contacts/new/page.tsx`
- [ ] `app/(dashboard)/contacts/[id]/page.tsx`
- [ ] `app/(dashboard)/contacts/[id]/edit/page.tsx`
- [ ] `components/forms/contact-form.tsx`
- [ ] `lib/validations/contact.ts`
- [ ] Test: Full CRUD
- [ ] Commit: "feat: Add contacts module"

## Phase 5: Companies (45 min)
- [ ] `app/(dashboard)/companies/page.tsx`
- [ ] `app/(dashboard)/companies/new/page.tsx`
- [ ] `app/(dashboard)/companies/[id]/page.tsx`
- [ ] `app/(dashboard)/companies/[id]/edit/page.tsx`
- [ ] `components/forms/company-form.tsx`
- [ ] `lib/validations/company.ts`
- [ ] Test: Full CRUD
- [ ] Commit: "feat: Add companies module"

## Phase 6: Deals & Pipelines (60 min)
- [ ] `app/(dashboard)/deals/page.tsx`
- [ ] `app/(dashboard)/deals/new/page.tsx`
- [ ] `app/(dashboard)/deals/[id]/page.tsx`
- [ ] `app/(dashboard)/deals/[id]/edit/page.tsx`
- [ ] `components/forms/deal-form.tsx`
- [ ] `app/(dashboard)/pipelines/page.tsx`
- [ ] `app/(dashboard)/pipelines/new/page.tsx`
- [ ] `components/forms/pipeline-form.tsx`
- [ ] Test: Kanban board works
- [ ] Commit: "feat: Add deals and pipelines"

## Phase 7: Activities (45 min)
- [ ] `app/(dashboard)/activities/page.tsx`
- [ ] `components/forms/activity-form.tsx`
- [ ] `components/timeline/activity-timeline.tsx`
- [ ] `lib/validations/activity.ts`
- [ ] Test: Create activities
- [ ] Commit: "feat: Add activities module"

## Phase 8: Campaigns (60 min)
- [ ] `lib/email/sendgrid.ts`
- [ ] `lib/email/templates.ts`
- [ ] `lib/campaigns/campaign-service.ts`
- [ ] `app/(dashboard)/campaigns/page.tsx`
- [ ] `app/(dashboard)/campaigns/new/page.tsx`
- [ ] `app/(dashboard)/campaigns/[id]/build/page.tsx`
- [ ] `app/(dashboard)/campaigns/[id]/contacts/page.tsx`
- [ ] `components/campaigns/sequence-builder.tsx`
- [ ] Test: Create campaign
- [ ] Commit: "feat: Add campaigns"

## Phase 9: Smart BCC (45 min)
- [ ] `app/(dashboard)/email/page.tsx`
- [ ] `app/api/email/webhook/route.ts`
- [ ] `components/email/bcc-instructions.tsx`
- [ ] `components/email/email-thread.tsx`
- [ ] `lib/email/parser.ts`
- [ ] Test: Email capture
- [ ] Commit: "feat: Add smart BCC"

## Phase 10: Forms (45 min)
- [ ] `app/(dashboard)/forms/page.tsx`
- [ ] `app/(dashboard)/forms/new/page.tsx`
- [ ] `app/(dashboard)/forms/[id]/edit/page.tsx`
- [ ] `app/f/[id]/page.tsx`
- [ ] `app/api/forms/submit/route.ts`
- [ ] `components/forms/form-builder.tsx`
- [ ] Test: Form submission
- [ ] Commit: "feat: Add forms"

## Phase 11: Analytics (60 min)
- [ ] `lib/analytics/revenue.ts`
- [ ] `lib/analytics/pipeline.ts`
- [ ] `lib/analytics/activity.ts`
- [ ] `app/(dashboard)/reports/page.tsx`
- [ ] `components/analytics/revenue-dashboard.tsx`
- [ ] `components/analytics/pipeline-dashboard.tsx`
- [ ] `components/analytics/activity-dashboard.tsx`
- [ ] Test: View analytics
- [ ] Commit: "feat: Add analytics"

## Phase 12: Commissions (60 min)
- [ ] `lib/commission/commission-service.ts`
- [ ] `app/(dashboard)/commissions/page.tsx`
- [ ] `app/(dashboard)/commissions/schemes/page.tsx`
- [ ] `app/(dashboard)/commissions/payouts/page.tsx`
- [ ] `components/commissions/commission-stats.tsx`
- [ ] `components/commissions/payout-form.tsx`
- [ ] Test: View commissions
- [ ] Commit: "feat: Add commissions"

## Phase 13: Onboarding (45 min)
- [ ] `lib/onboarding/onboarding-service.ts`
- [ ] `app/onboarding/page.tsx`
- [ ] `components/onboarding/onboarding-wizard.tsx`
- [ ] `components/onboarding/steps/welcome-step.tsx`
- [ ] `components/onboarding/steps/email-domain-step.tsx`
- [ ] `components/onboarding/steps/data-import-step.tsx`
- [ ] `components/onboarding/steps/template-step.tsx`
- [ ] `components/onboarding/steps/launch-step.tsx`
- [ ] Test: Complete onboarding
- [ ] Commit: "feat: Add onboarding"

## Phase 14: Settings (30 min)
- [ ] `app/(dashboard)/settings/page.tsx`
- [ ] `app/(dashboard)/settings/profile/page.tsx`
- [ ] `app/(dashboard)/settings/team/page.tsx`
- [ ] `app/(dashboard)/settings/billing/page.tsx`
- [ ] `app/(dashboard)/settings/email/page.tsx`
- [ ] Test: Update settings
- [ ] Commit: "feat: Add settings"

## Phase 15: Polish (30 min)
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add empty states
- [ ] Test all CRUD
- [ ] Test navigation
- [ ] Check responsive
- [ ] Run `npm run build`
- [ ] Commit: "feat: Final polish"

## Final Deployment
- [ ] All phases complete
- [ ] All tests passing
- [ ] Build succeeds
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Verify production URL
- [ ] Test in production

---

**Progress: 3/15 phases complete (20%)**
**Estimated Time Remaining: 10 hours**