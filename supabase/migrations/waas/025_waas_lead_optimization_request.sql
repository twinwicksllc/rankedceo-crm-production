-- ---------------------------------------------------------------------------
-- MIGRATION 025: Add optimization_requested to leads
-- ---------------------------------------------------------------------------

ALTER TABLE leads ADD COLUMN IF NOT EXISTS optimization_requested BOOLEAN DEFAULT false;

-- Drop old function to change signature
DROP FUNCTION IF EXISTS capture_audit_lead(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION capture_audit_lead(
  p_email                   TEXT,
  p_audit_id                UUID,
  p_name                    TEXT    DEFAULT NULL,
  p_phone                   TEXT    DEFAULT NULL,
  p_company                 TEXT    DEFAULT NULL,
  p_target_url              TEXT    DEFAULT NULL,
  p_industry                TEXT    DEFAULT NULL,
  p_location                TEXT    DEFAULT NULL,
  p_utm_source              TEXT    DEFAULT NULL,
  p_utm_medium              TEXT    DEFAULT NULL,
  p_utm_campaign            TEXT    DEFAULT NULL,
  p_referrer_url            TEXT    DEFAULT NULL,
  p_optimization_requested  BOOLEAN DEFAULT FALSE
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
    report_emailed, status, optimization_requested
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
    'new',
    p_optimization_requested
  )
  ON CONFLICT (email, audit_id) WHERE audit_id IS NOT NULL
  DO UPDATE SET
    name                    = COALESCE(EXCLUDED.name, leads.name),
    phone                   = COALESCE(EXCLUDED.phone, leads.phone),
    company                 = COALESCE(EXCLUDED.company, leads.company),
    optimization_requested  = EXCLUDED.optimization_requested OR leads.optimization_requested,
    updated_at              = NOW()
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

GRANT EXECUTE ON FUNCTION capture_audit_lead(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
