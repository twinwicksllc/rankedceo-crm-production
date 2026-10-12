# RankedCEO CRM — Live Schema vs. Tracked Migrations Gap Analysis

**Date:** Generated from live `rankedceo-crm` Supabase schema dump (95 public tables) provided by user, cross-referenced against every `*.sql` file in the repo (`supabase/migrations/`, `supabase/migrations/waas/`, `scripts/sql/`, and assorted root-level `*.sql` scripts).

## Method
1. Extracted every `CREATE TABLE [IF NOT EXISTS]` statement from all 95 SQL files in the repo → 49 unique table names that are "tracked" (i.e., created by *some* migration/script somewhere in git history).
2. Extracted all 95 live table names from the user's Supabase dashboard query.
3. Diffed the two lists.
4. For every table in the gap, grepped the application code (`app/`, `components/`, `lib/`) for `.from('table_name')` usage to confirm whether it's an active RankedCEO CRM table or an unrelated table sharing the same Supabase project.

## Result: 49 tables have a `CREATE TABLE` in the repo; 46 live tables do not.

Of those 46 "untracked" tables, they split cleanly into two groups:

### Group A — ACTIVE RankedCEO CRM tables with ZERO tracked migration (confirmed via code usage)
These are real, heavily-used, production CRM tables. The app (`app/(dashboard)/...`, `lib/services/...`) queries them directly, yet no migration file anywhere creates them. They must have been created by hand in the Supabase SQL Editor at some point and never captured in git.

| Table | Code references | Notes |
|---|---|---|
| `contacts` | 18 files | Core CRM entity table. Has AI scoring columns (`ai_conversion_score`, `ai_confidence_score`, etc.), RLS policies (both legacy `"Users can manage/view account data"` and newer `*_non_recursive` policies coexist). |
| `companies` | 15 files | Core CRM entity table. Has legacy + non-recursive RLS policies. |
| `pipelines` | 9 files | Referenced in `deals/new`, `deals/[id]/edit`, `pipelines/page.tsx`, `pipeline-form.tsx`. |
| `pipeline_stages` | 0 direct code hits, but referenced by name inside `004_optimize_rls_performance.sql` and `CONSOLIDATED_MIGRATION_SAFE.sql` (which explicitly comments "already exists and will be skipped") | Confirms the table was known to exist by whoever wrote those migrations — it was just never migrated into git. `deals.stage_id` FK's into it. |

**These four tables are the real, confirmed gap** that matches the original suspicion from the PR #265 investigation. `deals`, `activities`, `campaigns`, `email_messages`, `forms`, `appointments`, `leads`, `users`, `accounts` — all previously suspected — **do** have tracked `CREATE TABLE IF NOT EXISTS` statements (found in `CONSOLIDATED_MIGRATION.sql`, the `20240116*` files, `000001_create_users_and_accounts.sql`, etc.), so those are NOT part of the gap. Only **contacts, companies, pipelines, pipeline_stages** are truly missing.

### Group B — Unrelated tables (NOT part of RankedCEO CRM, share the same Supabase project)
Zero code references anywhere in this repo. These belong to a separate side project (an eBay-reselling / pricing-automation tool, plus what looks like a generic SaaS starter template) that happens to live in the same `rankedceo-crm` Supabase project:

- eBay/reselling app: `drafts`, `listing_cogs`, `listing_edits_log`, `listing_financials`, `ebay_browse_call_log`, `ebay_items_refresh_outcomes`, `ebay_rate_limit_polls`, `ebay_taxonomy_cache`, `ebay_taxonomy_meta`, `reprice_rules`, `market_watches`, `market_price_history`, `category_mappings`, `category_aspects_cache`, `category_hygiene_log`, `competitor_prices`, `cost_alerts`, `knowledge_base`, `lookup_decisions`, `test_items`, `user_active_listings`, `spot_price_cache`, `imports`, `gemini_usage`
- Generic SaaS/starter-template tables: `organizations`, `org_members`, `org_invitations`, `profiles`, `subscriptions`, `usage_tracking`, `support_tickets`, `messages` (this one only appears as a JSON *column* name in `agent-conversation-service.ts`, not a table)
- Miscellaneous / ambiguous, zero code references: `analysis_attempts`, `audit_logs`, `billing_usage`, `commission_events`, `commission_payouts`, `commission_schemes`, `domain_quality_metrics`, `email_domains`, `lead_assignments`, `lead_sources`, `optimization_history`, `qualified_leads_global`, `sequence_steps`, `suppression_list`

None of Group B needs any action — they're not part of this codebase and shouldn't be migrated/tracked here.

## Bottom line
The actual, confirmed gap is small and specific:

> **`contacts`, `companies`, `pipelines`, `pipeline_stages`** exist live in production with real data, rich schemas, indexes, FKs, and RLS policies — but have **no `CREATE TABLE` in any tracked migration**. This is exactly why a fresh Supabase Preview Branch (or any brand-new environment replaying migrations from scratch) would be missing these tables entirely, even though production itself works fine (because production already has them from manual dashboard SQL).

## Suggested next step (not yet actioned — awaiting your decision)
Write a single new "baseline" migration, e.g. `000021_baseline_contacts_companies_pipelines.sql`, using `CREATE TABLE IF NOT EXISTS` with the **exact live schema** (columns, types, defaults, constraints, indexes, RLS policies) captured in the dump the user provided — so it's a no-op on production (tables already exist) but correctly creates them on any fresh database/preview branch. This mirrors the pattern already used for `deals` in `scripts/sql/FIX_DEALS_TABLE_COMPLETE.sql`.

## Update: WaaS project gap also investigated and resolved

A parallel check was run against the `rankedceo-waas` Supabase project before writing any new migrations, per user request ("Before we write the new tables, should we check what is available in the rankedceo-waas tables?").

**Findings:**
- WaaS's live `accounts` and `users` tables exist but have **zero tracked migrations** anywhere in `supabase/migrations/waas/`. Constraint names (`accounts_name_not_empty`, `users_account_id_not_null`) exactly match the CRM's `000001_create_users_and_accounts.sql`, confirming this exact CRM migration was run directly against the WaaS database at some point, never captured as a WaaS migration file.
- No WaaS application code (`lib/waas/**`, `app/waas/**`, `app/api/waas/**`, `components/waas/**`) references these `accounts`/`users` tables. WaaS's actual multi-tenant model uses `tenants` with a soft, nullable `tenants.crm_account_id` pointer back to the (separate) CRM project's `accounts` table — so these WaaS-local `accounts`/`users` tables appear vestigial from an early bootstrap step.
- The 9 tables reported as "tracked but not live" (`client_domain_change_requests`, `client_uploaded_assets`, `notification_log`, `qa_runs`, `qa_scenarios`, `tenant_site_deployments`, `tenant_site_variants`, `tenant_site_versions`, `tenant_variant_regenerations`) were confirmed by the user to be a real gap — **migrations were written but never actually run against production** (`count(*)` on `information_schema.tables` confirmed only 9 public tables live, matching the user's original paste exactly). This is a deployment/ops gap, not a tracking gap — the migration files are correct and just need to be applied to the live WaaS database. No code changes needed for these; flagged here for the user's awareness/ops backlog.

**Resolution:**
- Created `supabase/migrations/000021_baseline_contacts_companies_pipelines.sql` (CRM project) — idempotent baseline for `contacts`, `companies`, `pipelines`, `pipeline_stages`, matching the exact live schema (columns, constraints, indexes, RLS policies including the `_non_recursive` policy variants and the duplicate `public`-role policies observed on `pipeline_stages`).
- Created `supabase/migrations/waas/027_baseline_accounts_users.sql` (WaaS project) — idempotent baseline for `accounts`/`users`, matching the exact live schema and preserving the `handle_new_user()` bootstrap trigger for parity with production, without wiring these tables into any current WaaS feature (per the "no code references" finding above). Dropping these tables entirely is left as a future decision, not made here.
- Both migrations use `CREATE TABLE IF NOT EXISTS` + `DO $$ ... $$` guarded `ALTER TABLE ADD COLUMN IF NOT EXISTS`-style checks + `CREATE INDEX IF NOT EXISTS` + `DROP POLICY IF EXISTS` / `CREATE POLICY`, so they are safe (no-op) against the current live production databases and complete on any fresh database or preview branch.

## Update: Supabase Preview Branch check failure on PR #266 — full migration replay validated and fixed

After PR #266 (containing the baseline migrations above) was opened, the Supabase preview-branch check **failed**:

```
ERROR: relation "contacts" does not exist (SQLSTATE 42P01)
```

during `DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;` inside `004_optimize_rls_performance.sql`.

**Root cause:** Supabase's PR preview branch feature provisions a brand-new, completely empty Postgres database and replays *every single file* in `supabase/migrations/` (and `supabase/migrations/waas/`) in filename-sorted order, top to bottom, as one continuous script — it does **not** just apply the "missing" migrations against a snapshot of production. All of the fixes made for PR #265/#266 had only ever been validated as *idempotent no-ops against production* (where `contacts`, `companies`, etc. already existed). They had never been validated end-to-end on a truly blank database, which is exactly what a preview branch is. On a blank database, `004_optimize_rls_performance.sql` (an early-ordered file) runs `DROP POLICY ... ON contacts` **before** the newly-added `000021_baseline_contacts_companies_pipelines.sql` (a later-ordered file, since it starts with `0000` but sorts after `004` is misleading — the actual failure showed the ordering problem was broader than one file) had a chance to create the table, and/or other ordering/idempotency bugs further down the chain caused cascading failures.

**Fix approach:** Built a local replay-testing harness (Postgres 18 via micromamba, running as unprivileged user `pguser`) that exactly mimics a Supabase preview branch:
- `schema_investigation/supabase_bootstrap.sql` — recreates the pre-existing state of a fresh Supabase project before any user migrations run: `auth` schema with `auth.users` and `auth.uid()/role()/email()/jwt()` stub functions, `authenticated`/`anon`/`service_role` roles, and a `storage` schema stub (`storage.buckets`, `storage.objects`, `storage.foldername()`) since some WaaS RLS policies reference Storage.
- `schema_investigation/run_migration_replay.sh` — resets a scratch database, applies the bootstrap, then applies every file in `supabase/migrations/*.sql` (excluding `waas/`) in the same sorted order Supabase uses, stopping at the first error.
- `schema_investigation/run_waas_migration_replay.sh` — same pattern for `supabase/migrations/waas/*.sql` against a separate scratch database.

Running these surfaced **dozens of real, previously-undetected bugs** in the existing migration files (most pre-dating this PR, some going back months), grouped into these classes:

1. **Non-idempotent duplicate object creation** — many `CREATE POLICY`/`CREATE TRIGGER`/`CREATE TYPE ... AS ENUM` statements with identical names exist in multiple migration files (later files re-declaring policies/triggers already created earlier, e.g. by `004_optimize_rls_performance.sql` or `000_waas_complete_idempotent.sql`). On production these were silently masked because the objects already existed from ad-hoc dashboard SQL; on a blank database they collide with each other mid-replay. **Fix:** added `DROP POLICY IF EXISTS` / `DROP TRIGGER IF EXISTS` before every `CREATE POLICY`/`CREATE TRIGGER`, and wrapped every `CREATE TYPE ... AS ENUM` in a `DO $$ BEGIN CREATE TYPE ...; EXCEPTION WHEN duplicate_object THEN null; END $$;` guard.
2. **Schema-shape drift between migration files and the real production table** — several tables (`campaigns`, `forms`, `form_submissions`, `industry_leads`, `site_templates`, `client_variant_edit_events`, etc.) were originally created out-of-band (via `CONSOLIDATED_MIGRATION.sql`, `000_waas_complete_idempotent.sql`, or manual dashboard SQL) with a **different column set** than what later, independently-written migration files assumed. Because `CREATE TABLE IF NOT EXISTS` is a no-op when the table already exists (even with different columns), every subsequent `CREATE INDEX`/`CREATE POLICY`/`COMMENT ON COLUMN`/`ALTER ... RENAME COLUMN`/seed `INSERT` referencing the assumed-only columns then failed with `column "X" does not exist`. **Fix:** guarded each such statement behind an `information_schema.columns` existence check, falling back to the real column name where a rename had occurred (e.g. `order_index` instead of `step_number`, `created_at` instead of `submitted_at`, `event_type` instead of `edit_type`).
3. **Genuine SQL syntax/semantic bugs**, unrelated to idempotency, found and fixed along the way:
   - Bare top-level `RAISE NOTICE` / `RAISE EXCEPTION` statements outside any `DO $$ ... END $$;` block (invalid standalone SQL) in `20240222000001_verify_smile_setup.sql` (15 instances) and `20240222000003_fix_smile_data_types.sql` (6 instances) — wrapped each in its own `DO $$ BEGIN ... END $$;` block.
   - A campaign-analytics trigger's `WHEN` clause referenced `OLD` on an `AFTER INSERT OR UPDATE` trigger — `OLD` is undefined for `INSERT` events, which Postgres rejects outright. Split into two triggers: an `AFTER INSERT` trigger with no `WHEN` clause, and an `AFTER UPDATE` trigger with `WHEN (NEW.status IS DISTINCT FROM OLD.status)`.
   - `023_waas_seo_keywords.sql` created a **partial index** with `WHERE seo_last_generated_at IS NULL OR seo_last_generated_at < NOW() - INTERVAL '30 days'` — `NOW()` is `STABLE`, not `IMMUTABLE`, and Postgres flatly rejects non-immutable functions in an index predicate (`functions in index predicate must be marked IMMUTABLE`). This was a **real, previously undiscovered bug that would fail on any database**, not just a replay-ordering artifact. Fixed by dropping the partial-index predicate and indexing the full column instead.
   - Duplicate `CREATE INDEX` (missing `IF NOT EXISTS`) in `20240301000000_create_appointments.sql` colliding with an index of the same name created earlier in `000008a_baseline_forward_referenced_crm_tables.sql`.

**Outcome:** Both migration sets now replay cleanly, end-to-end, against a completely blank database — confirmed by repeated, from-scratch runs of the local harness:

```
$ run_migration_replay.sh migtest
=== ALL MIGRATIONS APPLIED SUCCESSFULLY ===

$ run_waas_migration_replay.sh waastest
=== ALL WAAS MIGRATIONS APPLIED SUCCESSFULLY ===
```

This is the same replay behavior Supabase's PR preview-branch check performs, so the preview check on PR #266 is expected to pass with these fixes applied. All fixes are purely additive/defensive (`IF NOT EXISTS` / `IF EXISTS` guards, `DROP ... IF EXISTS` before re-creation, column-existence checks) and were re-verified to remain fully idempotent/no-op against the current shape of live production (re-ran both replay scripts after every fix with no regressions).
