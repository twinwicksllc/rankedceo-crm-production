-- rehearsal_cleanup.sql
-- Project: rankedceo-waas (ref klgvdvryewykzlumbkei). Run in that project's SQL Editor ONLY.
--
-- Purpose (DEC-0029, scope narrowed by DEC-0030): after the E3 switch rehearsal, remove
-- exactly the rows that rehearsal created for ONE test login, and nothing else.
-- Steps for the human are in docs/engineering/E3_REHEARSAL_PLAN.md.
--
-- STATUS: tested only on a throwaway Postgres (PGlite) built from waas/027, 029 and 030.
-- It has NOT been run against rankedceo-waas. The first run there is a 'preview'.
--
-- HOW TO USE: edit the lines under "EDIT HERE" at the bottom, paste the whole file into the
-- SQL Editor, press Run. The script has three modes:
--   'preview'  read-only. Lists, per table, how many rows WOULD be deleted, the rows it
--              refuses to touch, the storage objects to remove by hand, and fingerprints of
--              the accounts table.
--   'delete'   runs the deletes. With p_commit => false (the default) it DOES the deletes and
--              then rolls them back, so you see exactly what a real run would do and
--              nothing changes. Set p_commit => true to keep the deletes.
--   'verify'   read-only. Proves nothing of the test login is left, the 4 pool accounts are
--              present and unchanged, and lists storage objects whose tenant is gone.
--
-- WHAT IT DELETES (in this order, so foreign keys never block it):
--   notification_log, then the tenant child tables (tenant_variant_regenerations,
--   client_variant_edit_events, client_uploaded_assets, client_domain_change_requests,
--   tenant_site_deployments, tenant_site_versions, tenant_site_variants, tenant_site_config,
--   domain_requests), tenants, industry_leads, agent_conversations, users, accounts.
--   Each row is chosen by the test login's own identifiers (see the predicates below), never
--   by the account id of a pool account.
--   auth.users is NOT deleted unless p_delete_auth_user => true. Default: delete the login
--   in the dashboard afterwards (Authentication > Users). Reason: the body of the live
--   handle_user_delete() trigger is not recorded in this repo, so the script does not fire
--   it unless you ask.
--
-- WHAT IT REFUSES (RAISE EXCEPTION, nothing is changed):
--   - the email is still REPLACE-ME or has no '@';
--   - no auth user has that email (modes preview and delete);
--   - the login is older than 30 days;
--   - the login's account is one of the 4 pool accounts, or is flagged is_pool_account;
--   - the account has any other user, or was not created within 10 minutes of the login;
--   - any table outside the handled list has a row mentioning the test user id, account id,
--     tenant id or email (it would be left behind or silently changed by a cascade);
--   - more than 200 rows would be deleted;
--   - after the deletes, the pool accounts or any other account differ from before, a
--     deleted count differs from the preview count, a row is left over, or the total row
--     count of all public tables fell by anything other than the previewed total (a trigger
--     or cascade removed something else). Any of these rolls the whole run back.
--
-- WHAT IT CANNOT DO: storage objects. Supabase blocks deleting from storage.* with SQL
-- ("Direct deletion from storage tables is not allowed"). The preview lists them; remove
-- them in the dashboard (Storage). Supabase-managed auth tables with no foreign key to
-- auth.users (audit_log_entries) keep their rows.
--
-- Matching rules (all emails compared in lower case, after trimming):
--   tenants              submitted_by_email = the email, created at or after the login
--   notification_log     tenant of a matched tenant, or recipient_email = the email (after login)
--   industry_leads       lead_email = the email (after login), or auth_user_id = the login,
--                        or account_id = the login's own (non-pool) account
--   agent_conversations  lead_email = the email (after login), or session_id in p_session_ids
--                        (after login), or account_id = the login's own (non-pool) account
--   users / accounts     the login's own users row and the account it points at

create or replace function pg_temp.e3_add(
  r jsonb, p_section text, p_item text, p_n bigint, p_verdict text, p_detail text default null
) returns jsonb language sql immutable as $$
  select r || jsonb_build_array(jsonb_build_object(
    'section', p_section, 'item', p_item, 'n', p_n, 'verdict', p_verdict, 'detail', p_detail))
$$;

create or replace function pg_temp.e3_rehearsal_cleanup(
  p_email            text,
  p_mode             text    default 'preview',
  p_commit           boolean default false,
  p_session_ids      text[]  default array[]::text[],
  p_delete_auth_user boolean default false,
  p_confirm_account  uuid    default null
) returns table (ord int, section text, item text, n bigint, verdict text, detail text)
language plpgsql as $fn$
#variable_conflict use_variable
declare
  c_pool constant uuid[] := array[
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0003-000000000003',
    '00000000-0000-4000-a000-000000000004']::uuid[];
  c_nil           constant uuid     := '00000000-0000-0000-0000-000000000000';
  c_max_rows      constant bigint   := 200;
  -- A rehearsal login is created, used and cleaned up within days. A short window keeps a
  -- real customer who signed up recently from looking like a rehearsal login. The window is
  -- not the main protection: a committed delete also needs p_confirm_account (below).
  c_max_user_age  constant interval := interval '3 days';
  c_max_acct_gap  constant interval := interval '10 minutes';
  -- Tables the script deletes from or deliberately reads. Every other table in public is
  -- scanned for the test identity and blocks the run if it holds a row.
  c_handled constant text[] := array[
    'accounts','users','tenants','notification_log','industry_leads','agent_conversations',
    'tenant_variant_regenerations','client_variant_edit_events','client_uploaded_assets',
    'client_domain_change_requests','tenant_site_deployments','tenant_site_versions',
    'tenant_site_variants','tenant_site_config','domain_requests'];

  v_email        text := lower(btrim(coalesce(p_email, '')));
  v_sessions     text[] := coalesce(p_session_ids, array[]::text[]);
  v_uid          uuid;
  v_user_created timestamptz;
  v_account      uuid;
  v_acct_created timestamptz;
  v_acct_pool    boolean;
  v_acct_users   bigint;
  v_tenants      uuid[] := array[]::uuid[];
  v_needles      text[];
  v_steps        jsonb;
  v_lead_w       text;
  v_conv_w       text;
  v_rpt          jsonb := '[]'::jsonb;
  v_cnt          jsonb := '{}'::jsonb;
  v_total        bigint := 0;
  v_blocked      text := '';
  v_n            bigint;
  v_txt          text;
  v_rolled       boolean := false;
  v_rows_before  bigint;
  v_rows_after   bigint;
  v_since        timestamptz;
  v_bad          text;
  v_dates        text;
  s              record;
  tb             record;
  v_fp_pool_b    text;  v_fp_oth_b text;  v_acct_total_b bigint;
  v_fp_pool_a    text;  v_fp_oth_a text;  v_acct_total_a bigint;
begin
  if p_mode not in ('preview', 'delete', 'verify') then
    raise exception 'p_mode must be preview, delete or verify (got %)', p_mode;
  end if;
  if v_email = '' or position('@' in v_email) = 0 or v_email like 'replace-me@%' then
    raise exception 'Edit the email under EDIT HERE first (it is still empty or REPLACE-ME).';
  end if;

  -- ---- who is the test login ------------------------------------------------------------
  select u.id, u.created_at into v_uid, v_user_created
  from auth.users u where lower(btrim(u.email)) = v_email;

  if v_uid is null and p_mode <> 'verify' then
    raise exception 'No auth user has that email. Nothing was changed. If the login is already deleted, run mode verify instead.';
  end if;

  if v_uid is not null then
    if v_user_created < now() - c_max_user_age then
      raise exception 'This login was created % ago (more than 3 days). A rehearsal login is new. Refusing.',
        now() - v_user_created;
    end if;

    select pu.account_id into v_account from public.users pu where pu.id = v_uid;

    if v_account is not null then
      if v_account = any (c_pool) then
        raise exception 'REFUSED: the login resolves to a POOL account (%). Nothing was changed.', v_account;
      end if;
      select a.created_at, coalesce(a.is_pool_account, false)
        into v_acct_created, v_acct_pool
      from public.accounts a where a.id = v_account;
      if v_acct_pool then
        raise exception 'REFUSED: account % is flagged is_pool_account. Nothing was changed.', v_account;
      end if;
      select count(*) into v_acct_users from public.users pu where pu.account_id = v_account;
      if v_acct_users <> 1 then
        raise exception 'REFUSED: account % has % users; a rehearsal account has exactly one. Nothing was changed.',
          v_account, v_acct_users;
      end if;
      if v_acct_created is null
         or abs(extract(epoch from (v_acct_created - v_user_created))) > extract(epoch from c_max_acct_gap) then
        raise exception 'REFUSED: account % was not created at sign-up of this login (created %, login %). Nothing was changed.',
          v_account, v_acct_created, v_user_created;
      end if;
    end if;

    select coalesce(array_agg(t.id), array[]::uuid[]) into v_tenants
    from public.tenants t
    where lower(btrim(t.submitted_by_email)) = v_email and t.created_at >= v_user_created;
  end if;

  v_rpt := pg_temp.e3_add(v_rpt, 'GUARD', 'login found', case when v_uid is null then 0 else 1 end,
    case when v_uid is null then 'n/a' else 'PASS' end,
    case when v_uid is null then 'mode verify: login already gone' else 'created ' || v_user_created end);
  if v_uid is not null then
    v_rpt := pg_temp.e3_add(v_rpt, 'GUARD', 'account resolved (not a pool account, one user, made at sign-up)',
      case when v_account is null then 0 else 1 end,
      case when v_account is null then 'NONE' else 'PASS' end,
      coalesce(v_account::text, 'no users row: account steps are skipped'));
    if v_account is not null then
      v_rpt := pg_temp.e3_add(v_rpt, 'CONFIRM', 'p_confirm_account to copy into a committed delete', null, 'COPY',
        v_account::text || '  (account name: ' || coalesce((select a.name from public.accounts a where a.id = v_account), '?') || ')');
    end if;
  end if;

  -- ---- the delete steps, in FK-safe order. Count and delete use the SAME predicate. -----
  v_lead_w := format('(lower(lead_email) = %L and created_at >= %L)', v_email, coalesce(v_user_created, 'infinity'::timestamptz))
    || case when v_uid is not null then format(' or auth_user_id = %L', v_uid) else '' end
    || case when v_account is not null then format(' or account_id = %L', v_account) else '' end;
  v_conv_w := format('(lower(lead_email) = %L and created_at >= %L)', v_email, coalesce(v_user_created, 'infinity'::timestamptz))
    || case when cardinality(v_sessions) > 0
         then format(' or (session_id = any(%L::text[]) and created_at >= %L)', v_sessions, coalesce(v_user_created, 'infinity'::timestamptz))
         else '' end
    || case when v_account is not null then format(' or account_id = %L', v_account) else '' end;

  v_steps := jsonb_build_array(
    jsonb_build_object('t', 'notification_log',
      'w', format('tenant_id = any(%L::uuid[]) or (lower(recipient_email) = %L and created_at >= %L)',
                  v_tenants, v_email, coalesce(v_user_created, 'infinity'::timestamptz))),
    jsonb_build_object('t', 'tenant_variant_regenerations', 'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'client_variant_edit_events',   'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'client_uploaded_assets',       'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'client_domain_change_requests','w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'tenant_site_deployments',      'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'tenant_site_versions',         'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'tenant_site_variants',         'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'tenant_site_config',           'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'domain_requests',              'w', format('tenant_id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'tenants',                      'w', format('id = any(%L::uuid[])', v_tenants)),
    jsonb_build_object('t', 'industry_leads',               'w', v_lead_w),
    jsonb_build_object('t', 'agent_conversations',          'w', v_conv_w),
    jsonb_build_object('t', 'users',
      'w', case when v_account is not null then format('id = %L', v_uid) else 'false' end),
    jsonb_build_object('t', 'accounts',
      -- belt and braces: even if a guard above were wrong, a pool account cannot match.
      'w', case when v_account is not null
             then format('id = %L and id <> all(%L::uuid[]) and coalesce(is_pool_account, false) = false', v_account, c_pool)
             else 'false' end));

  -- ---- count what each step would delete ---------------------------------------------------
  for s in select e.value as j from jsonb_array_elements(v_steps) as e loop
    if p_mode = 'verify' then exit; end if;
    if to_regclass('public.' || quote_ident(s.j->>'t')) is null then
      v_rpt := pg_temp.e3_add(v_rpt, 'PREVIEW', s.j->>'t', 0, 'SKIP', 'table does not exist in this project');
      v_cnt := v_cnt || jsonb_build_object(s.j->>'t', 0);
      continue;
    end if;
    execute format('select count(*) from public.%I where %s', s.j->>'t', s.j->>'w') into v_n;
    v_cnt := v_cnt || jsonb_build_object(s.j->>'t', v_n);
    v_total := v_total + v_n;
    v_rpt := pg_temp.e3_add(v_rpt, 'PREVIEW', s.j->>'t', v_n, 'rows', null);
  end loop;
  if p_mode <> 'verify' then
    v_rpt := pg_temp.e3_add(v_rpt, 'PREVIEW', 'auth.users (login)', case when p_delete_auth_user then 1 else 0 end,
      case when p_delete_auth_user then 'rows' else 'MANUAL' end,
      case when p_delete_auth_user then 'will be deleted by this script'
           else 'delete this login in the dashboard (Authentication > Users)' end);
    v_rpt := pg_temp.e3_add(v_rpt, 'PREVIEW', 'TOTAL rows to delete from public tables', v_total,
      case when v_total > c_max_rows then 'FAIL' else 'PASS' end, 'ceiling ' || c_max_rows);
  end if;

  -- ---- rows the script leaves alone but you should know about ---------------------------
  if p_mode <> 'verify' and v_uid is not null then
    select count(*) into v_n from public.industry_leads
      where lower(lead_email) = v_email and created_at < v_user_created;
    v_rpt := pg_temp.e3_add(v_rpt, 'INFO', 'industry_leads with this email from BEFORE the login (left alone)', v_n, 'info', null);
    select count(*) into v_n from public.agent_conversations
      where lower(lead_email) = v_email and created_at < v_user_created;
    v_rpt := pg_temp.e3_add(v_rpt, 'INFO', 'agent_conversations with this email from BEFORE the login (left alone)', v_n, 'info', null);
    -- Rows under a POOL account made since the login that the matching rules do not select.
    -- Real visitors also land here, so they are listed for you to look at, never deleted. A
    -- chat that captured only a phone number, or an email typed differently, shows up here.
    execute format('select count(*) from public.industry_leads where account_id = any(%L::uuid[]) and created_at >= %L and not coalesce((%s), false)',
      c_pool, v_user_created, v_lead_w) into v_n;
    v_rpt := pg_temp.e3_add(v_rpt, 'INFO', 'industry_leads under a pool account since the login that are NOT matched (left alone; look at them in the table editor)', v_n, 'info', null);
    execute format('select count(*) from public.agent_conversations where account_id = any(%L::uuid[]) and created_at >= %L and not coalesce((%s), false)',
      c_pool, v_user_created, v_conv_w) into v_n;
    v_rpt := pg_temp.e3_add(v_rpt, 'INFO', 'agent_conversations under a pool account since the login that are NOT matched (left alone; look at them in the table editor)', v_n, 'info', null);
    select count(*) into v_n from public.tenants t
      where t.created_at >= v_user_created and not (t.id = any (v_tenants));
    v_rpt := pg_temp.e3_add(v_rpt, 'INFO', 'tenants created since the login with a DIFFERENT email (left alone; if one is yours, step 1 used the wrong email)', v_n, 'info', null);
  end if;

  -- ---- the scan: any other table holding the test identity blocks the run ---------------------
  v_needles := array_remove(array[v_uid::text, v_account::text, v_email], null)
    || coalesce((select array_agg(tt::text) from unnest(v_tenants) as tt), array[]::text[]);
  for tb in
    select c.relname as relname
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind in ('r', 'p') and not (c.relname = any (c_handled))
    order by c.relname
  loop
    execute format(
      'select count(*) from public.%I x where exists (select 1 from unnest(%L::text[]) k where position(k in lower(row_to_json(x)::text)) > 0)',
      tb.relname, v_needles) into v_n;
    if v_n > 0 then
      v_blocked := v_blocked || tb.relname || '(' || v_n || ') ';
      v_rpt := pg_temp.e3_add(v_rpt, 'BLOCK', tb.relname, v_n, 'FAIL',
        'a table the script does not handle holds rows that mention the test login, account, tenant or email');
    end if;
  end loop;
  v_rpt := pg_temp.e3_add(v_rpt, 'BLOCK', 'other tables mentioning the test identity',
    (select count(*) from jsonb_array_elements(v_rpt) e where e.value->>'section' = 'BLOCK' and e.value->>'verdict' = 'FAIL'),
    case when v_blocked = '' then 'PASS' else 'FAIL' end,
    case when v_blocked = '' then 'none' else v_blocked end);

  -- ---- storage objects (cannot be deleted by SQL) --------------------------------------------
  if to_regclass('storage.objects') is not null then
    if p_mode <> 'verify' then
      select count(*), string_agg(o.bucket_id || '/' || o.name, E'\n' order by o.bucket_id, o.name)
        into v_n, v_txt
      from storage.objects o
      where split_part(o.name, '/', 1) = any (select tt::text from unnest(v_tenants) as tt);
      v_rpt := pg_temp.e3_add(v_rpt, 'STORAGE', 'objects under this rehearsal''s tenant folders (remove in dashboard, Storage)',
        v_n, case when v_n = 0 then 'none' else 'MANUAL' end, v_txt);
    else
      select count(*), string_agg(o.bucket_id || '/' || o.name, E'\n' order by o.bucket_id, o.name)
        into v_n, v_txt
      from storage.objects o
      where o.bucket_id in ('logos', 'client-uploads')
        and split_part(o.name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and not exists (select 1 from public.tenants t where t.id::text = split_part(o.name, '/', 1));
      v_rpt := pg_temp.e3_add(v_rpt, 'STORAGE', 'objects whose tenant no longer exists (leftovers; remove in dashboard, Storage)',
        v_n, case when v_n = 0 then 'PASS' else 'REVIEW' end, v_txt);
    end if;
  end if;

  -- ---- fingerprints of the accounts table (compare preview <-> delete <-> verify) -----------
  select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) into v_fp_pool_b
    from public.accounts a where a.id = any (c_pool);
  select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) into v_fp_oth_b
    from public.accounts a where a.id <> all (c_pool) and a.id <> coalesce(v_account, c_nil);
  select count(*) into v_acct_total_b from public.accounts;
  select count(*) into v_n from public.accounts a where a.id = any (c_pool) and coalesce(a.is_pool_account, false);
  v_rpt := pg_temp.e3_add(v_rpt, 'FINGERPRINT', 'pool accounts present and flagged', v_n,
    case when v_n = 4 then 'PASS' else 'FAIL' end,
    'ids: ' || array_to_string(c_pool, ', '));
  v_rpt := pg_temp.e3_add(v_rpt, 'FINGERPRINT', 'pool accounts md5', null, 'compare', v_fp_pool_b);
  v_rpt := pg_temp.e3_add(v_rpt, 'FINGERPRINT', 'all other accounts (not pool, not the test account) md5', null, 'compare', v_fp_oth_b);
  v_rpt := pg_temp.e3_add(v_rpt, 'FINGERPRINT', 'accounts rows in total', v_acct_total_b, 'compare',
    'after a committed cleanup this is one lower than in the preview');

  -- ---- verify mode: what is left of the test login ---------------------------------------------
  if p_mode = 'verify' then
    select count(*) into v_n from auth.users u where lower(btrim(u.email)) = v_email;
    v_rpt := pg_temp.e3_add(v_rpt, 'VERIFY', 'auth.users with this email', v_n,
      case when v_n = 0 then 'PASS' else 'PENDING' end,
      case when v_n = 0 then null else 'delete the login in the dashboard (Authentication > Users), then run verify again' end);
    if v_uid is not null then
      select count(*) into v_n from public.users pu where pu.id = v_uid;
      v_rpt := pg_temp.e3_add(v_rpt, 'VERIFY', 'public.users row for the login', v_n, case when v_n = 0 then 'PASS' else 'FAIL' end, null);
    end if;
    -- While the login exists, count only rows made at or after it (the same rule the delete
    -- uses, so an earlier real submission with the same email is not a false alarm). Once the
    -- login is gone its date is unknown: count every row with the email and say REVIEW, with
    -- the dates, so you can see whether a leftover is the rehearsal's or an older one.
    v_txt := case when v_user_created is null then 'login is gone: all rows with this email are counted'
                  else 'rows made at or after the login' end;
    v_since := coalesce(v_user_created, '-infinity'::timestamptz);
    v_bad := case when v_user_created is null then 'REVIEW' else 'FAIL' end;

    select count(*), 'created ' || coalesce(min(created_at)::text, '-') || ' .. ' || coalesce(max(created_at)::text, '-')
      into v_n, v_dates
      from public.tenants where lower(btrim(submitted_by_email)) = v_email and created_at >= v_since;
    v_rpt := pg_temp.e3_add(v_rpt, 'VERIFY', 'tenants with this submitted_by_email', v_n,
      case when v_n = 0 then 'PASS' else v_bad end, case when v_n = 0 then v_txt else v_dates end);
    select count(*), 'created ' || coalesce(min(created_at)::text, '-') || ' .. ' || coalesce(max(created_at)::text, '-')
      into v_n, v_dates
      from public.notification_log where lower(recipient_email) = v_email and created_at >= v_since;
    v_rpt := pg_temp.e3_add(v_rpt, 'VERIFY', 'notification_log rows to this email', v_n,
      case when v_n = 0 then 'PASS' else v_bad end, case when v_n = 0 then v_txt else v_dates end);
    select count(*), 'created ' || coalesce(min(created_at)::text, '-') || ' .. ' || coalesce(max(created_at)::text, '-')
      into v_n, v_dates
      from public.industry_leads where lower(lead_email) = v_email and created_at >= v_since;
    v_rpt := pg_temp.e3_add(v_rpt, 'VERIFY', 'industry_leads with this email', v_n,
      case when v_n = 0 then 'PASS' else v_bad end, case when v_n = 0 then v_txt else v_dates end);
    select count(*), 'created ' || coalesce(min(created_at)::text, '-') || ' .. ' || coalesce(max(created_at)::text, '-')
      into v_n, v_dates
      from public.agent_conversations
      where (lower(lead_email) = v_email or session_id = any (v_sessions)) and created_at >= v_since;
    v_rpt := pg_temp.e3_add(v_rpt, 'VERIFY', 'agent_conversations with this email or session id', v_n,
      case when v_n = 0 then 'PASS' else v_bad end, case when v_n = 0 then v_txt else v_dates end);
  end if;

  -- ---- delete mode ------------------------------------------------------------------------------
  if p_mode = 'delete' then
    -- A committed delete must name the account the PREVIEW printed. A mistyped email that
    -- happens to match another recent sign-up resolves to a different account, so the ids
    -- differ and nothing is deleted. A dry run (p_commit false) does not need it.
    if p_commit and v_account is not null and p_confirm_account is distinct from v_account then
      raise exception 'REFUSED: a committed delete needs p_confirm_account => ''%'' (the account id the preview printed for % ). You passed %. Nothing was changed.',
        v_account, v_email, coalesce(p_confirm_account::text, 'nothing');
    end if;
    if v_blocked <> '' then
      raise exception 'BLOCKED. These tables hold rows that mention the test login and the script does not handle them: %. Nothing was changed. Look at those rows, then extend this script on purpose.', v_blocked;
    end if;
    if v_total > c_max_rows then
      raise exception 'REFUSED: % rows would be deleted (ceiling %). Wrong email? Nothing was changed.', v_total, c_max_rows;
    end if;
    if (select count(*) from public.accounts a where a.id = any (c_pool)) <> 4 then
      raise exception 'REFUSED: not all 4 pool accounts exist before the delete. Nothing was changed.';
    end if;

    -- row count of every public table, summed. A trigger or cascade that removes a row the
    -- preview did not list changes this number, and the run rolls back.
    select coalesce(sum((xpath('/row/c/text()', query_to_xml(
             format('select count(*) as c from %I.%I', t.schemaname, t.tablename), false, true, '')))[1]::text::bigint), 0)
      into v_rows_before from pg_tables t where t.schemaname = 'public';

    begin
      for s in select e.value as j from jsonb_array_elements(v_steps) as e loop
        if to_regclass('public.' || quote_ident(s.j->>'t')) is null then continue; end if;
        execute format('delete from public.%I where %s', s.j->>'t', s.j->>'w');
        get diagnostics v_n = row_count;
        if v_n <> (v_cnt->>(s.j->>'t'))::bigint then
          raise exception 'Deleted % rows from % but the preview counted %. Rolled back.',
            v_n, s.j->>'t', v_cnt->>(s.j->>'t');
        end if;
        v_rpt := pg_temp.e3_add(v_rpt, 'DELETE', s.j->>'t', v_n, 'deleted', null);
      end loop;

      if p_delete_auth_user then
        delete from auth.users where id = v_uid;
        get diagnostics v_n = row_count;
        v_rpt := pg_temp.e3_add(v_rpt, 'DELETE', 'auth.users (login)', v_n, 'deleted', null);
      end if;

      -- nothing may remain, and no other account may have changed
      for s in select e.value as j from jsonb_array_elements(v_steps) as e loop
        if to_regclass('public.' || quote_ident(s.j->>'t')) is null then continue; end if;
        execute format('select count(*) from public.%I where %s', s.j->>'t', s.j->>'w') into v_n;
        if v_n <> 0 then
          raise exception '% still has % matching rows after the delete. Rolled back.', s.j->>'t', v_n;
        end if;
      end loop;
      select coalesce(sum((xpath('/row/c/text()', query_to_xml(
               format('select count(*) as c from %I.%I', t.schemaname, t.tablename), false, true, '')))[1]::text::bigint), 0)
        into v_rows_after from pg_tables t where t.schemaname = 'public';
      if v_rows_after <> v_rows_before - v_total then
        raise exception 'Public tables lost % rows but the preview listed %. A trigger or cascade removed something else. Rolled back.',
          v_rows_before - v_rows_after, v_total;
      end if;
      select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) into v_fp_pool_a
        from public.accounts a where a.id = any (c_pool);
      select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) into v_fp_oth_a
        from public.accounts a where a.id <> all (c_pool) and a.id <> coalesce(v_account, c_nil);
      select count(*) into v_acct_total_a from public.accounts;
      if v_fp_pool_a is distinct from v_fp_pool_b then
        raise exception 'A pool account row changed during the delete. Rolled back.';
      end if;
      if v_fp_oth_a is distinct from v_fp_oth_b then
        raise exception 'An account other than the test account changed during the delete. Rolled back.';
      end if;
      if v_acct_total_a <> v_acct_total_b - (case when v_account is null then 0 else 1 end) then
        raise exception 'Accounts went from % to %, expected a drop of at most one. Rolled back.', v_acct_total_b, v_acct_total_a;
      end if;
      v_rpt := pg_temp.e3_add(v_rpt, 'DELETE', 'pool accounts md5 after', null, 'PASS', 'unchanged: ' || v_fp_pool_a);
      v_rpt := pg_temp.e3_add(v_rpt, 'DELETE', 'other accounts md5 after', null, 'PASS', 'unchanged: ' || v_fp_oth_a);
      v_rpt := pg_temp.e3_add(v_rpt, 'DELETE', 'accounts rows in total after', v_acct_total_a, 'compare', null);

      if not p_commit then
        raise exception using errcode = 'RB001', message = 'dry run: rolled back on purpose';
      end if;
    exception when sqlstate 'RB001' then
      v_rolled := true;
    end;

    v_rpt := pg_temp.e3_add(v_rpt, 'RESULT', case when v_rolled then 'DRY RUN: every delete above was rolled back, nothing changed'
                                                  else 'COMMITTED: the deletes above are permanent' end,
      v_total, case when v_rolled then 'ROLLED BACK' else 'COMMITTED' end,
      case when v_rolled then 'to keep them, set p_commit => true and run again' else null end);
  end if;

  return query
    select (e.ordinality)::int,
           e.value->>'section', e.value->>'item',
           nullif(e.value->>'n', '')::bigint, e.value->>'verdict', e.value->>'detail'
    from jsonb_array_elements(v_rpt) with ordinality as e;
end
$fn$;

-- =====================================================================================
-- EDIT HERE. Change the email, pick a mode, press Run. Nothing else needs editing.
-- =====================================================================================
select *
from pg_temp.e3_rehearsal_cleanup(
  p_email            => 'REPLACE-ME@example.com',   -- the ONE test login's email
  p_mode             => 'preview',                  -- 'preview' | 'delete' | 'verify'
  p_commit           => false,                      -- 'delete' only. false = rolled back. true = KEEP THE DELETES
  p_session_ids      => array[]::text[],            -- chat session id(s), e.g. array['session_123_abc']
  p_delete_auth_user => false,                      -- true = also delete the login here (else use the dashboard)
  p_confirm_account  => null                        -- committed delete only: paste the account id the preview printed
);
