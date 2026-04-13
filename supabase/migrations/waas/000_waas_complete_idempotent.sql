-- =============================================================================
-- WaaS Complete Idempotent Migration
-- Combines all 7 migrations (001-007) with IF NOT EXISTS / OR REPLACE safety
-- Safe to run multiple times - won't fail if objects already exist
-- Run in your WaaS Supabase project
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS (Phase 1)
-- Using DO blocks to create enums only if they don't exist
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE waas_package_tier AS ENUM (
    'hosting',    -- Basic hosting only, no SEO tools
    'standard',   -- Hosting + SEO audit tool + basic reporting
    'premium'     -- Hosting + full SEO suite + AI insights + white-label
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_tenant_status AS ENUM (
    'onboarding',   -- Tenant created, setup not complete
    'active',       -- Live and serving traffic
    'suspended',    -- Temporarily disabled (e.g., payment lapsed)
    'cancelled'     -- Permanently deactivated
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_audit_status AS ENUM (
    'pending',      -- Audit requested, not yet started
    'running',      -- SEO crawl/analysis in progress
    'completed',    -- Report data populated, ready to view
    'failed',       -- Audit encountered an error
    'expired'       -- Past expires_at, archived
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_audit_type AS ENUM (
    'prospect',     -- Pre-sale audit of a prospect's site (no tenant yet)
    'tenant',       -- Ongoing audit of a tenant's own site
    'competitor'    -- Audit of a competitor's site
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_lead_status AS ENUM (
    'new',          -- Just captured via email form
    'contacted',    -- Darrick/team has reached out
    'qualified',    -- Confirmed interest + budget
    'converted',    -- Became a paying customer
    'lost'          -- No longer interested
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_lead_source AS ENUM (
    'audit_tool',       -- Submitted URL for audit
    'email_capture',    -- Entered email to get report
    'onboarding',       -- Started onboarding flow
    'referral',         -- Referred by existing customer
    'manual'            -- Added manually by admin
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_domain_status AS ENUM (
    'requested',    -- User submitted, pending review
    'searching',    -- Looking for availability
    'available',    -- Domain is available to register
    'unavailable',  -- Domain is taken
    'registered',   -- We registered it successfully
    'failed'        -- Registration failed
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Add pending_review to waas_tenant_status (Phase 3)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE waas_tenant_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'onboarding';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- TENANTS TABLE (Phase 1) - WITHOUT FK to audits (added later)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenants (
  -- Identity
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Domain routing
  domain              TEXT          UNIQUE,
  subdomain           TEXT          UNIQUE,
  slug                TEXT          NOT NULL UNIQUE,

  -- Branding
  brand_config        JSONB         NOT NULL DEFAULT '{}',

  -- Billing & plan
  package_tier        waas_package_tier  NOT NULL DEFAULT 'hosting',

  -- Lifecycle
  status              waas_tenant_status NOT NULL DEFAULT 'onboarding',

  -- CRM linkage
  crm_account_id      UUID          NULL,

  -- Vercel domain
  vercel_project_id   TEXT          NULL,
  domain_verified     BOOLEAN       NOT NULL DEFAULT FALSE,
  domain_verified_at  TIMESTAMPTZ   NULL,

  -- SEO targets
  target_industry     TEXT          NULL,
  target_location     TEXT          NULL,

  -- Phase 3: Onboarding fields (without FK - added after audits exists)
  legal_name          TEXT          NULL,
  physical_address    TEXT          NULL,
  city                TEXT          NULL,
  state               TEXT          NULL,
  zip                 TEXT          NULL,
  primary_trade       TEXT          NULL,
  source_audit_id     UUID          NULL,  -- FK added after audits table exists
  calendly_url        TEXT          NULL,
  financing_enabled   BOOLEAN       NOT NULL DEFAULT FALSE,
  usp                 TEXT          NULL,
  onboarding_step     INT           NOT NULL DEFAULT 1,
  onboarding_completed BOOLEAN      NOT NULL DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ NULL,
  submitted_by_email  TEXT          NULL,

  -- Audit trail
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ   NULL
);

-- ---------------------------------------------------------------------------
-- AUDITS TABLE (Phase 1)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audits (
  -- Identity
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant linkage
  tenant_id           UUID          NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Audit classification
  audit_type          waas_audit_type  NOT NULL DEFAULT 'prospect',
  status              waas_audit_status NOT NULL DEFAULT 'pending',

  -- The site being audited
  target_url          TEXT          NOT NULL,
  competitor_urls     TEXT[]        NOT NULL DEFAULT '{}',

  -- Report data
  report_data         JSONB         NULL DEFAULT '{}',

  -- Requestor info
  requestor_name      TEXT          NULL,
  requestor_email     TEXT          NULL,
  requestor_phone     TEXT          NULL,
  requestor_company   TEXT          NULL,

  -- Lifecycle timestamps
  requested_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ   NULL,
  completed_at        TIMESTAMPTZ   NULL,
  expires_at          TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),

  -- Error tracking
  error_message       TEXT          NULL,
  retry_count         INT           NOT NULL DEFAULT 0,

  -- SEO provider
  seo_provider        TEXT          NULL,

  -- Phase 2: Audit engine columns
  lead_id             UUID          NULL,  -- FK added after leads exists
  admin_notified      BOOLEAN       NOT NULL DEFAULT FALSE,
  admin_notified_at   TIMESTAMPTZ   NULL,
  manual_review       BOOLEAN       NOT NULL DEFAULT FALSE,
  manual_review_note  TEXT          NULL,
  keywords_used       TEXT[]        NOT NULL DEFAULT '{}',
  location_detected   TEXT          NULL,

  -- Audit trail
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- LEADS TABLE (Phase 2)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS leads (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info
  name                TEXT          NULL,
  email               TEXT          NOT NULL,
  phone               TEXT          NULL,
  company             TEXT          NULL,

  -- Lead classification
  status              waas_lead_status    NOT NULL DEFAULT 'new',
  source              waas_lead_source    NOT NULL DEFAULT 'audit_tool',

  -- Audit linkage
  audit_id            UUID          NULL REFERENCES audits(id) ON DELETE SET NULL,

  -- Tenant linkage
  tenant_id           UUID          NULL REFERENCES tenants(id) ON DELETE SET NULL,

  -- Business context
  target_url          TEXT          NULL,
  industry            TEXT          NULL,
  location            TEXT          NULL,

  -- Lead scoring
  score               INT           NOT NULL DEFAULT 0,

  -- Notes & follow-up
  notes               TEXT          NULL,
  follow_up_at        TIMESTAMPTZ   NULL,
  contacted_at        TIMESTAMPTZ   NULL,

  -- UTM / attribution
  utm_source          TEXT          NULL,
  utm_medium          TEXT          NULL,
  utm_campaign        TEXT          NULL,
  referrer_url        TEXT          NULL,

  -- Email report
  report_emailed      BOOLEAN       NOT NULL DEFAULT FALSE,
  report_emailed_at   TIMESTAMPTZ   NULL,

  -- Admin notification
  admin_notified      BOOLEAN       NOT NULL DEFAULT FALSE,
  admin_notified_at   TIMESTAMPTZ   NULL,

  -- Audit trail
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- DOMAIN REQUESTS TABLE (Phase 3)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS domain_requests (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID                NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Domain details
  domain_name     TEXT                NOT NULL,
  extension       TEXT                NOT NULL DEFAULT '.com',
  full_domain     TEXT                GENERATED ALWAYS AS (domain_name || extension) STORED,
  
  -- Priority (1 = first choice, 2 = second, 3 = third)
  priority        INT                 NOT NULL DEFAULT 1,
  
  -- Status
  status          waas_domain_status  NOT NULL DEFAULT 'requested',
  status_notes    TEXT                NULL,
  
  -- Registration details
  registered_at   TIMESTAMPTZ         NULL,
  registrar       TEXT                NULL,
  
  -- Audit trail
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- ADD FOREIGN KEYS (after all tables exist)
-- ---------------------------------------------------------------------------

-- Add FK from tenants.source_audit_id to audits
DO $$ BEGIN
  ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_source_audit_id_fkey;
  ALTER TABLE tenants ADD CONSTRAINT tenants_source_audit_id_fkey
    FOREIGN KEY (source_audit_id) REFERENCES audits(id) ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN null;
END $$;

-- Add FK from audits.lead_id to leads
DO $$ BEGIN
  ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_lead_id_fkey;
  ALTER TABLE audits ADD CONSTRAINT audits_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- INDEXES (all IF NOT EXISTS)
-- ---------------------------------------------------------------------------

-- Tenants indexes
CREATE INDEX IF NOT EXISTS idx_tenants_domain    ON tenants (domain)    WHERE domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants (subdomain) WHERE subdomain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_slug      ON tenants (slug)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status       ON tenants (status);
CREATE INDEX IF NOT EXISTS idx_tenants_package_tier ON tenants (package_tier);
CREATE INDEX IF NOT EXISTS idx_tenants_crm_account  ON tenants (crm_account_id) WHERE crm_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_source_audit_id ON tenants(source_audit_id);

-- Audits indexes
CREATE INDEX IF NOT EXISTS idx_audits_tenant_id     ON audits (tenant_id)   WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audits_status        ON audits (status, requested_at);
CREATE INDEX IF NOT EXISTS idx_audits_requestor     ON audits (requestor_email) WHERE requestor_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audits_expires_at    ON audits (expires_at)  WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_audits_target_url    ON audits (target_url, tenant_id);
CREATE INDEX IF NOT EXISTS idx_audits_manual_review ON audits (manual_review, created_at DESC) WHERE manual_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_audits_lead_id       ON audits (lead_id) WHERE lead_id IS NOT NULL;

-- Leads indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_audit ON leads (email, audit_id) WHERE audit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email       ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_source      ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_audit_id    ON leads (audit_id)  WHERE audit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id   ON leads (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at  ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up   ON leads (follow_up_at) WHERE follow_up_at IS NOT NULL AND status != 'converted';

-- Domain requests indexes
CREATE INDEX IF NOT EXISTS idx_domain_requests_tenant_id ON domain_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_requests_status ON domain_requests(status);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER FUNCTION (shared)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION waas_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

DROP TRIGGER IF EXISTS audits_updated_at ON audits;
CREATE TRIGGER audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

DROP TRIGGER IF EXISTS domain_requests_updated_at ON domain_requests;
CREATE TRIGGER domain_requests_updated_at
  BEFORE UPDATE ON domain_requests
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_requests ENABLE ROW LEVEL SECURITY;

-- Tenants policies
DROP POLICY IF EXISTS "tenants_public_read_active" ON tenants;
CREATE POLICY "tenants_public_read_active"
  ON tenants FOR SELECT TO anon, authenticated
  USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "tenants_admin_all" ON tenants;
CREATE POLICY "tenants_admin_all"
  ON tenants FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- Onboarding policies (anon can create/update during onboarding)
DROP POLICY IF EXISTS "anon_can_create_tenant" ON tenants;
CREATE POLICY "anon_can_create_tenant"
  ON tenants FOR INSERT TO anon
  WITH CHECK (status IN ('onboarding', 'pending_review'));

DROP POLICY IF EXISTS "anon_can_update_own_tenant_onboarding" ON tenants;
CREATE POLICY "anon_can_update_own_tenant_onboarding"
  ON tenants FOR UPDATE TO anon
  USING (status IN ('onboarding', 'pending_review'))
  WITH CHECK (status IN ('onboarding', 'pending_review'));

-- Audits policies
DROP POLICY IF EXISTS "audits_anon_insert_prospect" ON audits;
CREATE POLICY "audits_anon_insert_prospect"
  ON audits FOR INSERT TO anon
  WITH CHECK (audit_type = 'prospect' AND tenant_id IS NULL);

DROP POLICY IF EXISTS "audits_anon_read_own" ON audits;
CREATE POLICY "audits_anon_read_own"
  ON audits FOR SELECT TO anon
  USING (audit_type = 'prospect' AND tenant_id IS NULL);

DROP POLICY IF EXISTS "audits_admin_all" ON audits;
CREATE POLICY "audits_admin_all"
  ON audits FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- Leads policies
DROP POLICY IF EXISTS "leads_anon_insert" ON leads;
CREATE POLICY "leads_anon_insert"
  ON leads FOR INSERT TO anon
  WITH CHECK (source IN ('audit_tool', 'email_capture'));

DROP POLICY IF EXISTS "leads_admin_all" ON leads;
CREATE POLICY "leads_admin_all"
  ON leads FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- Domain requests policies
DROP POLICY IF EXISTS "domain_requests_anon_read" ON domain_requests;
CREATE POLICY "domain_requests_anon_read"
  ON domain_requests FOR SELECT TO anon
  USING (tenant_id IN (SELECT id FROM tenants WHERE status IN ('onboarding', 'pending_review')));

DROP POLICY IF EXISTS "domain_requests_anon_insert" ON domain_requests;
CREATE POLICY "domain_requests_anon_insert"
  ON domain_requests FOR INSERT TO anon
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE status IN ('onboarding', 'pending_review')));

DROP POLICY IF EXISTS "domain_requests_admin_all" ON domain_requests;
CREATE POLICY "domain_requests_admin_all"
  ON domain_requests FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Resolve tenant by hostname
CREATE OR REPLACE FUNCTION resolve_tenant_by_hostname(p_hostname TEXT)
RETURNS TABLE (
  id            UUID,
  slug          TEXT,
  domain        TEXT,
  subdomain     TEXT,
  brand_config  JSONB,
  package_tier  waas_package_tier,
  status        waas_tenant_status,
  target_industry TEXT,
  target_location TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_subdomain TEXT;
BEGIN
  RETURN QUERY
    SELECT
      t.id, t.slug, t.domain, t.subdomain,
      t.brand_config, t.package_tier, t.status,
      t.target_industry, t.target_location
    FROM tenants t
    WHERE t.domain = split_part(p_hostname, ':', 1)
      AND t.status = 'active'
      AND t.deleted_at IS NULL
    LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  v_subdomain := split_part(p_hostname, '.', 1);
  
  RETURN QUERY
    SELECT
      t.id, t.slug, t.domain, t.subdomain,
      t.brand_config, t.package_tier, t.status,
      t.target_industry, t.target_location
    FROM tenants t
    WHERE t.subdomain = v_subdomain
      AND t.status = 'active'
      AND t.deleted_at IS NULL
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_tenant_by_hostname(TEXT) TO anon, authenticated;

-- Create prospect audit
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
  IF p_target_url IS NULL OR length(trim(p_target_url)) = 0 THEN
    RAISE EXCEPTION 'target_url is required';
  END IF;

  IF array_length(p_competitor_urls, 1) > 5 THEN
    RAISE EXCEPTION 'Maximum 5 competitor URLs allowed';
  END IF;

  INSERT INTO audits (
    audit_type, status, target_url, competitor_urls,
    requestor_name, requestor_email, requestor_phone, requestor_company,
    expires_at
  )
  VALUES (
    'prospect', 'pending', trim(p_target_url), COALESCE(p_competitor_urls, '{}'),
    p_requestor_name, p_requestor_email, p_requestor_phone, p_requestor_company,
    NOW() + INTERVAL '90 days'
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_prospect_audit(TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Get audit status
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

-- Expire old audits
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

-- Capture audit lead
CREATE OR REPLACE FUNCTION capture_audit_lead(
  p_email         TEXT,
  p_audit_id      UUID,
  p_name          TEXT    DEFAULT NULL,
  p_phone         TEXT    DEFAULT NULL,
  p_company       TEXT    DEFAULT NULL,
  p_target_url    TEXT    DEFAULT NULL,
  p_industry      TEXT    DEFAULT NULL,
  p_location      TEXT    DEFAULT NULL,
  p_utm_source    TEXT    DEFAULT NULL,
  p_utm_medium    TEXT    DEFAULT NULL,
  p_utm_campaign  TEXT    DEFAULT NULL,
  p_referrer_url  TEXT    DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  INSERT INTO leads (
    email, audit_id, name, phone, company,
    target_url, industry, location, source,
    utm_source, utm_medium, utm_campaign, referrer_url,
    report_emailed, status
  )
  VALUES (
    lower(trim(p_email)),
    p_audit_id,
    p_name, p_phone, p_company,
    p_target_url, p_industry, p_location, 'email_capture',
    p_utm_source, p_utm_medium, p_utm_campaign, p_referrer_url,
    false, 'new'
  )
  ON CONFLICT (email, audit_id) WHERE audit_id IS NOT NULL
  DO UPDATE SET
    name          = COALESCE(EXCLUDED.name, leads.name),
    phone         = COALESCE(EXCLUDED.phone, leads.phone),
    company       = COALESCE(EXCLUDED.company, leads.company),
    updated_at    = NOW()
  RETURNING id INTO v_lead_id;

  IF p_audit_id IS NOT NULL THEN
    UPDATE audits
    SET
      requestor_email   = COALESCE(requestor_email, lower(trim(p_email))),
      requestor_name    = COALESCE(requestor_name, p_name),
      requestor_phone   = COALESCE(requestor_phone, p_phone),
      requestor_company = COALESCE(requestor_company, p_company),
      updated_at        = NOW()
    WHERE id = p_audit_id;
  END IF;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION capture_audit_lead(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- SEED DATA (demo tenant - only inserts if not exists)
-- ---------------------------------------------------------------------------

INSERT INTO tenants (slug, subdomain, domain, brand_config, package_tier, status, target_industry, target_location)
VALUES (
  'demo',
  'demo',
  NULL,
  '{
    "business_name": "Demo Plumbing Co.",
    "tagline": "Fast, Reliable, Trusted",
    "logo_url": null,
    "colors": {
      "primary": "#2563EB",
      "secondary": "#1E40AF",
      "accent": "#DBEAFE",
      "background": "#FFFFFF",
      "text": "#111827"
    },
    "contact": {
      "phone": "(555) 123-4567",
      "email": "info@demoplumbing.com",
      "city": "Chicago",
      "state": "IL"
    }
  }',
  'standard',
  'active',
  'plumbing',
  'Chicago, IL'
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- END OF COMPLETE IDEMPOTENT MIGRATION
-- =============================================================================