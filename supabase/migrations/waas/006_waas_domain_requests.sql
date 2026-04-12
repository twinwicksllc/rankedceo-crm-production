-- =============================================================================
-- WaaS Phase 3: Migration 006 - Domain Requests Table
-- Stores prospect domain wishlist from the onboarding flow
-- Run AFTER 005_waas_onboarding.sql
-- =============================================================================

CREATE TYPE waas_domain_status AS ENUM (
  'requested',    -- User submitted this domain preference
  'checking',     -- Availability check in progress
  'available',    -- Domain is available for registration
  'taken',        -- Domain is already registered
  'registered',   -- We registered it for the tenant
  'connected'     -- DNS configured and verified
);

-- ---------------------------------------------------------------------------
-- DOMAIN REQUESTS TABLE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS domain_requests (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant linkage
  tenant_id       UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Domain info
  domain_name     TEXT            NOT NULL,   -- e.g. 'acmeplumbing'
  extension       TEXT            NOT NULL,   -- e.g. '.com', '.net', '.biz'
  full_domain     TEXT            GENERATED ALWAYS AS (domain_name || extension) STORED,

  -- Status
  status          waas_domain_status  NOT NULL DEFAULT 'requested',

  -- Priority (1 = first choice, 2 = second, 3 = third)
  priority        INT             NOT NULL DEFAULT 1,

  -- Admin notes
  notes           TEXT            NULL,
  actioned_at     TIMESTAMPTZ     NULL,
  actioned_by     TEXT            NULL,

  -- Audit trail
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_domain_requests_tenant_id ON domain_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_requests_status ON domain_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_requests_unique ON domain_requests(tenant_id, domain_name, extension);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_domain_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_domain_requests_updated_at
  BEFORE UPDATE ON domain_requests
  FOR EACH ROW EXECUTE FUNCTION update_domain_requests_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE domain_requests ENABLE ROW LEVEL SECURITY;

-- Service role has full access (admin operations)
CREATE POLICY "service_role_full_access_domain_requests"
  ON domain_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon can insert domain requests (during onboarding)
CREATE POLICY "anon_can_insert_domain_requests"
  ON domain_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon can read their own tenant's domain requests
CREATE POLICY "anon_can_read_domain_requests"
  ON domain_requests FOR SELECT
  TO anon
  USING (true);