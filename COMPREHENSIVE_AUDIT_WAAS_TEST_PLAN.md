# Comprehensive Test Plan: Audit Tool + Website Builder (Admin and Tenant)

## 1) Purpose
This plan is designed to surface everything your app can currently do, including capabilities that are easy to miss. It covers:
- Public audit experience (prospect)
- Audit processing and reporting internals
- WaaS onboarding and site generation flow
- Admin operations (preview, recommendation, deployment, rollback)
- Tenant/client review flow (selection, feedback, remix)
- Data integrity, security, and reliability

## 2) Scope and Roles
Primary products in scope:
- SEO Audit tool
- Website builder and deployment workflow

Roles in scope:
- Prospect (anonymous, public routes)
- Admin (waas_admin)
- Tenant/client reviewer (review token link)

Out of scope:
- Legacy CRM modules not tied to audit or WaaS site builder (unless you choose to add them)

## 3) Test Strategy at a Glance
Use three layers:
1. Smoke pass: 30 to 45 minutes, confirms critical path is alive
2. Full functional pass: 4 to 6 hours, validates complete capability matrix
3. Hardening pass: resilience, security, and edge cases

Execution cadence:
- Before any release: run Smoke + selected Security checks
- Weekly: run Full functional pass
- Sprint end: run Full + Hardening pass and keep evidence

## 4) Environment and Data Setup
## 4.1 Required environments
- Production-like staging environment (recommended)
- WaaS Supabase project with migrations through 014 applied
- Valid API keys where applicable (Serper, PageSpeed, optional Gemini)

## 4.2 Baseline migration verification
Verify these are present in order:
- 000a, 000b, 004, 005, 008, 009, 010, 011, 012, 013, 014

Minimum table checks:
- tenants
- audits
- leads
- domain_requests
- site_templates
- tenant_site_config
- tenant_site_versions
- tenant_site_deployments

## 4.3 Test accounts
Create at least:
- 1 waas_admin user
- 1 non-admin authenticated user
- 2 prospect test identities (different emails)
- 2 tenants with different industries

## 5) Capability Discovery Matrix (What to Validate)
The list below is intentionally explicit so hidden capabilities are not missed.

### 5.1 Audit Tool Capabilities
- Public audit start page accepts target + up to 3 competitor URLs
- URL normalization and validation behavior
- Audit run endpoint creates or updates audit records
- Top 5 keyword generation and ranking analysis
- Keyword summary metrics: top result, bottom result, mean position
- Report polling endpoint behavior while pending/running/completed/failed/expired
- Manual review fallback when SEO provider fails
- Admin notification path for manual review state
- Friendly report URL behavior with slug + uuid and uuid-only compatibility
- Report lead capture endpoint, including UTM/referrer fields
- 30-day report expiry logic and expired report UX
- Analytics and CTA pathways from report

### 5.2 Website Builder Capabilities (Admin)
- Admin tenant list and detail retrieval
- AI template recommendations with Gemini and fallback behavior
- Apply template to tenant config
- Domain request status management
- Client review token generation and link opening
- Client selection visibility and status in admin
- Version history listing and rollback action
- Regenerate selected variant and A/B/C mix handling
- Deploy readiness checks (pass/warn/fail)
- Deploy blocking when fail checks exist
- Deploy package summary visibility
- Deploy action writes immutable deployment snapshot
- Deployment audit trail panel shows history entries

### 5.3 Website Builder Capabilities (Tenant/Client Reviewer)
- Review page opens using review token
- Compare three variants with viewport switching
- Select final variant and persist selected timestamp
- Submit structured feedback (tone, CTA intensity, layout, notes)
- Submit variant mix preferences
- Confirm iteration timeline behavior is visible and coherent

### 5.4 Rendering and Site Runtime Capabilities
- Tenant site resolves by slug/domain/subdomain
- Template section ordering and enable/disable logic
- Section rendering for hero/services/trust/financing/booking/reviews
- Theme CSS variable injection and custom CSS application
- SEO metadata population on rendered sites

### 5.5 Security and Isolation Capabilities
- RLS behavior for anonymous vs authenticated vs waas_admin
- Public endpoints expose only intended data
- Non-admin cannot perform admin operations
- Tenant isolation on site config/version/deployment records
- Soft-delete behavior and hidden records behavior

## 6) End-to-End Test Suites
Use IDs so results can be logged quickly.

## Suite A: Audit Tool End-to-End
A-01 Start audit with valid target and 3 competitors
Expected: audit starts, report URL returned, status pending/running then completed

A-02 Validate invalid URL rejection
Expected: 400 with clear error

A-03 Run audit with one competitor only
Expected: success and stable report output

A-04 Verify top 5 keyword metrics
Expected: summary contains top_search_result, bottom_search_result, mean_position

A-05 Verify report polling transitions
Expected: no-store while running, cache headers on completed

A-06 Trigger manual review path (simulate provider failure)
Expected: manual review UI state appears, no hard crash

A-07 Lead capture on report
Expected: lead created and linked back to audit record, UTM fields saved

A-08 Expiry behavior
Expected: completed report eventually moves to expired UX state

A-09 Friendly URL compatibility
Expected: both slug-uuid and uuid-only routes resolve same audit

A-10 Download/CTA path instrumentation sanity
Expected: CTA links still resolve and event pathways do not break UX

## Suite B: WaaS Onboarding and Setup
B-01 Create tenant from onboarding step 1
Expected: tenant record created with brand/contact seed and status onboarding

B-02 Submit domain wishlist
Expected: domain_requests inserted with priorities

B-03 Save brand identity
Expected: brand colors/logo stored and merged

B-04 Save integrations/final step
Expected: onboarding completion fields updated appropriately

B-05 Re-run step updates for fallback behavior
Expected: no data corruption when resubmitting steps

## Suite C: Admin Preview and Recommendation
C-01 Open tenant detail as admin
Expected: tenant, domains, audit summary, site config are visible

C-02 Generate template recommendations with GEMINI key present
Expected: 3 ranked recommendations with rationale/confidence/highlights

C-03 Generate recommendations without GEMINI key
Expected: deterministic fallback recommendations

C-04 Apply each template (modern, bold, trust-first)
Expected: template links correctly and preview updates

C-05 Verify client review link generation
Expected: tokenized review path opens and resolves

## Suite D: Tenant Review, Selection, Iteration
D-01 Open review link in private browser
Expected: page loads without admin session

D-02 Compare variants on desktop/tablet/mobile views
Expected: UI toggles and layout rendering are stable

D-03 Select a variant
Expected: selected template and timestamp persist

D-04 Submit feedback payload
Expected: structured fields persisted in tenant_site_config

D-05 Submit A/B/C mix request
Expected: source template set and timestamp persist

D-06 Regenerate selected variant
Expected: updated config generated and prior snapshot retained

D-07 Verify version timeline and rollback
Expected: versions list grows and rollback restores prior snapshot

## Suite E: Deployment Readiness and Audit Trail
E-01 Readiness check with missing metadata
Expected: fail blockers for required checks

E-02 Readiness check with all required fields complete
Expected: ready true, warnings only if optional checks missing

E-03 Attempt deploy while blocked
Expected: deploy action denied with blocker list

E-04 Successful deploy path
Expected: tenant set active, deployment_url and deployed_at set

E-05 Snapshot persistence
Expected: tenant_site_deployments row created with payload JSON

E-06 UI verification of package and trail
Expected: tenant detail shows package summary and recent deployment entries

## Suite F: Security, Auth, and Access Control
F-01 Anonymous access to public audit start and status
Expected: works only for intended public functions

F-02 Non-admin tries admin actions
Expected: denied or fails safely

F-03 RLS spot-check queries per role
Expected: waas_admin full access, anon/auth restricted by policy

F-04 Review token misuse tests
Expected: invalid token rejected, no cross-tenant data leak

## Suite G: Reliability and Performance
G-01 Concurrent audit submissions (5 to 10)
Expected: no crashes, consistent record creation

G-02 Large custom CSS in site config
Expected: readiness fails over budget threshold

G-03 High section count scenario
Expected: warning status generated, deploy still allowed if no fails

G-04 Basic page performance checks
Expected: key pages remain usable under normal load

## 7) Known Feature Flags, Fallbacks, and Caveats to Test Explicitly
- Audit provider fallback: mock vs live provider behavior
- Template recommendation fallback when GEMINI key absent
- Team invitation onboarding endpoint currently logs and returns success without full invite pipeline
- Migration compatibility behavior in onboarding write helpers should be regression-tested after schema changes

## 8) Test Data and Evidence Collection
For every test case capture:
- Test ID
- Role used
- URL/API exercised
- Result (Pass/Fail)
- Screenshot or JSON response snippet
- Database evidence (row IDs, timestamps)
- Follow-up ticket reference if failed

Recommended evidence folder structure:
- qa-evidence/smoke/YYYY-MM-DD
- qa-evidence/full/YYYY-MM-DD
- qa-evidence/hardening/YYYY-MM-DD

## 9) Defect Severity Model
- Sev 1: Data leak, broken deploy gate, cannot complete core flow
- Sev 2: Wrong output or broken secondary path with workaround
- Sev 3: UI inconsistency, non-blocking errors, copy issues

Release gate recommendation:
- No open Sev 1
- Max 2 open Sev 2 with approved workarounds
- All deploy readiness, selection, and audit completion paths passing

## 10) Suggested Automation Roadmap
Phase 1 (immediate):
- API integration tests for audit endpoints and readiness checks
- Server action tests for selection, feedback, mix, deploy

Phase 2:
- Playwright E2E for prospect audit flow and admin deploy flow
- Snapshot tests for template section rendering

Phase 3:
- Scheduled smoke runs in CI on staging
- DB assertion scripts for migrations and critical RLS checks

## 11) One-Day Execution Plan (Practical)
Hour 1:
- Environment checks and migration verification
- Run Suite A smoke subset (A-01, A-04, A-05)

Hour 2 to 3:
- Run Suites C and D critical paths

Hour 4:
- Run Suite E deploy gate and successful deploy checks

Hour 5:
- Run Security subset (F-01, F-02, F-04)

Hour 6:
- Triage defects, create issue list, assign ownership

## 12) Master Regression Checklist (Quick Run)
- Audit submission works
- Audit report renders with top/bottom/mean keyword metrics
- Manual review fallback is user-safe
- Lead capture links lead to audit
- Admin recommendations work with and without AI key
- Review token link works
- Tenant variant selection persists
- Feedback and mix persist
- Version rollback works
- Deploy blocks when required checks fail
- Deploy succeeds when ready
- Deployment snapshot and trail entry are written
- No cross-tenant leakage observed

## 13) Where This Plan Maps in Your Codebase
Primary implementation anchors:
- app/api/audit/run/route.ts
- app/api/audit/leads/route.ts
- app/api/waas/audits/route.ts
- app/api/waas/audits/[id]/status/route.ts
- app/admin/dashboard/[tenantId]/page.tsx
- app/admin/dashboard/[tenantId]/deploy-site-button.tsx
- app/review/[tenantId]/page.tsx
- lib/waas/actions/admin.ts
- lib/waas/actions/onboarding.ts
- lib/waas/services/audit-engine.ts
- lib/waas/services/template-recommender.ts
- components/waas/SectionRenderer.tsx
- supabase/migrations/waas/008_waas_templates.sql
- supabase/migrations/waas/010_waas_client_review_selection.sql
- supabase/migrations/waas/011_waas_client_review_feedback.sql
- supabase/migrations/waas/012_waas_site_config_versions.sql
- supabase/migrations/waas/013_waas_client_variant_mix.sql
- supabase/migrations/waas/014_waas_deploy_audit_trail.sql

## 14) Recommended Next Deliverables
- Convert this plan into a test execution sheet with owners and due dates
- Add a Playwright smoke suite for the 12-item master regression checklist
- Add SQL verification scripts for Suite E and Suite F to standardize evidence
