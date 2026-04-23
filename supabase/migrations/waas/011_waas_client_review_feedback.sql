-- =============================================================================
-- WaaS Phase 5: Migration 011 - Client Review Feedback Fields
-- Adds structured client feedback fields captured during variant selection.
-- Run in the WaaS Supabase project AFTER 010_waas_client_review_selection.sql
-- =============================================================================

ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS client_feedback_tone TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_cta_intensity TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_layout_preference TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_submitted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_site_config_client_feedback_submitted_at
  ON tenant_site_config(client_feedback_submitted_at)
  WHERE client_feedback_submitted_at IS NOT NULL;

-- =============================================================================
-- END OF MIGRATION 011
-- =============================================================================
