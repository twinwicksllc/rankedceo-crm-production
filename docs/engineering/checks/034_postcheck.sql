-- READ-ONLY post-check for 033 and 034. Run in rankedceo-waas SQL Editor AFTER
-- applying both. Every row should read PASS.
--
-- Row 6 is the security goal: the anon insert policy must still allow only the
-- two audit sources. The tenant form inserts through the service role.

select * from (
  select 1 as ord, 'waas_lead_source has tenant_site' as item,
         coalesce(string_agg(e.enumlabel, ',' order by e.enumsortorder), 'none') as detail,
         case when count(*) filter (where e.enumlabel = 'tenant_site') = 1 then 'PASS' else 'FAIL' end as verdict
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'waas_lead_source'

  union all
  select 2, 'leads has message, page_url, service_requested, ip_hash',
         coalesce(string_agg(column_name, ',' order by column_name), 'none'),
         case when count(*) = 4 then 'PASS' else 'FAIL' end
  from information_schema.columns
  where table_schema = 'public' and table_name = 'leads'
    and column_name in ('message', 'page_url', 'service_requested', 'ip_hash')

  union all
  select 3, 'CHECK leads_tenant_site_requires_tenant exists',
         coalesce(string_agg(conname, ','), 'none'),
         case when count(*) = 1 then 'PASS' else 'FAIL' end
  from pg_constraint
  where conrelid = 'public.leads'::regclass and conname = 'leads_tenant_site_requires_tenant'

  union all
  select 4, 'three tenant lead indexes exist',
         coalesce(string_agg(indexname, ',' order by indexname), 'none'),
         case when count(*) = 3 then 'PASS' else 'FAIL' end
  from pg_indexes
  where schemaname = 'public' and tablename = 'leads'
    and indexname in ('idx_leads_tenant_created', 'idx_leads_tenant_ip_created', 'idx_leads_tenant_email_created')

  union all
  select 5, 'no existing lead has source tenant_site yet, or all have a tenant',
         count(*)::text || ' tenant_site row(s) without a tenant',
         case when count(*) = 0 then 'PASS' else 'FAIL' end
  from public.leads where source::text = 'tenant_site' and tenant_id is null

  union all
  select 6, 'anon can only insert audit_tool / email_capture leads',
         coalesce(string_agg(policyname || ': ' || coalesce(with_check, ''), '; '), 'none'),
         case when count(*) = 1
                   and bool_and(with_check ilike '%audit_tool%' and with_check ilike '%email_capture%'
                                and with_check not ilike '%tenant_site%')
              then 'PASS' else 'FAIL' end
  from pg_policies
  where schemaname = 'public' and tablename = 'leads' and cmd = 'INSERT' and 'anon' = any(roles)
) r
order by ord;
