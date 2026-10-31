-- Local throwaway harness. Mimics the live CRM state found on 2026-10-31. Not a copy of production.
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated, service_role;

-- Supabase-style stubs and default privileges (new functions are executable by anon/authenticated).
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb, '{}'::jsonb) $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;

create table public.accounts (id uuid primary key, name text, company_size text, industry text, website text,
  phone text, address text, timezone text, settings jsonb, onboarding_step int default 1,
  onboarding_completed boolean default false, onboarding_completed_at timestamptz, onboarding_skipped boolean default false);
create table public.users (id uuid primary key, email text, account_id uuid references public.accounts(id));
create table public.contacts (id serial primary key, account_id uuid references public.accounts(id), name text);
create table public.org_members (user_id uuid, org_id uuid, role text);
alter table public.accounts enable row level security;
alter table public.users enable row level security;
alter table public.contacts enable row level security;
alter table public.org_members enable row level security;

-- Live function bodies, as read on 2026-10-31.
create function public.get_current_user_account_id() returns uuid language plpgsql stable security definer set search_path to '' as $$
declare v uuid; begin
  select account_id into v from public.users where id = auth.uid() or email = auth.jwt() ->> 'email' limit 1; return v; end $$;
create function public.get_current_user_id() returns uuid language plpgsql stable security definer set search_path to '' as $$
declare v uuid; begin
  select id into v from public.users where id = auth.uid() or email = auth.jwt() ->> 'email' limit 1; return v; end $$;
create function public.get_user_org_id(_user_id uuid) returns uuid language sql stable security definer set search_path to 'public' as
  $$ select org_id from public.org_members where user_id = _user_id limit 1 $$;
create function public.is_org_member(_user_id uuid, _org_id uuid) returns boolean language sql stable security definer set search_path to 'public' as
  $$ select exists (select 1 from public.org_members where user_id=_user_id and org_id=_org_id) $$;
create function public.is_org_owner(_user_id uuid, _org_id uuid) returns boolean language sql stable security definer set search_path to 'public' as
  $$ select exists (select 1 from public.org_members where user_id=_user_id and org_id=_org_id and role='owner') $$;
create function public.update_company_info(p_account_id uuid, p_name varchar, p_company_size varchar, p_industry varchar, p_website varchar, p_phone varchar, p_address text)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin update accounts set name=p_name, company_size=p_company_size, industry=p_industry, website=p_website, phone=p_phone, address=p_address, onboarding_step=2 where id=p_account_id; end $$;
create function public.update_onboarding_step(p_account_id uuid, p_step integer) returns void language plpgsql security definer set search_path to 'public' as
  $$ begin update accounts set onboarding_step=p_step where id=p_account_id; end $$;
create function public.complete_onboarding(p_account_id uuid) returns void language plpgsql security definer set search_path to 'public' as
  $$ begin update accounts set onboarding_completed=true, onboarding_completed_at=now(), onboarding_step=5 where id=p_account_id; end $$;
create function public.update_preferences(p_account_id uuid, p_timezone varchar, p_settings jsonb) returns void language plpgsql security definer set search_path to 'public' as
  $$ begin update accounts set timezone=p_timezone, settings=p_settings where id=p_account_id; end $$;
create function public.skip_onboarding(p_account_id uuid) returns void language plpgsql security definer set search_path to 'public' as
  $$ begin update accounts set onboarding_skipped=true, onboarding_completed=true, onboarding_completed_at=now() where id=p_account_id; end $$;

-- Live ACL state: only owner + service_role.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.prokind='f' loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop; end $$;

grant execute on function public.get_user_org_id(uuid), public.is_org_member(uuid,uuid), public.is_org_owner(uuid,uuid) to authenticated;

-- Policies as on the live CRM (representative subset).
create policy accounts_select on public.accounts for select to authenticated using (id = get_current_user_account_id());
create policy accounts_update on public.accounts for update to authenticated using (id = get_current_user_account_id()) with check (id = get_current_user_account_id());
create policy contacts_all on public.contacts for all to authenticated using (account_id = get_current_user_account_id()) with check (account_id = get_current_user_account_id());
create policy users_self on public.users for select to authenticated using (id = auth.uid());

-- Data.
insert into public.accounts(id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','Account A'),('bbbbbbbb-0000-0000-0000-000000000002','Account B');
insert into public.users values ('a1a1a1a1-0000-0000-0000-000000000001','a@example.com','aaaaaaaa-0000-0000-0000-000000000001'),
                                ('b2b2b2b2-0000-0000-0000-000000000002','b@example.com','bbbbbbbb-0000-0000-0000-000000000002');
insert into public.contacts(account_id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','A contact'),('bbbbbbbb-0000-0000-0000-000000000002','B contact');

-- Test runner: runs a statement as a role/user, reports OK / ERR / value.
create table public.results(phase text, label text, expected text, actual text, pass boolean);
create function public.expect(phase text, label text, role_name text, uid uuid, em text, stmt text, expected text) returns void language plpgsql as $$
declare v text; out text; begin
  begin
    execute format('set local role %I', role_name);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', em, 'role', role_name)::text, true);
    execute stmt into v; out := coalesce(v,'');
  exception when others then out := 'ERR';
  end;
  reset role;
  insert into public.results values (phase,label,expected,out, case when expected='OK' then out<>'ERR' else out=expected end);
end $$;
