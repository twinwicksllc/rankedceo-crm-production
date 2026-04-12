-- =============================================================================
-- WaaS Foundation: Migration 004 - Audit Engine Columns
-- Adds engine-specific columns to the audits table for Phase 2.
-- Run AFTER 003_waas_leads.sql
-- =============================================================================

-- Add lead linkage to audits
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS lead_id             UUID          NULL REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notified      BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_notified_at   TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS manual_review       BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_review_note  TEXT          NULL,
  ADD COLUMN IF NOT EXISTS keywords_used       TEXT[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_detected   TEXT          NULL;

-- Index for manual review queue
CREATE INDEX IF NOT EXISTS idx_audits_manual_review
  ON audits (manual_review, created_at DESC)
  WHERE manual_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_audits_lead_id
  ON audits (lead_id)
  WHERE lead_id IS NOT NULL;

-- =============================================================================
-- END OF MIGRATION 004
-- =============================================================================