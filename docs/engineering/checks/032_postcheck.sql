-- READ-ONLY post-check for 032. Run in rankedceo-waas SQL Editor AFTER applying 032.
-- Every row should read PASS. This is the follow-up to 031_postcheck.sql row 9,
-- which is the row that was still failing.

with d as (
  select defaclrole::regrole::text as owner_role,
         defaclacl::text as acl
  from pg_default_acl
  where defaclnamespace = 'public'::regnamespace
    and defaclobjtype = 'f'
)
select * from (
  select 1 as ord,
         'postgres/public/f: no anon, no authenticated, no PUBLIC' as item,
         coalesce((select acl from d where owner_role = 'postgres'), 'no row') as detail,
         case when not exists (
                select 1 from d
                where owner_role = 'postgres'
                  and (acl like '%anon=X%' or acl like '%authenticated=X%' or acl like '%{=X%')
              ) then 'PASS' else 'FAIL' end as verdict

  union all
  select 2,
         'supabase_admin/public/f: no anon, no authenticated, no PUBLIC',
         coalesce((select acl from d where owner_role = 'supabase_admin'), 'no row'),
         case when not exists (
                select 1 from d
                where owner_role = 'supabase_admin'
                  and (acl like '%anon=X%' or acl like '%authenticated=X%' or acl like '%{=X%')
              ) then 'PASS' else 'FAIL' end

  union all
  select 3,
         'service_role still has EXECUTE on future public functions (both owners)',
         coalesce((select string_agg(owner_role, ',') from d where acl like '%service_role=X%'), 'none'),
         case when (select count(*) from d where acl like '%service_role=X%') = 2
              then 'PASS' else 'FAIL' end

  union all
  select 4,
         'no other role grants anon EXECUTE on future public functions',
         coalesce((select string_agg(owner_role, ',') from d where acl like '%anon=X%'), 'none'),
         case when not exists (select 1 from d where acl like '%anon=X%')
              then 'PASS' else 'FAIL' end
) t
order by ord;
