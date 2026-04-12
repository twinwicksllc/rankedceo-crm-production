-- =============================================================================
-- WaaS Foundation: Migration 002 - Audits Table
-- Project: RankedCEO Website-as-a-Service (WaaS)
-- Supabase Project: NEW standalone WaaS project (separate from CRM)
-- =============================================================================
-- IMPORTANT: Run AFTER 001_waas_tenants.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE waas_audit_status AS ENUM (
  'pending',      -- Audit requested, not yet started
  'running',      -- SEO crawl/analysis in progress
  'completed',    -- Report data populated, ready to view
  'failed',       -- Audit encountered an error
  'expired'       -- Past expires_at, archived
);

CREATE TYPE waas_audit_type AS ENUM (
  'prospect',     -- Pre-sale audit of a prospect's site (no tenant yet)
  'tenant',       -- Ongoing audit of a tenant's own site
  'competitor'    -- Audit of a competitor's site
);

-- ---------------------------------------------------------------------------
-- AUDITS TABLE
-- Stores SEO/ranking audit reports for tenant sites and prospects.
-- ---------------------------------------------------------------------------

CREATE TABLE audits (
  -- Identity
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant linkage (nullable for prospect audits — pre-signup)
  tenant_id           UUID          NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Audit classification
  audit_type          waas_audit_type  NOT NULL DEFAULT 'prospect',
  status              waas_audit_status NOT NULL DEFAULT 'pending',

  -- The site being audited
  target_url          TEXT          NOT NULL,                        -- e.g. 'https://old-plumber-site.com'

  -- Competitors to benchmark against (array of up to 5 URLs)
  competitor_urls     TEXT[]        NOT NULL DEFAULT '{}',           -- e.g. ARRAY['https://comp1.com','https://comp2.com','https://comp3.com']

  -- SEO/Ranking report data (JSONB for flexibility across providers)
  -- Schema (populated by audit worker):
  -- {
  --   summary: {
  --     overall_score:      number,   -- 0-100
  --     performance_score:  number,
  --     seo_score:          number,
  --     mobile_score:       number,
  --     accessibility_score: number
  --   },
  --   rankings: [
  --     { keyword: string, position: number, url: string, search_volume: number }
  --   ],
  --   competitors: [
  --     {
  --       url: string,
  --       domain_authority: number,
  --       keywords_ranking: number,
  --       estimated_traffic: number,
  --       top_keywords: string[]
  --     }
  --   ],
  --   technical_issues: [
  --     { severity: 'critical'|'warning'|'info', type: string, description: string, url: string }
  --   ],
  --   page_speed: {
  --     mobile: { lcp: number, fid: number, cls: number, ttfb: number },
  --     desktop: { lcp: number, fid: number, cls: number, ttfb: number }
  --   },
  --   backlinks: {
  --     total: number,
  --     referring_domains: number,
  --     domain_authority: number
  --   },
  --   opportunities: [
  --     { type: string, description: string, estimated_impact: 'high'|'medium'|'low' }
  --   ],
  --   provider_meta: {
  --     provider:    'serper'|'dataforseo'|'mock',
  --     fetched_at:  string (ISO timestamp),
  --     request_id:  string
  --   }
  -- }
  report_data         JSONB         NULL DEFAULT '{}',

  -- Requestor info (for prospect audits — lead capture)
  requestor_name      TEXT          NULL,
  requestor_email     TEXT          NULL,
  requestor_phone     TEXT          NULL,
  requestor_company   TEXT          NULL,

  -- Audit lifecycle timestamps
  requested_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ   NULL,
  completed_at        TIMESTAMPTZ   NULL,
  expires_at          TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),

  -- Error tracking
  error_message       TEXT          NULL,
  retry_count         INT           NOT NULL DEFAULT 0,

  -- SEO provider used
  seo_provider        TEXT          NULL,                            -- 'serper', 'dataforseo', 'mock'

  -- Audit trail
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Tenant → audits lookup
CREATE INDEX idx_audits_tenant_id     ON audits (tenant_id)   WHERE tenant_id IS NOT NULL;

-- Status-based queue processing (for worker)
CREATE INDEX idx_audits_status        ON audits (status, requested_at);

-- Prospect audit lead lookup by email
CREATE INDEX idx_audits_requestor     ON audits (requestor_email) WHERE requestor_email IS NOT NULL;

-- Expiry cleanup job
CREATE INDEX idx_audits_expires_at    ON audits (expires_at)  WHERE status = 'completed';

-- Target URL dedup check
CREATE INDEX idx_audits_target_url    ON audits (target_url, tenant_id);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();   -- reuses function from migration 001

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT prospect audits (the public audit tool flow)
CREATE POLICY "audits_anon_insert_prospect"
  ON audits
  FOR INSERT
  TO anon
  WITH CHECK (audit_type = 'prospect' AND tenant_id IS NULL);

-- Anon can read their own prospect audit by ID (polling for completion)
-- Uses a URL token pattern — no auth needed for status polling
CREATE POLICY "audits_anon_read_own"
  ON audits
  FOR SELECT
  TO anon
  USING (audit_type = 'prospect' AND tenant_id IS NULL);

-- Authenticated tenant admins can read their own tenant's audits
CREATE POLICY "audits_tenant_read_own"
  ON audits
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants
      WHERE id = tenant_id
        AND (
          auth.jwt() ->> 'role' = 'waas_admin'
          OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
        )
    )
  );

-- Platform admins can do everything
CREATE POLICY "audits_admin_all"
  ON audits
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- ---------------------------------------------------------------------------
-- HELPER FUNCTION: Create a prospect audit (called from public audit tool)
-- Returns the new audit ID for polling
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_prospect_audit(
  p_target_url        TEXT,
  p_competitor_urls   TEXT[],
  p_requestor_name    TEXT DEFAULT NULL,
  p_requestor_email   TEXT DEFAULT NULL,
  p_requestor_phone   TEXT DEFAULT NULL,
  p_requestor_company TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  -- Validate target URL (basic check)
  IF p_target_url IS NULL OR length(trim(p_target_url)) = 0 THEN
    RAISE EXCEPTION 'target_url is required';
  END IF;

  -- Cap competitor URLs at 5
  IF array_length(p_competitor_urls, 1) > 5 THEN
    RAISE EXCEPTION 'Maximum 5 competitor URLs allowed';
  END IF;

  INSERT INTO audits (
    audit_type,
    status,
    target_url,
    competitor_urls,
    requestor_name,
    requestor_email,
    requestor_phone,
    requestor_company,
    expires_at
  )
  VALUES (
    'prospect',
    'pending',
    trim(p_target_url),
    COALESCE(p_competitor_urls, '{}'),
    p_requestor_name,
    p_requestor_email,
    p_requestor_phone,
    p_requestor_company,
    NOW() + INTERVAL '90 days'
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_prospect_audit(TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- HELPER FUNCTION: Get audit status (for polling — no auth needed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_audit_status(p_audit_id UUID)
RETURNS TABLE (
  id            UUID,
  status        waas_audit_status,
  report_data   JSONB,
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      a.id, a.status, a.report_data, a.completed_at, a.expires_at, a.error_message
    FROM audits a
    WHERE a.id = p_audit_id
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_audit_status(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- FUNCTION: Mark expired audits (run via pg_cron or Supabase scheduled function)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expire_old_audits()
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE audits
  SET status = 'expired', updated_at = NOW()
  WHERE expires_at < NOW()
    AND status = 'completed';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================