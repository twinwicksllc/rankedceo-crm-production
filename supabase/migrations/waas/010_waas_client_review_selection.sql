-- =============================================================================
-- WaaS Phase 4: Migration 010 - Client Review Tokens & Selection Metadata
-- Adds shareable review token and explicit client-selected variant audit fields.
-- =============================================================================

ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS client_review_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_selected_template_slug TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_selected_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_site_config_client_review_token
  ON tenant_site_config(client_review_token)
  WHERE client_review_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_site_config_client_selected_at
  ON tenant_site_config(client_selected_at)
  WHERE client_selected_at IS NOT NULL;
