-- Diagnostic query to check deals table schema
-- Run this in Supabase SQL Editor to see the actual structure

-- 1. Check if deals table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'deals'
) as deals_table_exists;

-- 2. Show all columns in deals table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;

-- 3. Check for any column that might be used for stage/status
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
AND (column_name ILIKE '%stage%' OR column_name ILIKE '%status%');

-- 4. Show sample data from deals table (if it exists)
SELECT * FROM deals LIMIT 1;