-- DRAFT ONLY. Not applied. Do not run until reviewed and the open items below are closed.
-- Target: rankedceo-crm-production (wcednzaxmxwfiijzmjmx).
-- Purpose: restore the EXECUTE grants the CRM's RLS policies and onboarding routes need,
-- without re-opening the unchecked-account update hole that migration 031 closed in WaaS.

begin;

-- A. Helpers that RLS policies call as the signed-in user.
--    Revoke from PUBLIC and anon first, then grant to authenticated only.
revoke all on function public.get_current_user_account_id() from public, anon;
revoke all on function public.get_current_user_id()         from public, anon;
revoke all on function public.get_user_org_id(uuid)         from public, anon;
revoke all on function public.is_org_member(uuid, uuid)     from public, anon;
revoke all on function public.is_org_owner(uuid, uuid)      from public, anon;

grant execute on function public.get_current_user_account_id() to authenticated, service_role;
grant execute on function public.get_current_user_id()         to authenticated, service_role;
grant execute on function public.get_user_org_id(uuid)         to authenticated, service_role;
grant execute on function public.is_org_member(uuid, uuid)     to authenticated, service_role;
grant execute on function public.is_org_owner(uuid, uuid)      to authenticated, service_role;

-- B. Ownership guard for the onboarding RPCs. Matches the caller's own account only.
create or replace function public.assert_own_account(p_account_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Server-side callers using the service-role key act for the whole platform.
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return;
  end if;
  if p_account_id is null or p_account_id is distinct from public.get_current_user_account_id() then
    raise exception 'not allowed: account % is not the caller''s account', p_account_id
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_own_account(uuid) from public, anon;
grant execute on function public.assert_own_account(uuid) to authenticated, service_role;

-- C. Onboarding RPCs: add the guard, then grant authenticated.
--    Bodies below were read from the live database on 2026-10-31 and only gain the guard.
create or replace function public.update_company_info(
  p_account_id uuid, p_name varchar, p_company_size varchar, p_industry varchar,
  p_website varchar, p_phone varchar, p_address text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  perform public.assert_own_account(p_account_id);
  update accounts
     set name = p_name, company_size = p_company_size, industry = p_industry,
         website = p_website, phone = p_phone, address = p_address, onboarding_step = 2
   where id = p_account_id;
end;
$$;

create or replace function public.update_onboarding_step(p_account_id uuid, p_step integer)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  perform public.assert_own_account(p_account_id);
  update accounts set onboarding_step = p_step where id = p_account_id;
end;
$$;

create or replace function public.complete_onboarding(p_account_id uuid)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  perform public.assert_own_account(p_account_id);
  update accounts
     set onboarding_completed = true, onboarding_completed_at = now(), onboarding_step = 5
   where id = p_account_id;
end;
$$;

create or replace function public.update_preferences(p_account_id uuid, p_timezone varchar, p_settings jsonb)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  perform public.assert_own_account(p_account_id);
  update accounts set timezone = p_timezone, settings = p_settings where id = p_account_id;
end;
$$;

create or replace function public.skip_onboarding(p_account_id uuid)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  perform public.assert_own_account(p_account_id);
  update accounts
     set onboarding_skipped = true, onboarding_completed = true, onboarding_completed_at = now()
   where id = p_account_id;
end;
$$;

revoke all on function public.update_preferences(uuid, varchar, jsonb) from public, anon;
revoke all on function public.skip_onboarding(uuid) from public, anon;
grant execute on function public.update_preferences(uuid, varchar, jsonb) to authenticated, service_role;
grant execute on function public.skip_onboarding(uuid) to authenticated, service_role;

revoke all on function public.update_company_info(uuid, varchar, varchar, varchar, varchar, varchar, text) from public, anon;
revoke all on function public.update_onboarding_step(uuid, integer) from public, anon;
revoke all on function public.complete_onboarding(uuid) from public, anon;
grant execute on function public.update_company_info(uuid, varchar, varchar, varchar, varchar, varchar, text) to authenticated, service_role;
grant execute on function public.update_onboarding_step(uuid, integer) to authenticated, service_role;
grant execute on function public.complete_onboarding(uuid) to authenticated, service_role;

-- D. Not in this draft yet:
--    get_or_create_conversation, add_conversation_message, update_conversation_status.
--    No call found in app code, and their bodies take any conversation id with no ownership
--    check. Leave them revoked; if a use turns up, add a guard before granting.
--    get_current_user_account_id / get_current_user_id also match on email as well as
--    auth.uid(). Live data today: 1 user, 0 duplicate emails, so no collision now,
--    but the email fallback is a design risk to decide on separately.

commit;
