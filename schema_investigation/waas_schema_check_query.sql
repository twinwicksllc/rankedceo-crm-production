-- =============================================================================
-- Run this in the Supabase SQL Editor for the RANKEDCEO-WAAS project
-- (the standalone WaaS project — NOT the CRM project)
-- =============================================================================
-- Purpose: get a full picture of what's actually live in rankedceo-waas
-- before we write any new baseline migration for the CRM's missing
-- contacts/companies/pipelines/pipeline_stages tables — just to confirm
-- there's no overlap, cross-project depencency, or naming confusion, and
-- to see if this project needs its own tracked-migration cleanup pass too.
-- =============================================================================

select
  t.table_name,
  (select jsonb_agg(jsonb_build_object(
      'column', c.column_name, 'type', c.data_type,
      'nullable', c.is_nullable, 'default', c.column_default
    ) order by c.ordinal_position)
   from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = t.table_name) as columns,
  (select jsonb_agg(jsonb_build_object(
      'constraint', tc.constraint_name, 'type', tc.constraint_type))
   from information_schema.table_constraints tc
   where tc.table_schema = 'public' and tc.table_name = t.table_name) as constraints,
  (select jsonb_agg(jsonb_build_object('index', i.indexname, 'def', i.indexdef))
   from pg_indexes i
   where i.schemaname = 'public' and i.tablename = t.table_name) as indexes,
  (select jsonb_agg(jsonb_build_object('policy', p.policyname, 'cmd', p.cmd, 'roles', p.roles))
   from pg_policies p
   where p.schemaname = 'public' and p.tablename = t.table_name) as rls_policies
from information_schema.tables t
where t.table_schema = 'public'
order by t.table_name;
