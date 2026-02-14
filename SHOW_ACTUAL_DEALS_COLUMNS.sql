-- ============================================================================
-- DIAGNOSTIC: Show Actual Deals Table Structure
-- ============================================================================
-- Run this in Supabase SQL Editor to see what columns actually exist
-- ============================================================================

-- 1. Check if deals table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'deals'
        ) THEN 'YES - Deals table exists'
        ELSE 'NO - Deals table does NOT exist'
    END as table_exists;

-- 2. Show ALL columns in deals table with details
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;

-- 3. Show foreign key relationships
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'deals';

-- 4. Show indexes on deals table
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'deals'
AND schemaname = 'public';

-- 5. Show constraints on deals table
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'deals'::regclass;

-- 6. Show sample data (first row) if table has data
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM deals;
    
    IF row_count > 0 THEN
        RAISE NOTICE 'Deals table has % rows', row_count;
    ELSE
        RAISE NOTICE 'Deals table is empty';
    END IF;
END $$;

-- 7. Show RLS policies on deals table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'deals';