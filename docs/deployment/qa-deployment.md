# QA Deployment (`qa.rankedceo.com`)

## Overview

The QA deployment runs at `qa.rankedceo.com` and targets the **`rankedceo-waas`** Supabase project — the same project as production, not a separate QA project.

## Database isolation

QA data is isolated by **schema**, not by project:

- **Schema:** `qa`
- **Tables:** `qa.qa_runs`, `qa.qa_scenarios`
- **Project:** `rankedceo-waas` (shared with production)

All QA agent bookkeeping (run records, scenario definitions, test results) is confined to the `qa` schema via `SupabaseAdapter` and its `db: { schema: "qa" }` configuration. Real client data in `public` tables remains untouched.

## What gets written where

| Component | Project | Schema | Notes |
|---|---|---|---|
| QA agent bookkeeping | rankedceo-waas | qa | Reads/writes `qa.qa_runs`, `qa.qa_scenarios` |
| Real audit form (browser-driven) | rankedceo-waas | public | Writes to `public.audits` when scenarios exercise the form |
| Real onboarding flow (browser-driven) | rankedceo-waas | public | Writes to `public.tenants`, etc. when scenarios exercise the flow |

> **Browser-driven steps are NOT isolated** — when a scenario exercises the real UI, the application writes wherever that deployment's environment points (the `public` schema in `rankedceo-waas`). Schema isolation covers only the agent's own bookkeeping, not what Playwright triggers through the app.

## Host routing

Host routing for `qa.rankedceo.com` is handled in `middleware.ts` via the `QA_WAAS_HOST` and `QA_WAAS_TENANT_SLUG` configuration — see the middleware for details.

## Related documentation

- [QA Agent Fix Plan](../qa/QA_AGENT_FIX_PLAN.md) — comprehensive guide to QA scenario design, constraints, and the Supabase model
- [QA Agent Purging](../qa-agent/purging.md) — how to identify and purge QA records from the `qa` schema
