-- READ-ONLY audit of default privileges for functions in schema public.
-- Run in rankedceo-waas SQL Editor. Nothing is changed.
--
-- Why this file exists instead of migration 032:
-- 031 fixed the default-ACL row owned by `postgres`. A second row owned by
-- `supabase_admin` still grants anon/authenticated EXECUTE on functions that
-- supabase_admin would create in public. That row CANNOT be changed from the
-- SQL Editor: ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin requires
-- membership in supabase_admin, and the editor always runs as `postgres`
-- (verified live: pg_has_role('postgres','supabase_admin','MEMBER') = false).
--
-- It is also DORMANT here: every function in public is owned by postgres
-- (verified live: 39 functions, 26 SECURITY DEFINER, 0 owned by supabase_admin),
-- so the row describes a thing that does not currently happen.
--
-- This audit therefore reports the real risk rather than asserting a state that
-- cannot be reached: a default-ACL row only matters if its owner actually owns
-- functions in the schema.
--
-- ACL parsing notes (these were bugs in the withdrawn 032_postcheck.sql):
--   * `defaclacl` is an aclitem[]; unnest it and test each element, so a PUBLIC
--     entry is detected wherever it sits in the list, not only first.
--   * a missing default-ACL row is reported as MISSING, not as PASS. With no
--     row, PostgreSQL falls back to the built-in default, which grants EXECUTE
--     to PUBLIC on new functions.
--   * the owner's own grant is expected and is not treated as a finding.

with fn_owners as (
  select distinct pg_get_userbyid(p.proowner) as owner_role
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
acl as (
  select d.defaclrole::regrole::text as owner_role,
         d.defaclacl,
         exists (select 1 from unnest(d.defaclacl) a where a::text like 'anon=X%')          as grants_anon,
         exists (select 1 from unnest(d.defaclacl) a where a::text like 'authenticated=X%') as grants_authed,
         exists (select 1 from unnest(d.defaclacl) a where a::text like '=X%')              as grants_public,
         exists (select 1 from unnest(d.defaclacl) a where a::text like 'service_role=X%')  as grants_service
  from pg_default_acl d
  where d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'f'
)
select * from (
  -- 1. The row that matters: the owner of the existing functions.
  select 1 as ord,
         'postgres/public/f exists and grants no anon, authenticated or PUBLIC' as item,
         coalesce((select owner_role || ' -> ' || defaclacl::text from acl where owner_role = 'postgres'),
                  'MISSING ROW (falls back to PUBLIC EXECUTE)') as detail,
         case when exists (
                select 1 from acl
                where owner_role = 'postgres'
                  and not grants_anon and not grants_authed and not grants_public
              ) then 'PASS' else 'FAIL' end as verdict

  union all
  -- 2. service_role must still be able to call future functions.
  select 2,
         'postgres/public/f still grants service_role',
         coalesce((select 'service_role=' || grants_service::text from acl where owner_role = 'postgres'), 'no row'),
         case when exists (select 1 from acl where owner_role = 'postgres' and grants_service)
              then 'PASS' else 'FAIL' end

  union all
  -- 3. Every role that actually owns a public function must have a clean row.
  --    This is the check that would catch a future function created by a role
  --    whose default ACL is still permissive.
  select 3,
         'every owner of a public function has a clean default-ACL row',
         coalesce((select string_agg(o.owner_role, ',')
                   from fn_owners o
                   where not exists (
                     select 1 from acl a
                     where a.owner_role = o.owner_role
                       and not a.grants_anon and not a.grants_authed and not a.grants_public
                   )), 'none') as detail,
         case when not exists (
                select 1 from fn_owners o
                where not exists (
                  select 1 from acl a
                  where a.owner_role = o.owner_role
                    and not a.grants_anon and not a.grants_authed and not a.grants_public
                )
              ) then 'PASS' else 'FAIL' end

  union all
  -- 4. Informational: permissive rows owned by roles that own NO public
  --    function. Dormant today; becomes a finding the moment such a role
  --    creates a function. Reported, not failed.
  select 4,
         'INFO: permissive default-ACL rows for roles that own no public function',
         coalesce((select string_agg(a.owner_role, ',')
                   from acl a
                   where (a.grants_anon or a.grants_authed or a.grants_public)
                     and not exists (select 1 from fn_owners o where o.owner_role = a.owner_role)),
                  'none'),
         'INFO'
) t
order by ord;
