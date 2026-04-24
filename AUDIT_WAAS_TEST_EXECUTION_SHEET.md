# Audit + WaaS Test Execution Sheet

Use this tracker with the master plan in [COMPREHENSIVE_AUDIT_WAAS_TEST_PLAN.md](COMPREHENSIVE_AUDIT_WAAS_TEST_PLAN.md).

## Status Legend
- Not Started
- In Progress
- Passed
- Failed
- Blocked
- N/A

## Severity Legend
- Sev 1: Critical outage or data/security risk
- Sev 2: Major functional break with workaround
- Sev 3: Minor issue or cosmetic defect

## Run Metadata
| Field | Value |
|---|---|
| Test Run Name | |
| Environment | |
| Build/Commit | |
| Date | |
| Test Lead | |
| Notes | |

## Summary Dashboard
| Metric | Count |
|---|---|
| Total Cases | 44 |
| Passed | |
| Failed | |
| Blocked | |
| Not Started | |
| Sev 1 Open | |
| Sev 2 Open | |
| Sev 3 Open | |

## Detailed Execution Tracker
| ID | Suite | Scenario | Role | Owner | Status | Priority | Last Run | Evidence Link | Bug ID | Severity | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-01 | Audit E2E | Start audit with valid target + 3 competitors | Prospect | | Not Started | P0 | | | | | |
| A-02 | Audit E2E | Invalid URL rejection | Prospect | | Not Started | P1 | | | | | |
| A-03 | Audit E2E | Audit with one competitor | Prospect | | Not Started | P1 | | | | | |
| A-04 | Audit E2E | Top/bottom/mean keyword metrics present | Prospect | | Not Started | P0 | | | | | |
| A-05 | Audit E2E | Polling status transitions + cache behavior | Prospect | | Not Started | P1 | | | | | |
| A-06 | Audit E2E | Manual review fallback behavior | Prospect | | Not Started | P0 | | | | | |
| A-07 | Audit E2E | Lead capture links lead to audit | Prospect | | Not Started | P0 | | | | | |
| A-08 | Audit E2E | Report expiry behavior | Prospect | | Not Started | P2 | | | | | |
| A-09 | Audit E2E | Friendly audit URL backward compatibility | Prospect | | Not Started | P1 | | | | | |
| A-10 | Audit E2E | CTA path and event flow sanity | Prospect | | Not Started | P2 | | | | | |
| B-01 | Onboarding | Step 1 creates tenant with seed data | Prospect | | Not Started | P0 | | | | | |
| B-02 | Onboarding | Step 2 domain wishlist persistence | Prospect | | Not Started | P1 | | | | | |
| B-03 | Onboarding | Step 3 brand identity persistence | Prospect | | Not Started | P1 | | | | | |
| B-04 | Onboarding | Step 4 integrations and completion fields | Prospect | | Not Started | P0 | | | | | |
| B-05 | Onboarding | Re-submit/step fallback safety | Prospect | | Not Started | P2 | | | | | |
| C-01 | Admin Preview | Admin tenant detail load | Admin | | Not Started | P0 | | | | | |
| C-02 | Admin Preview | AI recommendations with Gemini configured | Admin | | Not Started | P1 | | | | | |
| C-03 | Admin Preview | Fallback recommendations without Gemini | Admin | | Not Started | P0 | | | | | |
| C-04 | Admin Preview | Apply modern/bold/trust-first templates | Admin | | Not Started | P0 | | | | | |
| C-05 | Admin Preview | Review token link generation and open | Admin | | Not Started | P0 | | | | | |
| D-01 | Client Review | Review link access in private browser | Tenant Reviewer | | Not Started | P0 | | | | | |
| D-02 | Client Review | Variant compare across viewport toggles | Tenant Reviewer | | Not Started | P1 | | | | | |
| D-03 | Client Review | Select variant and persist timestamp | Tenant Reviewer | | Not Started | P0 | | | | | |
| D-04 | Client Review | Submit structured feedback | Tenant Reviewer | | Not Started | P1 | | | | | |
| D-05 | Client Review | Submit A/B/C mix preferences | Tenant Reviewer | | Not Started | P1 | | | | | |
| D-06 | Client Review | Regenerate selected variant | Admin | | Not Started | P1 | | | | | |
| D-07 | Client Review | Version history and rollback | Admin | | Not Started | P0 | | | | | |
| E-01 | Deploy | Readiness fails when metadata missing | Admin | | Not Started | P0 | | | | | |
| E-02 | Deploy | Readiness passes when required complete | Admin | | Not Started | P0 | | | | | |
| E-03 | Deploy | Deploy blocked when fail checks exist | Admin | | Not Started | P0 | | | | | |
| E-04 | Deploy | Successful deploy path sets active/deployed fields | Admin | | Not Started | P0 | | | | | |
| E-05 | Deploy | Deployment snapshot row persisted | Admin | | Not Started | P0 | | | | | |
| E-06 | Deploy | Deployment package and trail UI panels | Admin | | Not Started | P1 | | | | | |
| F-01 | Security | Public access limited to intended endpoints | Prospect | | Not Started | P0 | | | | | |
| F-02 | Security | Non-admin blocked from admin actions | Authenticated Non-Admin | | Not Started | P0 | | | | | |
| F-03 | Security | RLS role-based access spot-check | Admin/Anon/Auth | | Not Started | P0 | | | | | |
| F-04 | Security | Invalid review token misuse rejection | Prospect | | Not Started | P0 | | | | | |
| G-01 | Reliability | Concurrent audit submissions | Prospect | | Not Started | P1 | | | | | |
| G-02 | Reliability | Large custom CSS triggers readiness fail | Admin | | Not Started | P1 | | | | | |
| G-03 | Reliability | High section count produces warn state | Admin | | Not Started | P2 | | | | | |
| G-04 | Reliability | Basic performance budget sanity | Admin/Prospect | | Not Started | P2 | | | | | |

## Defect Log
| Bug ID | Title | Linked Test ID | Status | Severity | Owner | ETA | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Daily Sign-off
| Date | Pass Rate | Sev 1 Open | Sev 2 Open | Release Recommendation | Approved By |
|---|---|---|---|---|---|
| | | | | | |

## Release Gate Checklist
- No open Sev 1 issues
- No unresolved deploy blocker defects
- Core paths passed: A-01, A-04, A-07, C-04, D-03, E-03, E-04, E-05, F-02, F-04
- Evidence links attached for all failed or blocked cases
