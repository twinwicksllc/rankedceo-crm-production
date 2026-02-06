-- Apply RLS Policies to lead_sources and qualified_leads_global tables
-- This migration secures the lead-related tables with proper multi-tenant isolation

-- First, add account_id column if it doesn't exist for lead_sources
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lead_sources' 
        AND column_name = 'account_id'
    ) THEN
        ALTER TABLE lead_sources ADD COLUMN account_id UUID REFERENCES accounts(id);
        RAISE NOTICE 'Added account_id column to lead_sources table';
    ELSE
        RAISE NOTICE 'account_id column already exists in lead_sources table';
    END IF;
END $$;

-- First, add account_id column if it doesn't exist for qualified_leads_global
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'qualified_leads_global' 
        AND column_name = 'account_id'
    ) THEN
        ALTER TABLE qualified_leads_global ADD COLUMN account_id UUID REFERENCES accounts(id);
        RAISE NOTICE 'Added account_id column to qualified_leads_global table';
    ELSE
        RAISE NOTICE 'account_id column already exists in qualified_leads_global table';
    END IF;
END $$;

-- Enable RLS and apply policies to lead_sources table
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON lead_sources;

CREATE POLICY "Users can view account data" ON lead_sources 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON lead_sources;

CREATE POLICY "Users can manage account data" ON lead_sources 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- Enable RLS and apply policies to qualified_leads_global table
ALTER TABLE qualified_leads_global ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON qualified_leads_global;

CREATE POLICY "Users can view account data" ON qualified_leads_global 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON qualified_leads_global;

CREATE POLICY "Users can manage account data" ON qualified_leads_global 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- Verification queries
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
WHERE tablename IN ('lead_sources', 'qualified_leads_global')
ORDER BY tablename, policyname;

-- Notice output
DO $$
BEGIN
    RAISE NOTICE 'RLS policies applied to lead_sources table';
    RAISE NOTICE 'RLS policies applied to qualified_leads_global table';
END $$;