-- READ-ONLY. Run in rankedceo-waas SQL Editor. Changes nothing.
-- Result 1: who can EXECUTE each SECURITY DEFINER function in public
select p.proname as fn,
       pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_exec,
       p.proacl::text as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by p.proname;

-- Result 2 (run separately): default privileges that Supabase applies to new objects
select defaclrole::regrole::text as owner_role,
       defaclnamespace::regnamespace::text as in_schema,
       defaclobjtype as obj_type,
       defaclacl::text as acl
from pg_default_acl
order by 1, 2, 3;
