-- ROLLBACK for crm_grants_fix.DRAFT.sql. Not applied. Target: rankedceo-crm-production (wcednzaxmxwfiijzmjmx).
-- Restores the state read from the live CRM database on 2026-10-31:
--   * the five onboarding functions with their ORIGINAL bodies (no ownership guard);
--   * EXECUTE held only by the owner (postgres) and service_role, as in the live ACLs;
--   * no assert_own_account function.
-- WARNING: this puts back the state where signed-in users cannot run RLS helpers or the
-- onboarding RPCs. Use it only to undo the fix; it is not a safe end state.
-- Run only if the fix was applied and something went wrong. Verify with crm_grants_check.sql.

begin;

-- 1. Original onboarding function bodies, exactly as read live on 2026-10-31.
create or replace function public.update_company_info(
  p_account_id uuid, p_name varchar, p_company_size varchar, p_industry varchar,
  p_website varchar, p_phone varchar, p_address text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
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
    update accounts set onboarding_step = p_step where id = p_account_id;
end;
$$;

create or replace function public.complete_onboarding(p_account_id uuid)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
    update accounts
    set onboarding_completed = true, onboarding_completed_at = now(), onboarding_step = 5
    where id = p_account_id;
end;
$$;

create or replace function public.update_preferences(p_account_id uuid, p_timezone varchar, p_settings jsonb)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
    update accounts set timezone = p_timezone, settings = p_settings where id = p_account_id;
end;
$$;

create or replace function public.skip_onboarding(p_account_id uuid)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
    update accounts
    set onboarding_skipped = true, onboarding_completed = true, onboarding_completed_at = now()
    where id = p_account_id;
end;
$$;

-- 2. Put the live ACLs back: owner + service_role only.
revoke all on function public.get_current_user_account_id()  from public, anon, authenticated;
revoke all on function public.get_current_user_id()          from public, anon, authenticated;
revoke all on function public.update_company_info(uuid, varchar, varchar, varchar, varchar, varchar, text) from public, anon, authenticated;
revoke all on function public.update_onboarding_step(uuid, integer)  from public, anon, authenticated;
revoke all on function public.complete_onboarding(uuid)              from public, anon, authenticated;
revoke all on function public.update_preferences(uuid, varchar, jsonb) from public, anon, authenticated;
revoke all on function public.skip_onboarding(uuid)                  from public, anon, authenticated;

grant execute on function public.get_current_user_account_id()  to service_role;
grant execute on function public.get_current_user_id()          to service_role;
grant execute on function public.update_company_info(uuid, varchar, varchar, varchar, varchar, varchar, text) to service_role;
grant execute on function public.update_onboarding_step(uuid, integer)  to service_role;
grant execute on function public.complete_onboarding(uuid)              to service_role;
grant execute on function public.update_preferences(uuid, varchar, jsonb) to service_role;
grant execute on function public.skip_onboarding(uuid)                  to service_role;

-- (get_user_org_id, is_org_member, is_org_owner already allowed authenticated live and are not changed by the fix or this rollback.)

-- 3. Remove the guard added by the fix.
drop function if exists public.assert_own_account(uuid);

commit;
