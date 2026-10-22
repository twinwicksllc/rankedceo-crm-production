-- READ-ONLY data inventory for the E3 data-copy decision (DEC-0026).
-- Run the same script in rankedceo-crm-production and in rankedceo-waas.
-- Results from 2026-10-22 are summarised in E3_CLIENT_SWITCH_PLAN.md (D2).
-- Data inventory. Read-only: one SELECT, writes nothing.
-- Run the same script in both projects (CRM, then WaaS). Shows counts,
-- first/last created_at, rows since 2026-10-19, and for leads and chats a
-- breakdown by category and email DOMAIN only. A missing table or column
-- shows as a 'missing ...' row instead of an error.
with spec(item, tbl, filter_sql, needs_col) as (values
  ('agent_conversations'::text, 'agent_conversations'::text, 'true'::text, null::text),
  ('industry_leads', 'industry_leads', 'true', null),
  ('appointments', 'appointments', 'true', null),
  ('calendly_connections', 'calendly_connections', 'true', null),
  ('accounts (all)', 'accounts', 'true', null),
  ('accounts (pool)', 'accounts', 'is_pool_account is true', 'is_pool_account'),
  ('accounts (non-pool)', 'accounts', 'is_pool_account is not true', 'is_pool_account'),
  ('accounts (named My Account)', 'accounts', $q$name = 'My Account'$q$, 'name'),
  ('users (all)', 'users', 'true', null),
  ('users (email is null)', 'users', 'email is null', 'email'),
  ('tenants', 'tenants', 'true', null),
  ('tenant_site_config', 'tenant_site_config', 'true', null),
  ('tenant_site_versions', 'tenant_site_versions', 'true', null),
  ('tenant_site_variants', 'tenant_site_variants', 'true', null),
  ('tenant_site_deployments', 'tenant_site_deployments', 'true', null),
  ('domain_requests', 'domain_requests', 'true', null),
  ('leads', 'leads', 'true', null),
  ('site_templates', 'site_templates', 'true', null),
  ('audits', 'audits', 'true', null)
),
s as (
  select spec.*,
         to_regclass(format('public.%I', spec.tbl)) as reg,
         exists (select 1 from information_schema.columns c
                 where c.table_schema = 'public' and c.table_name = spec.tbl
                   and c.column_name = 'created_at') as has_ca,
         (spec.needs_col is null or exists (
                 select 1 from information_schema.columns c
                 where c.table_schema = 'public' and c.table_name = spec.tbl
                   and c.column_name = spec.needs_col)) as has_col
  from spec
),
counts as (
  select 'count'::text as section, s.item, null::text as detail,
         case when s.reg is null then 'missing table'
              when not s.has_col then 'missing column ' || s.needs_col
              else 'ok' end as status,
         (xpath('/row/n/text()', q.x))[1]::text::bigint as n,
         (xpath('/row/min_ca/text()', q.x))[1]::text::timestamptz as first_created,
         (xpath('/row/max_ca/text()', q.x))[1]::text::timestamptz as last_created,
         (xpath('/row/since/text()', q.x))[1]::text::bigint as since_2026_10_19
  from s
  cross join lateral (
    select case when s.reg is not null and s.has_col then
      query_to_xml(format(
        'select count(*) as n, %s as min_ca, %s as max_ca, %s as since from public.%I where %s',
        case when s.has_ca then 'min(created_at)' else 'null::timestamptz' end,
        case when s.has_ca then 'max(created_at)' else 'null::timestamptz' end,
        case when s.has_ca then $q$count(*) filter (where created_at >= '2026-10-19')$q$
             else 'null::bigint' end,
        s.tbl, s.filter_sql), false, true, '')
    end as x
  ) q
),
bspec(item, tbl, col, expr) as (values
  ('industry_leads by industry'::text, 'industry_leads'::text, 'industry'::text, 'industry'::text),
  ('industry_leads by status', 'industry_leads', 'status', 'status'),
  ('industry_leads by email domain', 'industry_leads', 'lead_email',
     $q$lower(nullif(split_part(lead_email, '@', 2), ''))$q$),
  ('agent_conversations by source', 'agent_conversations', 'source', 'source'),
  ('agent_conversations by status', 'agent_conversations', 'status', 'status'),
  ('agent_conversations by email domain', 'agent_conversations', 'lead_email',
     $q$lower(nullif(split_part(lead_email, '@', 2), ''))$q$)
),
b as (
  select bspec.*,
         to_regclass(format('public.%I', bspec.tbl)) as reg,
         exists (select 1 from information_schema.columns c
                 where c.table_schema = 'public' and c.table_name = bspec.tbl
                   and c.column_name = bspec.col) as has_col
  from bspec
),
breakdowns as (
  select 'breakdown'::text as section, b.item,
         case when r.row_xml is null then '(no rows)'
              else coalesce((xpath('/row/k/text()', r.row_xml))[1]::text, '(blank)') end as detail,
         case when b.reg is null then 'missing table'
              when not b.has_col then 'missing column ' || b.col
              else 'ok' end as status,
         (xpath('/row/n/text()', r.row_xml))[1]::text::bigint as n,
         null::timestamptz, null::timestamptz, null::bigint
  from b
  cross join lateral (
    select case when b.reg is not null and b.has_col then
      query_to_xml(format(
        'select %s::text as k, count(*) as n from public.%I group by 1 order by 2 desc, 1',
        b.expr, b.tbl), false, false, '')
    end as x
  ) q
  left join lateral unnest(xpath('/table/row', q.x)) as r(row_xml) on true
)
select * from counts
union all
select * from breakdowns
order by section desc, item, n desc nulls last, detail;
