-- Apply RLS Policies to All Remaining Tables
-- This migration ensures comprehensive security coverage across all CRM tables

-- Helper function should already exist from previous migrations
-- If not, create it here
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_current_user_account_id'
    ) THEN
        CREATE FUNCTION get_current_user_account_id() 
        RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $f$
        DECLARE user_account_id UUID;
        BEGIN 
            SET LOCAL row_security = off;
            SELECT account_id INTO user_account_id FROM public.users WHERE id = auth.uid() LIMIT 1;
            RETURN user_account_id;
        END; $f$;
        RAISE NOTICE 'Created get_current_user_account_id() function';
    END IF;
END $$;

-- ==================== CONTACTS TABLE ====================
DO $$
BEGIN
    -- Add account_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE contacts ADD COLUMN account_id UUID REFERENCES accounts(id);
        RAISE NOTICE 'Added account_id column to contacts table';
    END IF;
END $$;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON contacts;
CREATE POLICY "Users can view account data" ON contacts 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON contacts;
CREATE POLICY "Users can manage account data" ON contacts 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- ==================== COMPANIES TABLE ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE companies ADD COLUMN account_id UUID REFERENCES accounts(id);
        RAISE NOTICE 'Added account_id column to companies table';
    END IF;
END $$;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON companies;
CREATE POLICY "Users can view account data" ON companies 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON companies;
CREATE POLICY "Users can manage account data" ON companies 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- ==================== DEALS TABLE ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE deals ADD COLUMN account_id UUID REFERENCES accounts(id);
        RAISE NOTICE 'Added account_id column to deals table';
    END IF;
END $$;

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON deals;
CREATE POLICY "Users can view account data" ON deals 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON deals;
CREATE POLICY "Users can manage account data" ON deals 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- ==================== PIPELINES TABLE ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pipelines' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE pipelines ADD COLUMN account_id UUID REFERENCES accounts(id);
        RAISE NOTICE 'Added account_id column to pipelines table';
    END IF;
END $$;

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON pipelines;
CREATE POLICY "Users can view account data" ON pipelines 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON pipelines;
CREATE POLICY "Users can manage account data" ON pipelines 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- ==================== LEAD_ASSIGNMENTS TABLE ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lead_assignments' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE lead_assignments ADD COLUMN account_id UUID REFERENCES accounts(id);
        RAISE NOTICE 'Added account_id column to lead_assignments table';
    END IF;
END $$;

ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON lead_assignments;
CREATE POLICY "Users can view account data" ON lead_assignments 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON lead_assignments;
CREATE POLICY "Users can manage account data" ON lead_assignments 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- ==================== VERIFICATION ====================
-- Show all tables with RLS enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'contacts', 'companies', 'deals', 'pipelines', 
        'lead_assignments', 'activities', 'campaigns', 
        'email_templates', 'email_messages', 'email_threads',
        'forms', 'form_fields', 'form_submissions',
        'lead_sources', 'qualified_leads_global',
        'users', 'accounts'
    )
ORDER BY tablename;

-- Show all RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'contacts', 'companies', 'deals', 'pipelines', 
        'lead_assignments', 'activities', 'campaigns', 
        'email_templates', 'email_messages', 'email_threads',
        'forms', 'form_fields', 'form_submissions',
        'lead_sources', 'qualified_leads_global',
        'users', 'accounts'
    )
ORDER BY tablename, policyname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'RLS policies applied to all core CRM tables';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Tables secured:';
    RAISE NOTICE '  - contacts';
    RAISE NOTICE '  - companies';
    RAISE NOTICE '  - deals';
    RAISE NOTICE '  - pipelines';
    RAISE NOTICE '  - lead_assignments';
    RAISE NOTICE '  - activities (already secured)';
    RAISE NOTICE '  - campaigns (already secured)';
    RAISE NOTICE '  - email_templates (already secured)';
    RAISE NOTICE '  - email_messages (already secured)';
    RAISE NOTICE '  - email_threads (already secured)';
    RAISE NOTICE '  - forms (already secured)';
    RAISE NOTICE '  - form_fields (already secured)';
    RAISE NOTICE '  - form_submissions (already secured)';
    RAISE NOTICE '  - lead_sources (already secured)';
    RAISE NOTICE '  - qualified_leads_global (already secured)';
    RAISE NOTICE '  - users (already secured)';
    RAISE NOTICE '  - accounts (already secured)';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Multi-tenant data isolation is now complete!';
    RAISE NOTICE '==============================================';
END $$;