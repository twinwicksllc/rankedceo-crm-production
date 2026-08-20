# QA Agent — Purging QA Data

This document explains how QA test data is tagged, how to purge it, and what to do if a purge is needed in production-adjacent environments.

---

## Why QA data is tagged

The QA agent runs in the same Supabase project as production (`rankedceo-waas`), using a dedicated `qa` schema. Every record the agent writes to the database is tagged with a run tag in the format:

```
qa_agent_YYYYMMDD_HHMMSS_<hex>
```

For example: `qa_agent_20240115_060142_a3f9b2`

The tag is stored in the `run_tag` column of `qa.qa_runs`. It is derived from the run ID, which is generated at the start of each run in `cli.ts`.

This tagging strategy means:

- QA records are easy to identify and purge without touching production data
- The `run_tag` format sorts chronologically
- A single tag covers the entire run (all findings, the HTML report, the run status)

---

## What data the QA agent writes

| Schema | Table             | When written                |
| ------ | ----------------- | --------------------------- |
| `qa`   | `qa.qa_runs`      | Once per run, at completion |
| `qa`   | `qa.qa_scenarios` | When saved via Admin UI     |

The QA agent does **not** write to the `public` schema. The `SupabaseAdapter` is initialised with `{ db: { schema: 'qa' } }` so all queries target the `qa` schema only.

> **Exception:** The `full_lifecycle.yaml` and `edge_02_billing_error.yaml` scenarios initiate a real Stripe test-mode checkout, which causes Stripe to fire a webhook that creates records in the `public.subscriptions` table. See the "Purging Stripe test data" section below.

---

## Purging via the Admin UI

1. Navigate to `/admin/qa-reports`
2. Click the **Purge All QA Runs** button (red button, bottom of page)
3. Confirm the dialog
4. All records in `qa.qa_runs` are deleted

This uses the `purgeQaRuns()` server action in `lib/waas/actions/qa.ts`, which executes:

```sql
DELETE FROM qa.qa_runs WHERE run_tag LIKE 'qa_agent_%'
```

> The `qa_scenarios` table is **not** purged by this button — scenarios created via the Admin UI are preserved.

---

## Purging via Supabase SQL editor

For more targeted purging, use the Supabase SQL editor:

### Purge all QA runs

```sql
DELETE FROM qa.qa_runs WHERE run_tag LIKE 'qa_agent_%';
```

### Purge a specific run

```sql
DELETE FROM qa.qa_runs WHERE run_id = 'your-run-id-here';
```

### Purge runs older than 30 days

```sql
DELETE FROM qa.qa_runs WHERE created_at < NOW() - INTERVAL '30 days';
```

### Purge runs in a date range

```sql
DELETE FROM qa.qa_runs
WHERE run_tag >= 'qa_agent_20240101'
  AND run_tag <  'qa_agent_20240201';
```

(This works because `run_tag` sorts chronologically.)

---

## Purging via the CLI (SupabaseAdapter)

The `SupabaseAdapter` exposes a `purgeAgentRecords(runTag)` method. You can call it from a one-off script:

```ts
import { SupabaseAdapter } from "./qa-agent/src/adaptors/supabase/SupabaseAdapter.js";

const db = new SupabaseAdapter(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
await db.purgeAgentRecords("qa_agent_20240115_060142_a3f9b2");
console.log("Purge complete");
```

---

## Purging Stripe test data

If you ran the full lifecycle or billing edge case scenarios in Stripe test mode, test subscriptions, customers, and invoices may have been created in your Stripe test environment. These are completely isolated from production (test mode data never touches live mode).

To clean up Stripe test data:

1. Log in to the [Stripe Dashboard](https://dashboard.stripe.com)
2. Ensure you are in **Test mode** (toggle in the top-left)
3. Navigate to **Customers** and filter by the QA test email address (`QA_CLIENT_REVIEW_TOKEN` owner's email)
4. Delete the test customer — this also deletes associated subscriptions and invoices

Alternatively, use the Stripe CLI:

```bash
stripe customers list --limit 10
stripe customers delete cus_xxxxx
```

> Stripe test data does not affect billing, reporting, or production subscriptions. Cleanup is optional but keeps the test environment clean.

---

## Automatic retention policy (recommended)

To avoid manual purging, set up a Supabase cron job (using `pg_cron`) to purge old QA runs automatically:

```sql
-- Delete QA runs older than 60 days (run daily at 02:00 UTC)
SELECT cron.schedule(
  'purge-old-qa-runs',
  '0 2 * * *',
  $$DELETE FROM qa.qa_runs WHERE created_at < NOW() - INTERVAL '60 days'$$
);
```

Enable `pg_cron` in the Supabase dashboard under **Database → Extensions**.

---

## Verifying no QA data leaked into production tables

Run this query in the Supabase SQL editor to confirm no QA records are in the `public` schema:

```sql
-- Check for QA-tagged records that may have leaked
SELECT table_schema, table_name, count(*)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
-- This is a schema check only; run the next queries if you need row-level checks

-- Check subscriptions created by QA agent test accounts
SELECT * FROM public.subscriptions
WHERE metadata->>'run_tag' LIKE 'qa_agent_%';

-- Check tenants created by QA agent
SELECT * FROM public.tenants
WHERE name LIKE 'qa_agent_%' OR email LIKE '%qa_test%';
```

If records are found, they should be deleted manually. This situation should not occur with the current setup because the QA agent uses an existing test account (`QA_CLIENT_REVIEW_TOKEN`) rather than creating new tenants.
