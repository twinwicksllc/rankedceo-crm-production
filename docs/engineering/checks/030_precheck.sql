-- ============================================================================
-- 030 PRE-CHECK  —  run in the rankedceo-waas project (ref klgvdvryewykzlumbkei)
-- Read-only. Every row must say PASS before you apply 030.
-- ============================================================================

-- 1. Am I in the right project? Expect: rankedceo-waas, and BOTH markers NULL.
SELECT 'project' AS check,
       current_database() AS detail,
       CASE WHEN to_regclass('public.organizations') IS NULL
             AND to_regclass('public.ebay_items') IS NULL
            THEN 'PASS' ELSE 'FAIL - this is rankedceo-crm-production' END AS result;

-- 2. Are the 029 (WaaS group) tables already there? Expect 8.
SELECT '029 tables' AS check,
       count(*)::text || ' of 8' AS detail,
       CASE WHEN count(*) = 8 THEN 'PASS' ELSE 'FAIL - apply 029 first' END AS result
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('client_domain_change_requests','client_uploaded_assets',
                    'client_variant_edit_events','notification_log',
                    'tenant_site_deployments','tenant_site_variants',
                    'tenant_site_versions','tenant_variant_regenerations');

-- 3. Are the CRM-group tables still absent? Expect 0 (030 is additive).
SELECT '030 tables absent' AS check,
       count(*)::text || ' already present' AS detail,
       CASE WHEN count(*) = 0 THEN 'PASS'
            ELSE 'NOTE - 030 is idempotent, re-running is safe' END AS result
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('activities','agent_conversations','appointments',
                    'calendly_connections','campaign_emails','campaigns',
                    'commission_rates','commissions','companies','contacts',
                    'crm_billing_events','crm_subscriptions','deals',
                    'email_messages','email_templates','email_threads',
                    'form_fields','form_submissions','forms','industry_leads',
                    'pipeline_stages','pipelines','smile_assessments');

-- 4. RECORD THIS BEFORE APPLYING. The signup trigger must not change.
--    Save the md5 and the trigger list; step 6 of the post-check compares them.
SELECT 'handle_new_user md5' AS check,
       md5(pg_get_functiondef(p.oid)) AS detail,
       'SAVE THIS VALUE' AS result
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';

SELECT 'auth.users triggers' AS check,
       string_agg(t.tgname, ', ' ORDER BY t.tgname) AS detail,
       'SAVE THIS VALUE' AS result
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal;

-- 5. Base shape of the two tables 030 alters. Expect accounts 4, users 6
--    (before 030). If accounts is already 28 / users 15, 030 has run.
SELECT 'accounts columns' AS check, count(*)::text AS detail,
       CASE WHEN count(*) IN (4, 28) THEN 'PASS' ELSE 'CHECK' END AS result
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'accounts';

SELECT 'users columns' AS check, count(*)::text AS detail,
       CASE WHEN count(*) IN (6, 15) THEN 'PASS' ELSE 'CHECK' END AS result
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users';
