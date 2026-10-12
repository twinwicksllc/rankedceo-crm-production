# Ideal Local-Business Audit + User-Controlled Site Builder: Vision and Gap Analysis

Date: 2026-10-12. Original review: `main` @ `05cd678` (#265).
Method: read the code (paths cited per finding). Reviewed `main` @ `05cd678`; E1/E2/E3 corrected against `main` @ `ad3fc30` after Copilot review. No Supabase/production data was queried. Anything not verified in code is marked "unverified".

---

## Part 1. The ideal product (the target)

### A. The ideal audit

A local-business owner enters a URL (or just a business name and city) and in about 60 seconds gets a report that answers four questions: **Where do I stand? Who is beating me and why? What do I fix first? What will it be worth?**

1. **Identity resolution.** Finds the business's Google Business Profile, confirms name/address/phone (NAP), service area, and primary category. Never silently guesses a city.
2. **Local visibility.** Local-pack and organic rank for a service x city keyword set, measured from the business's service area (grid or multi-point), with trend over time.
3. **Google Business Profile health.** Category fit, completeness, photos, posts, hours, services, review count, rating, review velocity, response rate.
4. **Reputation.** Reviews across Google, Yelp, Facebook, with themes and a gap vs. top local competitors.
5. **On-page and technical.** A real crawl: title/meta/H1, service and location pages, internal linking, schema (LocalBusiness/Service/FAQ), indexability (robots, sitemap, canonicals), HTTPS, broken links, Core Web Vitals (mobile first), accessibility.
6. **Conversion readiness.** Click-to-call, tap targets, a lead form, booking path, trust signals above the fold, form speed, tracking installed (GA4/GTM/call tracking).
7. **Citations and authority.** NAP consistency across major directories, backlinks/referring domains, and local links.
8. **Competitors.** Auto-discovered from the local pack (not just typed in), labelled local vs. national, with a head-to-head scorecard.
9. **AI-search readiness (AEO).** Presence in AI answers/overviews, answer-first content, structured data.
10. **Scoring that means something.** Every sub-score is real and separately weighted; the score explains itself and links each finding to a fix and an estimated impact (leads/month, in plain language).
11. **Action plan.** Top 5 fixes ranked by impact/effort, each one-click fixable inside the builder where possible.
12. **Loop.** Re-audits automatically (monthly), shows before/after, emails changes. A white-label PDF and share link for agencies.

### B. The ideal user-controlled template builder

The owner (not a developer, not an agency) controls the site, safely.

1. **Start from the audit.** Industry- and city-aware generation fed by the audit's keywords, gaps and competitor data. The first draft already fixes what the audit flagged.
2. **Full structure control.** Add, remove, **reorder**, and duplicate sections; add **pages** (individual service pages, city/location pages, about, contact, blog/projects); per-page SEO fields.
3. **Brand control with guardrails.** Colors, fonts, logo, spacing/density, button style, dark/light; accessibility contrast checks that block unreadable choices.
4. **Real content only.** Real reviews pulled from the Google Business Profile (with consent and attribution), real project photos, real service areas. No fabricated testimonials, ever.
5. **Lead capture that works out of the box.** Native form (with spam protection), click-to-call, booking (Calendly or built-in), every lead into the CRM with source attribution.
6. **Live preview** on mobile/tablet/desktop; draft vs. published; version history and one-click rollback; scheduled publish.
7. **AI assist, user-approved.** Rewrite a section, regenerate with a tone, suggest FAQs from real questions; always shows a diff and requires approval.
8. **SEO automatic by default.** LocalBusiness + Service + FAQ JSON-LD, sitemap, robots, canonical, OG, alt text prompts, internal links, redirects.
9. **Go-live self-serve.** Domain connect with automatic DNS verification and SSL, no manual ticket.
10. **Measure.** Built-in analytics (or GA4/GTM injection), call/lead tracking, and the audit score re-run after publish to prove improvement.
11. **Ownership.** Export, portable data, clear plans and billing.

---

## Part 2. What is actually in the repo (verified)

### Strengths. Keep and build on these

- **Audit pipeline is real and live-capable.** `lib/waas/services/audit-engine/index.ts` combines Serper SERP rankings, Google PageSpeed (mobile + desktop), AI/heuristic keyword planning from the site, competitor locality classification (local vs. national, `classifyCompetitorLocality`), gap analysis with national-competitor down-weighting, a leaderboard, and a manual-review fallback when APIs fail.
- **Audit-to-site loop exists.** `app/api/audit/[auditId]/create-tenant`, `lib/waas/services/generate-initial-site/` (tier 1/2), `template-recommender.ts`, a before/after audit comparison in the client portal (`compute-audit-score-comparison.ts`, `audit-score-card.tsx`), and an "optimize existing" flow.
- **Good SEO foundations on generated sites.** LocalBusiness JSON-LD v2, FAQ JSON-LD, an "answer-first AEO" section, per-tenant sitemap.xml and robots.txt (`app/_sites/[site]/`), and 16 trade content packs (`lib/waas/content-packs/packs/`).
- **Client portal is substantial.** `/edit/[reviewToken]` has inline text/color/font/image editing, AI rewrite, per-section regeneration, edit history/versions, approval flow, billing tab, and domain-change requests. About 6,900 lines.
- **Security posture.** RLS in the migrations; admin vs. client actions separated.

### Gaps (what falls short of the ideal)

Priority: **P0** = trust/correctness risk, fix first. **P1** = biggest product gains. **P2** = polish and scale.

#### Audit

| # | Pri | Finding | Evidence |
|---|-----|---------|----------|
| A1 | P0 | **The overall score is almost entirely PageSpeed.** Rankings, gaps, local pack, competitors do not feed it. "Mobile score" is set to the *same value* as the performance score, so performance is effectively 60% of the grade. | `audit-engine/index.ts` (`mobileScore = ...categoryScores.performance.score`); `scoring.ts` (0.40/0.30/0.20/0.10) |
| A2 | P0 | **Silent default city.** If no location is supplied or detected, the audit searches **"Chicago, IL"**. A non-Chicago business would get rank data for the wrong market without any warning. | `audit-engine/index.ts` (`?? "Chicago, IL"`) |
| A3 | P1 | **GBP, review, NAP and citation analysis is mostly missing.** When the local pack is enabled, the engine already captures each place's `address`, `category`, `rating`, `ratingCount`, `cid` and `website` and stores the raw places in `report_data.local_pack`, but nothing scores or analyses them. There is no GBP completeness, review velocity or response rate, no NAP-consistency or citation check, and no review analysis beyond the raw rating. | `serper/types.ts` (`PlaceResult`), `audit-engine/index.ts` (`local_pack.places`); grep of audit-engine, pagespeed, serper found no GBP/NAP/citation logic |
| A4 | P1 | **Local pack is off by default** and checks only the first keyword. | `serper/types.ts` (`WAAS_LOCAL_PACK_ENABLED === "true"`), `.env.example` = `false`; `primaryKeyword = keywords[0]`. Production env value: unverified |
| A5 | P1 | **No real on-page crawl.** The only on-page/SEO signal is the PageSpeed "SEO" category. The site scraper (`keyword-generator/site-scraper.ts`) collects address/title hints only for keyword generation, not for findings (missing H1, no service pages, no schema, thin content, etc.). | same files |
| A6 | P1 | **Placeholder data in the report.** `backlinks` (total/referring domains/DA) all `0`, competitor `domain_authority: 0`, `estimated_traffic: 0`, `search_volume: 0`. They are not displayed in the UI (grep of `app/` and `components/` found no use), so nothing is lying to users, but the "authority" dimension is missing. | `audit-engine/index.ts`, `lib/waas/types.ts` |
| A7 | P1 | **Competitors are typed in by the user.** No auto-discovery from the local pack/SERP. | `app/audit/start/audit-start-form.tsx` |
| A8 | P1 | **Findings are not tied to fixes or value.** `technical_issues` is a list of PageSpeed diagnostics; `opportunities` is capped at 3 missing keywords + 2 speed items. No impact/effort ranking, no "fix in builder" action, no lead-value estimate. | `audit-engine/index.ts` |
| A9 | P2 | **No automated re-audit/monitoring.** `vercel.json` has no `crons`; no scheduled re-run found. | `vercel.json` |
| A10 | P2 | **Zero tests on the audit engine, scoring or gap analysis.** `lib/waas` has 10 test files, none for `audit-engine/`. | `ls lib/waas/services/audit-engine` |

#### Builder

| # | Pri | Finding | Evidence |
|---|-----|---------|----------|
| B1 | P0 | **Fake reviews can show on live customer sites.** The reviews section renders a hardcoded list ("Michael T.", "Sarah K.", "James R."), a hardcoded "5.0 · 100+ Google Reviews" badge, and the content type has **no field for real reviews**, so owners cannot replace them. Reviews are `enabled: true` in default templates and are added by `generate-initial-site/tier1.ts`. This is a trust, legal (FTC fake-review rule) and Google-policy risk. I did not see a guard in the file. Confirm on one live tenant. | `components/waas/sections/ReviewNFCSection.tsx` (`PLACEHOLDER_REVIEWS`, line ~19/164, "100+" line ~126); `templates/types.ts` (`ReviewsSectionContent` = eyebrow/headline/subheadline only) |
| B2 | P1 | **Single-page sites only.** The tenant site renders one `page.tsx`. No service pages, location pages, or blog. This is the biggest local-SEO limiter. | `app/_sites/[site]/` has only `page.tsx` (+ sitemap/robots/layout) |
| B3 | P1 | **Owner can edit but not restructure.** Fields: text, color, image, font, section on/off. No reorder, add, duplicate. `hero` and `booking` are locked on. | `client-edit/editable-fields.ts`; no reorder logic in `actions/client-edit/` |
| B4 | P1 | **Two builders that don't meet.** A block builder (8 block types: hero, heading, text, image, button, columns, spacer, divider) exists only in onboarding (`step-website-builder.tsx`). The live site and the portal use a different section system (`SectionId` has 12 section types; 10 templates). Users can't carry block-built content into the live model. | `lib/waas/website-builder/blocks.ts` (`BlockType`); `lib/waas/templates/types.ts` (`SectionId`); importers: `app/get-started/*`, `lib/waas/actions/onboarding/step-builder.ts` |
| B5 | P1 | **No native lead form on tenant sites.** Booking is Calendly-only or a phone link. No form -> CRM path on the tenant site, no spam protection there, no source attribution. | `components/waas/sections/BookingSection.tsx` |
| B6 | P1 | **Domain go-live is manual.** The client submits a request and an admin processes it. No Vercel Domains API integration found. | `actions/client-edit/domains.ts`; grep for `api.vercel.com` in `app/` and `lib/`: none |
| B7 | P1 | **No analytics/tracking settings** (GA4/GTM/call tracking) on tenants. | grep of `lib/waas/types.ts`, templates, `_sites/`: none |
| B8 | P2 | **Brand guardrails.** Colors are free-pick; no contrast check on edits. Unverified beyond `theme.ts`. | `lib/waas/utils/theme.ts` |
| B9 | P2 | **Preview/publish.** A preview route exists (`/edit/[token]/preview`, `_preview`). Draft vs. published, scheduled publish, and rollback UX: unverified. Version tables exist (`tenant_site_versions`). | |

#### Engineering and repo health

| # | Pri | Finding | Evidence |
|---|-----|---------|----------|
| E1 | P1 | **CI doesn't run lint, typecheck or unit tests on PRs, and the lint script is broken for this Next.js version.** The only PR workflow is the Playwright smoke test (`qa-smoke.yml`). The repo is on Next.js `^16.4.0`, where `next build` still type-checks but **no longer runs ESLint**, and the `next lint` command was removed ([Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)). `package.json` still has `"lint": "next lint"`, with `eslint ^8.56.0`, `eslint-config-next 14.2.18` and `.eslintrc.json`. So a lint CI step first needs the lint script migrated to the ESLint CLI. Whether lint currently runs anywhere: unverified. | `package.json`, `.eslintrc.json`, `.github/workflows/*.yml` |
| E2 | P1 | **Migration history is messy.** As of `main` @ `ad3fc30`: 48 top-level `.sql` files in `supabase/migrations/` (duplicate/"fix"/"diagnostic"/"consolidated" files, mixed numbering, plus baseline files added in #266) and 30 WaaS files in `supabase/migrations/waas/`. Hard to know what's applied. Not compared to the live DB (no Supabase access yet). | `supabase/migrations/`, `supabase/migrations/waas/` |
| E3 | P1 | **Shared Supabase project (unverified against the live database).** The repo's own documents state the CRM project is shared with the separate `listing-assistant-pro` (eBay) product: `docs/qa/QA_AGENT_FIX_PLAN.md` and `schema_investigation/SCHEMA_GAP_ANALYSIS.md`, which lists Group B tables with no code references in this repo. The code references 40+ distinct table names via `.from(...)`; that count shows only what the code touches, not who owns a table. No production database was queried. One table needs checking before any DB work: `category_mappings` is listed as eBay/Group B in the gap analysis, yet `supabase/migrations/000020_enable_rls_category_mappings.sql` and `000008a_baseline_forward_referenced_crm_tables.sql` create or alter it in this repo. A verified ownership map is needed before any DB change. | `docs/qa/QA_AGENT_FIX_PLAN.md`, `schema_investigation/SCHEMA_GAP_ANALYSIS.md`, `supabase/migrations/` |
| E4 | P2 | **Repo clutter and stale docs.** ~80 root-level markdown files, stray scripts (`fix-*.py`, `fix-*.js`), `page.tsx.backup`, `page-old.tsx`, a `.mht` log, `build-output.txt`. `STATE.md` last lists PR #139; main is at #265. | repo root |
| E5 | P2 | **No decision log** (DEC-xxxx). | |

---

## Part 3. Recommended order of work

1. **B1**: remove/replace fake reviews (hide the section unless real reviews exist; add a real-review field; later pull from GBP). Small, high-trust.
2. **A2 + A1**: stop the silent "Chicago" default (ask or flag); rebuild the score so mobile is a distinct measure and local visibility counts.
3. **E1**: migrate the lint script from `next lint` to the ESLint CLI (Next.js 16), then add lint + typecheck + `npm test` to a PR workflow, so later work is protected.
4. **B5 + B7**: native lead form -> CRM, and tracking IDs per tenant.
5. **A3 + A4 + A5**: GBP/review/NAP checks, local pack on by default, a real on-page crawl.
6. **B2 + B3**: multi-page (service/location pages) and section reorder/add; unify with the block builder (B4).
7. **A8 + A9**: ranked fixes with "fix it in the builder" actions; monthly re-audit.
8. **B6**: automated domain connect.
9. **E2/E3/E4/E5**: migration and table-ownership audit (read-only first), repo cleanup, decision log.
