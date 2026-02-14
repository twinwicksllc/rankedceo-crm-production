-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
-- Run this to verify the migration was successful
-- ============================================================================

-- 1. Verify deals table has all expected columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
AND column_name IN ('user_id', 'value', 'stage', 'win_probability', 'expected_close_date', 'description', 'assigned_to', 'created_by')
ORDER BY column_name;

-- 2. Verify commission tables exist
SELECT 
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'commission_rates') as commission_rates_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'commissions') as commissions_exists;

-- 3. Verify commission tables have RLS enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('commission_rates', 'commissions');

-- 4. Verify commission triggers exist
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'deals'
AND trigger_name LIKE '%commission%';

-- 5. Verify onboarding fields exist in accounts table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'accounts'
AND column_name LIKE '%onboarding%'
ORDER BY column_name;

-- 6. Count existing deals
SELECT COUNT(*) as total_deals FROM deals;

-- 7. Show sample deal data with new columns
SELECT 
    id,
    title,
    owner_user_id,
    user_id,
    amount,
    value,
    stage_id,
    stage,
    probability,
    win_probability,
    won
FROM deals 
ORDER BY created_at DESC
LIMIT 3;