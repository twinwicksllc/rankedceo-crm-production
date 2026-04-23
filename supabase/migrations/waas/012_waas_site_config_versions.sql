-- =============================================================================
-- WaaS Phase 5: Migration 012 - Tenant Site Config Version History
-- Stores immutable snapshots so admins can review and roll back changes.
-- Run in the WaaS Supabase project AFTER 011_waas_client_review_feedback.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_site_versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  change_source TEXT        NOT NULL,
  summary       TEXT        NULL,
  template_slug TEXT        NULL,
  snapshot_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_site_versions_tenant_created
  ON tenant_site_versions(tenant_id, created_at DESC);

ALTER TABLE tenant_site_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_site_versions_admin_all" ON tenant_site_versions;
CREATE POLICY "tenant_site_versions_admin_all"
  ON tenant_site_versions FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- =============================================================================
-- END OF MIGRATION 012
-- =============================================================================
