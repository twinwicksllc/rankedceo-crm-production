-- READ-ONLY post-check for 031. Run in rankedceo-waas SQL Editor AFTER applying 031.
-- Every row should read PASS.

with fn as (
  select p.oid, p.proname,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_exec,
         has_function_privilege('service_role', p.oid, 'EXECUTE') as svc_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
)
select * from (
  select 1 as ord, 'no anon EXECUTE on onboarding RPCs' as item,
         coalesce(string_agg(proname, ',') filter (where anon_exec), 'none') as detail,
         case when count(*) filter (where anon_exec) = 0 then 'PASS' else 'FAIL' end as verdict
  from fn where proname in ('complete_onboarding','update_company_info','update_onboarding_step','skip_onboarding','update_preferences')

  union all
  select 2, 'no anon EXECUTE on trigger functions',
         coalesce(string_agg(proname, ',') filter (where anon_exec), 'none'),
         case when count(*) filter (where anon_exec) = 0 then 'PASS' else 'FAIL' end
  from fn where proname in ('handle_new_user','handle_updated_at','handle_user_delete','auto_create_commission','update_commission_on_deal_change','expire_old_audits','rls_auto_enable')

  union all
  select 3, 'authenticated still has EXECUTE on onboarding RPCs',
         count(*) filter (where authed_exec)::text || ' of 5',
         case when count(*) filter (where authed_exec) = 5 then 'PASS' else 'FAIL' end
  from fn where proname in ('complete_onboarding','update_company_info','update_onboarding_step','skip_onboarding','update_preferences')

  union all
  select 4, 'authenticated still has EXECUTE on get_current_user_account_id (RLS needs it)',
         coalesce(string_agg(proname, ',') filter (where authed_exec), 'none'),
         case when count(*) filter (where authed_exec) = 1 then 'PASS' else 'FAIL' end
  from fn where proname = 'get_current_user_account_id'

  union all
  select 5, 'resolve_tenant_by_hostname still anon-callable',
         coalesce(string_agg(proname, ',') filter (where anon_exec), 'none'),
         case when count(*) filter (where anon_exec) = 1 then 'PASS' else 'FAIL' end
  from fn where proname = 'resolve_tenant_by_hostname'

  union all
  select 6, 'audit RPCs: service_role only (no anon, no authenticated)',
         coalesce(string_agg(proname, ',') filter (where anon_exec or authed_exec), 'none'),
         case when count(*) filter (where anon_exec or authed_exec) = 0 then 'PASS' else 'FAIL' end
  from fn where proname in ('capture_audit_lead','create_prospect_audit','get_audit_status')

  union all
  select 7, 'assert_own_account exists',
         coalesce(string_agg(proname, ','), 'missing'),
         case when count(*) = 1 then 'PASS' else 'FAIL' end
  from fn where proname = 'assert_own_account'

  union all
  select 8, 'anon cannot TRUNCATE public tables',
         count(*)::text || ' table(s) still grant TRUNCATE to anon',
         case when count(*) = 0 then 'PASS' else 'FAIL' end
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' and privilege_type = 'TRUNCATE'

  union all
  -- Row 9 tests only the default-ACL row of roles that OWN a public function.
  -- A row owned by a role that owns nothing is dormant and is reported by
  -- docs/engineering/checks/default_acl_audit.sql instead of failing here.
  -- ACL items are unnested, so a PUBLIC entry is found wherever it sits, and a
  -- missing row is a FAIL because PostgreSQL then falls back to PUBLIC EXECUTE.
  select 9, 'default ACL: owners of public functions grant no anon/authenticated/PUBLIC EXECUTE',
         coalesce((select string_agg(d.defaclrole::regrole::text || ' -> ' || d.defaclacl::text, ' | ')
                   from pg_default_acl d
                   where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'
                     and d.defaclrole::regrole::text in (
                       select distinct pg_get_userbyid(p.proowner)
                       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public')), 'none'),
         case when not exists (
                select 1
                from (select distinct pg_get_userbyid(p.proowner) as owner_role
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public') o
                where not exists (
                  select 1 from pg_default_acl d
                  where d.defaclnamespace = 'public'::regnamespace
                    and d.defaclobjtype = 'f'
                    and d.defaclrole::regrole::text = o.owner_role
                    and not exists (
                      select 1 from unnest(d.defaclacl) a
                      where a::text like 'anon=X%'
                         or a::text like 'authenticated=X%'
                         or a::text like '=X%')))
              then 'PASS' else 'FAIL' end

  union all
  select 10, 'handle_new_user body unchanged (compare to pre-check md5)',
         md5(pg_get_functiondef(p.oid)),
         'SAVE THIS VALUE'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'handle_new_user'
) t
order by ord;
