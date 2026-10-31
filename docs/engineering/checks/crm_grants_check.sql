-- READ-ONLY check of CRM grants. Run in wcednzaxmxwfiijzmjmx (rankedceo-crm-production).
-- Nothing here changes data or permissions.

-- 1. Functions that RLS policies or app routes need signed-in users to run.
--    Expect: authenticated_exec = true for each. Anything false is a live gap.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_exec,
       p.proacl::text                                            as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_current_user_account_id', 'get_current_user_id',
    'get_user_org_id', 'is_org_member', 'is_org_owner',
    'complete_onboarding', 'update_company_info', 'update_onboarding_step',
    'update_preferences', 'skip_onboarding', 'accept_invitation',
    'get_or_create_conversation', 'add_conversation_message', 'update_conversation_status'
  )
order by p.proname;

-- 2. SECURITY DEFINER functions that anon can run. Expect only functions that are
--    meant to be public (none in the CRM, as of 2026-10-31).
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname;

-- 3. Onboarding RPCs that ignore who is calling (no auth check in the body).
--    Any row here must be fixed before authenticated is granted EXECUTE on it.
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('update_company_info', 'update_onboarding_step', 'complete_onboarding',
                    'update_preferences', 'skip_onboarding')
  and pg_get_functiondef(p.oid) not ilike '%assert_own_account%'
  and pg_get_functiondef(p.oid) not ilike '%auth.uid()%'
  and pg_get_functiondef(p.oid) not ilike '%get_current_user_account_id()%'
order by p.proname;
