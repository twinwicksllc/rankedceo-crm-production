-- ============================================================================
-- SIMPLE: Just show me what columns exist in deals table
-- ============================================================================
-- Copy and paste this into Supabase SQL Editor and run it
-- ============================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;