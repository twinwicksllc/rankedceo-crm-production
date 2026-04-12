-- =============================================================================
-- WaaS Foundation: Migration 003 - Leads Table
-- Captures prospect contact info from the audit tool email capture form.
-- Run in the WaaS Supabase project AFTER 002_waas_audits.sql
-- =============================================================================

CREATE TYPE waas_lead_status AS ENUM (
  'new',          -- Just captured via email form
  'contacted',    -- Darrick/team has reached out
  'qualified',    -- Confirmed interest + budget
  'converted',    -- Became a paying customer
  'lost'          -- No longer interested
);

CREATE TYPE waas_lead_source AS ENUM (
  'audit_tool',       -- Submitted URL for audit
  'email_capture',    -- Entered email to get report
  'onboarding',       -- Started onboarding flow
  'referral',         -- Referred by existing customer
  'manual'            -- Added manually by admin
);

-- ---------------------------------------------------------------------------
-- LEADS TABLE
-- ---------------------------------------------------------------------------

CREATE TABLE leads (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info
  name                TEXT          NULL,
  email               TEXT          NOT NULL,
  phone               TEXT          NULL,
  company             TEXT          NULL,

  -- Lead classification
  status              waas_lead_status    NOT NULL DEFAULT 'new',
  source              waas_lead_source    NOT NULL DEFAULT 'audit_tool',

  -- Audit linkage (the audit that generated this lead)
  audit_id            UUID          NULL REFERENCES audits(id) ON DELETE SET NULL,

  -- Tenant linkage (if lead converts to a WaaS customer)
  tenant_id           UUID          NULL REFERENCES tenants(id) ON DELETE SET NULL,

  -- Business context (from audit)
  target_url          TEXT          NULL,     -- their current website
  industry            TEXT          NULL,     -- e.g. 'plumbing'
  location            TEXT          NULL,     -- e.g. 'Chicago, IL'

  -- Lead scoring (0-100)
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

  -- Email report sent
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
-- INDEXES
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX idx_leads_email_audit ON leads (email, audit_id) WHERE audit_id IS NOT NULL;
CREATE INDEX idx_leads_email       ON leads (email);
CREATE INDEX idx_leads_status      ON leads (status);
CREATE INDEX idx_leads_source      ON leads (source);
CREATE INDEX idx_leads_audit_id    ON leads (audit_id)  WHERE audit_id IS NOT NULL;
CREATE INDEX idx_leads_tenant_id   ON leads (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_leads_created_at  ON leads (created_at DESC);
CREATE INDEX idx_leads_follow_up   ON leads (follow_up_at) WHERE follow_up_at IS NOT NULL AND status != 'converted';

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (email capture form is public)
CREATE POLICY "leads_anon_insert"
  ON leads
  FOR INSERT
  TO anon
  WITH CHECK (source IN ('audit_tool', 'email_capture'));

-- Admins can do everything
CREATE POLICY "leads_admin_all"
  ON leads
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
-- HELPER: Upsert lead from audit email capture
-- Returns the lead ID (creates or updates existing lead for same email+audit)
-- ---------------------------------------------------------------------------

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
  -- Validate email
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  -- Upsert: if same email + audit already captured, update it
  INSERT INTO leads (
    email, audit_id, name, phone, company,
    target_url, industry, location, source,
    utm_source, utm_medium, utm_campaign, referrer_url,
    report_emailed, status
  )
  VALUES (
    lower(trim(p_email)),
    p_audit_id,
    p_name,
    p_phone,
    p_company,
    p_target_url,
    p_industry,
    p_location,
    'email_capture',
    p_utm_source,
    p_utm_medium,
    p_utm_campaign,
    p_referrer_url,
    false,
    'new'
  )
  ON CONFLICT (email, audit_id) WHERE audit_id IS NOT NULL
  DO UPDATE SET
    name          = COALESCE(EXCLUDED.name, leads.name),
    phone         = COALESCE(EXCLUDED.phone, leads.phone),
    company       = COALESCE(EXCLUDED.company, leads.company),
    updated_at    = NOW()
  RETURNING id INTO v_lead_id;

  -- Also update the audit record to link this lead
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

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================