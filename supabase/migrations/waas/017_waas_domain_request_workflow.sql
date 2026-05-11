-- =============================================================================
-- WaaS Phase 6.3: Migration 017 - Domain Request Workflow
--
-- Extends domain_requests with:
--   - status_history JSONB array — immutable audit trail of all status changes
--   - admin_notes TEXT — internal-only field (not exposed to tenants)
--   - workflow_status TEXT — richer state beyond waas_domain_status
--     (requested | under_review | provisioning | live | rejected)
--
-- Also adds a new client_domain_change_requests table for post-onboarding
-- domain change requests submitted by the tenant from /edit/[reviewToken].
--
-- Safe to re-run (all statements are idempotent via IF NOT EXISTS / IF EXISTS)
-- Run AFTER 016_waas_client_edit_flow.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend domain_requests with workflow columns
-- ---------------------------------------------------------------------------

ALTER TABLE domain_requests
  ADD COLUMN IF NOT EXISTS admin_notes      TEXT        NULL,
  ADD COLUMN IF NOT EXISTS status_history   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS workflow_status  TEXT        NOT NULL DEFAULT 'requested'
    CHECK (workflow_status IN ('requested', 'under_review', 'provisioning', 'live', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_domain_requests_workflow_status
  ON domain_requests(workflow_status);

-- ---------------------------------------------------------------------------
-- 2. client_domain_change_requests
--    A tenant submits this from /edit/[reviewToken] to request a domain
--    change post-onboarding. Admin reviews and manually updates domain_requests.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_domain_change_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_token_hash TEXT        NOT NULL,     -- SHA-256 of the review token for audit

  -- What the client wants
  requested_domain  TEXT        NOT NULL,     -- e.g. 'acmeplumbing.com'
  request_note      TEXT        NULL,         -- client's free-text note

  -- Workflow
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acknowledged', 'actioned', 'rejected')),
  admin_response    TEXT        NULL,         -- admin reply shown to tenant
  actioned_by       TEXT        NULL,
  actioned_at       TIMESTAMPTZ NULL,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_domain_change_requests_tenant_id
  ON client_domain_change_requests(tenant_id);

CREATE INDEX IF NOT EXISTS idx_client_domain_change_requests_status
  ON client_domain_change_requests(status)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION update_client_domain_change_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_domain_change_requests_updated_at
  ON client_domain_change_requests;

CREATE TRIGGER trg_client_domain_change_requests_updated_at
  BEFORE UPDATE ON client_domain_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_client_domain_change_requests_updated_at();

-- RLS
ALTER TABLE client_domain_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_cdcr" ON client_domain_change_requests;
CREATE POLICY "service_role_full_access_cdcr"
  ON client_domain_change_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- END OF MIGRATION 017
-- =============================================================================
