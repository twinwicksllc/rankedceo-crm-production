-- READ-ONLY re-count of the 22 CRM-group tables for the E3 data-copy decision (DEC-0026).
-- Run in rankedceo-crm-production (ref wcednzaxmxwfiijzmjmx) only.
-- data_inventory.sql counted 4 of these 22 tables; this covers all of them.
-- One SELECT, writes nothing, returns no row contents: only counts and dates.
-- A missing table shows as 'missing table' instead of an error.
-- The table list is the CRM group in DB_CONSOLIDATION_PLAN.md section 2.
with spec(tbl) as (values
  ('activities'), ('agent_conversations'), ('appointments'), ('calendly_connections'),
  ('campaign_emails'), ('campaigns'), ('commission_rates'), ('commissions'),
  ('companies'), ('contacts'), ('crm_billing_events'), ('crm_subscriptions'),
  ('deals'), ('email_messages'), ('email_templates'), ('email_threads'),
  ('form_fields'), ('form_submissions'), ('forms'), ('industry_leads'),
  ('pipelines'), ('smile_assessments')
),
s as (
  select spec.tbl,
         to_regclass(format('public.%I', spec.tbl)) as reg,
         exists (select 1 from information_schema.columns c
                 where c.table_schema = 'public' and c.table_name = spec.tbl
                   and c.column_name = 'created_at') as has_ca
  from spec
)
select s.tbl as "table",
       case when s.reg is null then 'missing table' else 'ok' end as status,
       (xpath('/row/n/text()', q.x))[1]::text::bigint as n,
       (xpath('/row/min_ca/text()', q.x))[1]::text::timestamptz as first_created,
       (xpath('/row/max_ca/text()', q.x))[1]::text::timestamptz as last_created,
       (xpath('/row/since/text()', q.x))[1]::text::bigint as since_2026_10_19
from s
cross join lateral (
  select case when s.reg is not null then
    query_to_xml(format(
      'select count(*) as n, %s as min_ca, %s as max_ca, %s as since from public.%I',
      case when s.has_ca then 'min(created_at)' else 'null::timestamptz' end,
      case when s.has_ca then 'max(created_at)' else 'null::timestamptz' end,
      case when s.has_ca then $q$count(*) filter (where created_at >= '2026-10-19')$q$
           else 'null::bigint' end,
      s.tbl), false, true, '')
  end as x
) q
order by s.tbl;
