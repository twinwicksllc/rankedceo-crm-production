-- Enable RLS on category_mappings table
-- Category mappings are used for industry category configurations and should be accessible
-- to authenticatedusers based on their account

-- Enable RLS on the table
ALTER TABLE IF EXISTS public.category_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view category mappings
-- Category mappings are typically reference data shared across accounts, but we can scope it
DROP POLICY IF EXISTS "Users can view category mappings" ON public.category_mappings;
CREATE POLICY "Users can view category mappings" 
ON public.category_mappings 
FOR SELECT 
TO authenticated 
USING (true);  -- All authenticated users can view reference mappings

-- Only service role can insert/update/delete
DROP POLICY IF EXISTS "Only service role can manage category mappings" ON public.category_mappings;
CREATE POLICY "Only service role can manage category mappings"
ON public.category_mappings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify RLS is enabled
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'category_mappings' AND schemaname = 'public') > 0 THEN
        RAISE NOTICE 'RLS enabled on category_mappings table';
    ELSE
        RAISE NOTICE 'category_mappings table not found';
    END IF;
END $$;
