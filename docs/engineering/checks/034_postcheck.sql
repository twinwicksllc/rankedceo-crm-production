-- READ-ONLY post-check for migrations 033, 034 and 035. Run in rankedceo-waas SQL Editor AFTER applying all three.
-- Every column should read PASS. Written as independent scalar checks (tested on a throwaway Postgres 16).

select
 (select case when exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
          where t.typname = 'waas_lead_source' and e.enumlabel = 'tenant_site') then 'PASS' else 'FAIL' end) as check_1_source_value,
 (select case when (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'leads'
            and column_name in ('message','page_url','service_requested','ip_hash')) = 4 then 'PASS' else 'FAIL' end) as check_2_columns,
 (select case when exists (select 1 from pg_constraint
          where conrelid = 'public.leads'::regclass and conname = 'leads_tenant_site_requires_tenant') then 'PASS' else 'FAIL' end) as check_3_constraint,
 (select case when (select count(*) from pg_indexes
          where schemaname = 'public' and tablename = 'leads'
            and indexname in ('idx_leads_tenant_created','idx_leads_tenant_ip_created','idx_leads_tenant_email_created')) = 3 then 'PASS' else 'FAIL' end) as check_4_indexes,
 (select case when (select count(*) from public.leads
          where source::text = 'tenant_site' and tenant_id is null) = 0 then 'PASS' else 'FAIL' end) as check_5_no_orphans,
 (select case when coalesce((select with_check from pg_policies
          where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_anon_insert'), '') ilike '%tenant_site%'
          then 'FAIL' else 'PASS' end) as check_6_anon_policy_unchanged,
 (select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'insert_tenant_lead_limited')
          and not has_function_privilege('anon', 'public.insert_tenant_lead_limited(uuid,jsonb,timestamptz,int,int,text,text)', 'execute')
          and not has_function_privilege('authenticated', 'public.insert_tenant_lead_limited(uuid,jsonb,timestamptz,int,int,text,text)', 'execute')
          then 'PASS' else 'FAIL' end) as check_7_limit_function_locked;
