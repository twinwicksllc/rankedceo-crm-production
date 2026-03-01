-- ============================================================
-- Normalize Calendly Invitee URIs in Appointments Table
-- ============================================================
-- This migration ensures all existing appointments have their
-- calendly_invitee_uri normalized (trailing slashes removed)
-- ============================================================

DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Normalize calendly_invitee_uri (remove trailing slashes)
  UPDATE public.appointments
  SET 
    calendly_invitee_uri = REGEXP_REPLACE(calendly_invitee_uri, '/$', ''),
    updated_at = NOW()
  WHERE calendly_invitee_uri LIKE '%/'
  AND calendly_invitee_uri IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Normalized % calendly_invitee_uri records in appointments table (removed trailing slashes)', updated_count;

  RAISE NOTICE '✅ Calendly invitee URI normalization complete';
  RAISE NOTICE '';
  RAISE NOTICE 'All invitee URIs now stored without trailing slashes';
  RAISE NOTICE 'Cancellation webhook events will now match correctly';
END $$;

-- ============================================================
-- Verification Query
-- ============================================================
-- Run this after the migration to verify no URIs have trailing slashes
-- ============================================================

SELECT 
  id,
  invitee_email,
  calendly_invitee_uri,
  status,
  CASE 
    WHEN calendly_invitee_uri LIKE '%/' THEN 'ERROR: Has trailing slash'
    ELSE 'OK: Normalized'
  END as uri_status
FROM public.appointments
WHERE calendly_invitee_uri IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;