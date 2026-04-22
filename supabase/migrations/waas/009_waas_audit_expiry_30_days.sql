-- =============================================================================
-- WaaS Foundation: Migration 009 - Standardize Audit Expiry To 30 Days
-- Run AFTER 008_waas_templates.sql
-- =============================================================================

-- 1) Update default expiry for all newly inserted audits.
ALTER TABLE audits
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days');

-- 2) Keep helper function aligned with 30-day expiry policy.
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
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- 3) Backfill existing rows so all audits follow the same 30-day policy
--    relative to when they were requested.
UPDATE audits
SET
  expires_at = requested_at + INTERVAL '30 days',
  updated_at = NOW()
WHERE requested_at IS NOT NULL
  AND expires_at IS DISTINCT FROM (requested_at + INTERVAL '30 days');

-- =============================================================================
-- END OF MIGRATION 009
-- =============================================================================
