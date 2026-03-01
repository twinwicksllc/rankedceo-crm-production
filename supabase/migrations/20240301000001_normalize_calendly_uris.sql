-- ============================================================
-- Normalize Calendly URIs - One-time Migration
-- ============================================================
-- This migration ensures all existing calendly_connections records
-- have their URIs normalized (trailing slashes removed)
-- ============================================================

DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Normalize calendly_user_uri (remove trailing slashes)
  UPDATE public.calendly_connections
  SET 
    calendly_user_uri = REGEXP_REPLACE(calendly_user_uri, '/$', ''),
    updated_at = NOW()
  WHERE calendly_user_uri LIKE '%/'
  AND calendly_user_uri IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Normalized % calendly_user_uri records (removed trailing slashes)', updated_count;

  -- Normalize calendly_organization_uri (remove trailing slashes)
  UPDATE public.calendly_connections
  SET 
    calendly_organization_uri = REGEXP_REPLACE(calendly_organization_uri, '/$', ''),
    updated_at = NOW()
  WHERE calendly_organization_uri LIKE '%/'
  AND calendly_organization_uri IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Normalized % calendly_organization_uri records (removed trailing slashes)', updated_count;

  RAISE NOTICE '✅ Calendly URI normalization complete';
  RAISE NOTICE '';
  RAISE NOTICE 'All URIs now stored without trailing slashes';
  RAISE NOTICE 'Webhook matching will work reliably for all users';
END $$;

-- ============================================================
-- Verification Query
-- ============================================================
-- Run this after the migration to verify no URIs have trailing slashes
-- ============================================================

SELECT 
  id,
  account_id,
  user_id,
  calendly_user_uri,
  calendly_organization_uri,
  CASE 
    WHEN calendly_user_uri LIKE '%/' THEN 'ERROR: Has trailing slash'
    ELSE 'OK: Normalized'
  END as user_uri_status,
  CASE 
    WHEN calendly_organization_uri LIKE '%/' THEN 'ERROR: Has trailing slash'
    WHEN calendly_organization_uri IS NULL THEN 'N/A'
    ELSE 'OK: Normalized'
  END as org_uri_status
FROM public.calendly_connections
ORDER BY created_at DESC;