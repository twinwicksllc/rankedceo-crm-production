-- ============================================================================
-- 030 POST-CHECK  —  run in the rankedceo-waas project (ref klgvdvryewykzlumbkei)
-- Run immediately after applying 030. Every row must say PASS.
-- ============================================================================

-- 1. All 23 CRM-group tables exist. Expect 23.
SELECT '030 tables' AS check,
       count(*)::text || ' of 23' AS detail,
       CASE WHEN count(*) = 23 THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('activities','agent_conversations','appointments',
                    'calendly_connections','campaign_emails','campaigns',
                    'commission_rates','commissions','companies','contacts',
                    'crm_billing_events','crm_subscriptions','deals',
                    'email_messages','email_templates','email_threads',
                    'form_fields','form_submissions','forms','industry_leads',
                    'pipeline_stages','pipelines','smile_assessments');

-- 2. RLS is enabled on all 23 (the WaaS rls_auto_enable trigger should have
--    done this; 030 also enables it explicitly). Expect 23.
SELECT 'RLS enabled' AS check,
       count(*) FILTER (WHERE c.relrowsecurity)::text || ' of 23' AS detail,
       CASE WHEN count(*) FILTER (WHERE c.relrowsecurity) = 23
            THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('activities','agent_conversations','appointments',
                    'calendly_connections','campaign_emails','campaigns',
                    'commission_rates','commissions','companies','contacts',
                    'crm_billing_events','crm_subscriptions','deals',
                    'email_messages','email_templates','email_threads',
                    'form_fields','form_submissions','forms','industry_leads',
                    'pipeline_stages','pipelines','smile_assessments');

-- 3. Policies on those tables. Expect 58.
SELECT 'policies' AS check, count(*)::text || ' of 58' AS detail,
       CASE WHEN count(*) = 58 THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('activities','agent_conversations','appointments',
                    'calendly_connections','campaign_emails','campaigns',
                    'commission_rates','commissions','companies','contacts',
                    'crm_billing_events','crm_subscriptions','deals',
                    'email_messages','email_templates','email_threads',
                    'form_fields','form_submissions','forms','industry_leads',
                    'pipeline_stages','pipelines','smile_assessments');

-- 4. Functions created by 030. Expect 27.
SELECT 'functions' AS check, count(*)::text || ' of 27' AS detail,
       CASE WHEN count(*) = 27 THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'add_conversation_message','associate_email_with_contact','auto_create_commission',
  'calculate_commission_amount','complete_onboarding','get_active_commission_rate',
  'get_current_user_account_id','get_current_user_id','get_or_create_conversation',
  'get_smile_account_id','get_smile_pool_account_id','handle_industry_updated_at',
  'handle_updated_at','set_crm_subscriptions_updated_at','set_updated_at',
  'skip_onboarding','submit_smile_assessment_with_pool',
  'update_agent_conversations_updated_at','update_commission_on_deal_change',
  'update_commission_rates_updated_at','update_commissions_updated_at',
  'update_company_info','update_conversation_status','update_onboarding_step',
  'update_preferences','update_thread_stats','update_updated_at_column');

-- 5. Table triggers. Expect 22.
SELECT 'triggers' AS check, count(*)::text || ' of 22' AS detail,
       CASE WHEN count(*) = 22 THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND c.relname IN ('activities','agent_conversations','appointments',
                    'calendly_connections','campaign_emails','campaigns',
                    'commission_rates','commissions','companies','contacts',
                    'crm_billing_events','crm_subscriptions','deals',
                    'email_messages','email_templates','email_threads',
                    'form_fields','form_submissions','forms','industry_leads',
                    'pipeline_stages','pipelines','smile_assessments');

-- 6. THE IMPORTANT ONE: the signup trigger is untouched.
--    Compare the md5 with the value you saved in pre-check step 4.
SELECT 'handle_new_user md5' AS check,
       md5(pg_get_functiondef(p.oid)) AS detail,
       'MUST EQUAL THE PRE-CHECK VALUE' AS result
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';

SELECT 'auth.users triggers' AS check,
       string_agg(t.tgname, ', ' ORDER BY t.tgname) AS detail,
       'MUST EQUAL THE PRE-CHECK VALUE' AS result
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal;

-- 7. Column counts after 030. Expect accounts 28, users 15.
SELECT 'accounts columns' AS check, count(*)::text || ' of 28' AS detail,
       CASE WHEN count(*) = 28 THEN 'PASS' ELSE 'CHECK' END AS result
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'accounts';

SELECT 'users columns' AS check, count(*)::text || ' of 15' AS detail,
       CASE WHEN count(*) = 15 THEN 'PASS' ELSE 'CHECK' END AS result
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users';

-- 8. Signup safety: no NOT NULL column without a default was added to
--    accounts/users. Expect 0 rows. Any row here breaks every new sign-up.
SELECT 'NOT NULL w/o default' AS check,
       table_name || '.' || column_name AS detail, 'FAIL' AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('accounts','users')
  AND is_nullable = 'NO'
  AND column_default IS NULL
  AND column_name NOT IN ('id','name','account_id','full_name','avatar_url',
                          'created_at','updated_at');  -- the 027 base columns

-- 9. Smoke test: prove a real sign-up still works end to end.
--    Inserting into auth.users fires on_auth_user_created, whose
--    handle_new_user() writes accounts(name) + users(id, account_id,
--    full_name, avatar_url). We insert ONLY the auth row and then assert the
--    trigger produced a profile — that is the thing 030 must not break.
--    (An earlier version of this check inserted public.users by hand and
--    failed on users_id_fkey / users_pkey: the trigger had already done it.)
DO $$
DECLARE v_auth uuid := gen_random_uuid(); v_rows int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_auth, '__030_smoke__@example.invalid');

  SELECT count(*) INTO v_rows FROM public.users WHERE id = v_auth;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'FAIL - handle_new_user did not create the profile (rows=%)', v_rows;
  END IF;

  DELETE FROM public.users WHERE id = v_auth;
  DELETE FROM public.accounts
   WHERE id NOT IN (SELECT account_id FROM public.users WHERE account_id IS NOT NULL)
     AND name = 'My Account';
  DELETE FROM auth.users WHERE id = v_auth;

  RAISE NOTICE 'PASS - sign-up still creates a profile (handle_new_user intact)';
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'FAIL - signup shape broken: %', SQLERRM;
END $$;
