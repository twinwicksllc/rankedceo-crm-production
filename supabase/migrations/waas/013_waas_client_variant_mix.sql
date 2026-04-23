-- =============================================================================
-- WaaS Phase 5: Migration 013 - Client Variant Mix Metadata
-- Persists "mix from A/B/C" selection metadata for review and rollout.
-- Run in the WaaS Supabase project AFTER 012_waas_site_config_versions.sql
-- =============================================================================

ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS client_mix_source_templates JSONB NULL,
  ADD COLUMN IF NOT EXISTS client_mix_submitted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_site_config_client_mix_submitted_at
  ON tenant_site_config(client_mix_submitted_at)
  WHERE client_mix_submitted_at IS NOT NULL;

-- =============================================================================
-- END OF MIGRATION 013
-- =============================================================================
