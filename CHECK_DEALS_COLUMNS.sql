-- Run this in Supabase SQL Editor to see what columns exist in deals table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;

-- Also check if deals table exists at all
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'deals'
) as deals_exists;

-- Show a sample row if table exists and has data
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deals') THEN
        RAISE NOTICE 'Deals table exists. Checking for data...';
        PERFORM * FROM deals LIMIT 1;
    ELSE
        RAISE NOTICE 'Deals table does not exist!';
    END IF;
END $$;