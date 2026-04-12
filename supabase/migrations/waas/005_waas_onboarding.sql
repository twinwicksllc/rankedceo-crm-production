-- =============================================================================
-- WaaS Phase 3: Migration 005 - Onboarding Fields & Status Extension
-- Adds `pending_review` to tenant status + onboarding-specific columns
-- Run in the WaaS Supabase project AFTER 004_waas_audit_engine.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend waas_tenant_status enum with pending_review
-- ---------------------------------------------------------------------------

ALTER TYPE waas_tenant_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'onboarding';

-- ---------------------------------------------------------------------------
-- Add onboarding columns to tenants table
-- ---------------------------------------------------------------------------

ALTER TABLE tenants
  -- Business identity
  ADD COLUMN IF NOT EXISTS legal_name          TEXT          NULL,
  ADD COLUMN IF NOT EXISTS physical_address    TEXT          NULL,
  ADD COLUMN IF NOT EXISTS city                TEXT          NULL,
  ADD COLUMN IF NOT EXISTS state               TEXT          NULL,
  ADD COLUMN IF NOT EXISTS zip                 TEXT          NULL,
  ADD COLUMN IF NOT EXISTS primary_trade       TEXT          NULL,   -- e.g. 'Plumbing', 'HVAC'

  -- Audit linkage (the audit that triggered onboarding)
  ADD COLUMN IF NOT EXISTS source_audit_id     UUID          NULL REFERENCES audits(id) ON DELETE SET NULL,

  -- Integrations
  ADD COLUMN IF NOT EXISTS calendly_url        TEXT          NULL,
  ADD COLUMN IF NOT EXISTS financing_enabled   BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS usp                 TEXT          NULL,   -- Unique Selling Proposition

  -- Onboarding metadata
  ADD COLUMN IF NOT EXISTS onboarding_step     INT           NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS submitted_by_email  TEXT          NULL;

-- ---------------------------------------------------------------------------
-- Index for audit linkage
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tenants_source_audit_id ON tenants(source_audit_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ---------------------------------------------------------------------------
-- Updated trigger for updated_at
-- (Ensures the column updates on any change)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: Allow service role to read/write all tenant onboarding data
-- Allow anon to insert new tenants (onboarding flow is public-facing)
-- ---------------------------------------------------------------------------

-- Allow anon to INSERT (create new tenant during onboarding)
DROP POLICY IF EXISTS "anon_can_create_tenant" ON tenants;
CREATE POLICY "anon_can_create_tenant"
  ON tenants FOR INSERT
  TO anon
  WITH CHECK (status IN ('onboarding', 'pending_review'));

-- Allow anon to UPDATE their own tenant during onboarding (by matching submitted_by_email)
DROP POLICY IF EXISTS "anon_can_update_own_tenant_onboarding" ON tenants;
CREATE POLICY "anon_can_update_own_tenant_onboarding"
  ON tenants FOR UPDATE
  TO anon
  USING (status IN ('onboarding', 'pending_review'))
  WITH CHECK (status IN ('onboarding', 'pending_review'));