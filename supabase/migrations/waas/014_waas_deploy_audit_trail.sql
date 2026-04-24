-- =============================================================================
-- WaaS Phase 6: Migration 014 - Deployment Audit Trail
-- Persists immutable deployment package snapshots for production handoff.
-- Run in the WaaS Supabase project AFTER 013_waas_client_variant_mix.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_site_deployments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployed_by             TEXT        NOT NULL DEFAULT 'admin_console',
  source_version_id       UUID        NULL REFERENCES tenant_site_versions(id) ON DELETE SET NULL,
  deployment_payload_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_site_deployments_tenant_created
  ON tenant_site_deployments(tenant_id, created_at DESC);

ALTER TABLE tenant_site_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_site_deployments_admin_all" ON tenant_site_deployments;
CREATE POLICY "tenant_site_deployments_admin_all"
  ON tenant_site_deployments FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- =============================================================================
-- END OF MIGRATION 014
-- =============================================================================
