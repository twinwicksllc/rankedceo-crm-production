-- READ-ONLY post-check for 032. Run in rankedceo-waas SQL Editor AFTER applying 032.
-- Every row should read PASS.
--
-- Row 4 is the programme-level goal: no anon-callable SECURITY DEFINER function
-- in public except resolve_tenant_by_hostname and get_smile_pool_account_id
-- (030 grants the latter to anon; it only returns the fixed pool id).

with fn as (
  select p.oid, p.proname,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_exec,
         has_function_privilege('service_role', p.oid, 'EXECUTE') as svc_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
)
select * from (
  select 1 as ord, 'submit_smile_assessment_with_pool exists' as item,
         count(*)::text || ' function(s)' as detail,
         case when count(*) >= 1 then 'PASS' else 'FAIL' end as verdict
  from fn where proname = 'submit_smile_assessment_with_pool'

  union all
  select 2, 'submit_smile_assessment_with_pool: no anon, no authenticated',
         coalesce(string_agg(proname, ',') filter (where anon_exec or authed_exec), 'none'),
         case when count(*) filter (where anon_exec or authed_exec) = 0 then 'PASS' else 'FAIL' end
  from fn where proname = 'submit_smile_assessment_with_pool'

  union all
  select 3, 'submit_smile_assessment_with_pool: service_role kept',
         count(*) filter (where svc_exec)::text || ' of ' || count(*)::text,
         case when count(*) > 0 and count(*) filter (where svc_exec) = count(*) then 'PASS' else 'FAIL' end
  from fn where proname = 'submit_smile_assessment_with_pool'

  union all
  select 6, 'get_smile_account_id: no anon, authenticated kept',
         coalesce(string_agg(proname, ',') filter (where anon_exec or not authed_exec), 'none'),
         case when count(*) >= 1 and count(*) filter (where anon_exec or not authed_exec) = 0
              then 'PASS' else 'FAIL' end
  from fn where proname = 'get_smile_account_id'

  union all
  select 4, 'anon-callable SECURITY DEFINER functions (only the two allowed)',
         coalesce(string_agg(proname, ',' order by proname) filter (where anon_exec), 'none'),
         case when count(*) filter (where anon_exec
                and proname not in ('resolve_tenant_by_hostname', 'get_smile_pool_account_id')) = 0
              then 'PASS' else 'FAIL' end
  from fn

  union all
  select 5, 'resolve_tenant_by_hostname still anon-callable',
         coalesce(string_agg(proname, ',') filter (where anon_exec), 'none'),
         case when count(*) filter (where anon_exec) = 1 then 'PASS' else 'FAIL' end
  from fn where proname = 'resolve_tenant_by_hostname'
) t
order by ord;
