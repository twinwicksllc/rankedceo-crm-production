-- ============================================
-- Calendly URI Matching Diagnostic Query
-- ============================================
-- Run this in Supabase SQL Editor to check your Calendly connections
-- ============================================

SELECT 
  id,
  account_id,
  user_id,
  calendly_user_uri,
  calendly_org_uri,
  is_active,
  created_at,
  updated_at,
  -- Show URI length and trailing slash status
  LENGTH(calendly_user_uri) as uri_length,
  CASE 
    WHEN calendly_user_uri LIKE '%/' THEN 'HAS_TRAILING_SLASH'
    ELSE 'NO_TRAILING_SLASH'
  END as trailing_slash_status
FROM calendly_connections
WHERE is_active = true
ORDER BY created_at DESC;

-- ============================================
-- Also check if there are any inactive connections
-- ============================================

SELECT 
  id,
  account_id,
  user_id,
  calendly_user_uri,
  is_active,
  created_at
FROM calendly_connections
WHERE is_active = false
ORDER BY created_at DESC;

-- ============================================
-- Check recent appointments to see what URIs are being received
-- ============================================

SELECT 
  id,
  account_id,
  booked_by_user_id,
  calendly_event_uri,
  calendly_invitee_uri,
  created_at
FROM appointments
WHERE calendly_event_uri IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;