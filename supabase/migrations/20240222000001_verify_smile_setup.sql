-- ============================================================================
-- Smile Assessment Setup Verification & Fixes
-- ============================================================================
-- This migration:
-- 1. Verifies the account_id column exists in smile_assessments table
-- 2. Creates the Smile Pool Account if it doesn't exist
-- 3. Updates RLS policies to use account_id
-- 4. Adds diagnostic functions for troubleshooting
-- ============================================================================

-- 1. Verify account_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'account_id'
    ) THEN
        RAISE EXCEPTION 'account_id column does not exist in smile_assessments table';
    END IF;
    
    RAISE NOTICE '✓ account_id column exists in smile_assessments table';
END $$;

-- 2. Create Smile Pool Account if it doesn't exist
INSERT INTO public.accounts (id, name, slug, status, plan, test_mode, settings, onboarding_completed, timezone)
VALUES (
    '00000000-0000-4000-a000-000000000004',
    'Smile Pool Account',
    'smile-pool',
    'active',
    'free',
    false,
    '{}'::JSONB,
    true,
    'UTC'
)
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE '✓ Smile Pool Account verified/created (ID: 00000000-0000-4000-a000-000000000004)';

-- 3. Verify Pool Account exists
DO $$
DECLARE
    pool_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = '00000000-0000-4000-a000-000000000004'
    ) INTO pool_exists;
    
    IF pool_exists THEN
        RAISE NOTICE '✓ Smile Pool Account exists';
    ELSE
        RAISE EXCEPTION 'Smile Pool Account does not exist';
    END IF;
END $$;

-- 4. Create helper function for account_id lookup (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_current_smile_account_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    user_account_id UUID;
BEGIN
    -- Bypass RLS for the lookup
    SET LOCAL row_security = off;
    
    SELECT account_id INTO user_account_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    
    RETURN user_account_id;
END;
$$;

RAISE NOTICE '✓ get_current_smile_account_id() function created';

-- 5. Update RLS policies to use account_id

-- Drop old user-level policies
DROP POLICY IF EXISTS "Dentists can view their own assessments" ON public.smile_assessments;
DROP POLICY IF EXISTS "Dentists can update their own assessments" ON public.smile_assessments;
DROP POLICY IF EXISTS "Dentists can delete their own assessments" ON public.smile_assessments;
DROP POLICY IF EXISTS "Allow public insert for patient assessments" ON public.smile_assessments;

RAISE NOTICE '✓ Old policies dropped';

-- Create new account-level policies

-- SELECT Policy: Users can see assessments where account_id matches their own
CREATE POLICY "Users can view account assessments"
ON public.smile_assessments
FOR SELECT
TO authenticated
USING (account_id = get_current_smile_account_id());

RAISE NOTICE '✓ SELECT policy created (account-based)';

-- UPDATE Policy: Users can update assessments in their account
CREATE POLICY "Users can update account assessments"
ON public.smile_assessments
FOR UPDATE
TO authenticated
USING (account_id = get_current_smile_account_id())
WITH CHECK (account_id = get_current_smile_account_id());

RAISE NOTICE '✓ UPDATE policy created (account-based)';

-- DELETE Policy: Users can delete assessments in their account
CREATE POLICY "Users can delete account assessments"
ON public.smile_assessments
FOR DELETE
TO authenticated
USING (account_id = get_current_smile_account_id());

RAISE NOTICE '✓ DELETE policy created (account-based)';

-- INSERT Policy: Allow authenticated inserts (enforced by WITH CHECK)
CREATE POLICY "Users can insert account assessments"
ON public.smile_assessments
FOR INSERT
TO authenticated
WITH CHECK (account_id = get_current_smile_account_id());

RAISE NOTICE '✓ INSERT policy created (account-based)';

-- Public insert policy for patient submissions
CREATE POLICY "Allow public insert for patient assessments"
ON public.smile_assessments
FOR INSERT
TO public
WITH CHECK (
    -- Validate that account_id exists in accounts table
    EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = account_id
    )
);

RAISE NOTICE '✓ Public INSERT policy created with account validation';

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_smile_assessments_account_id 
ON public.smile_assessments(account_id);

CREATE INDEX IF NOT EXISTS idx_smile_assessments_auth_user_id 
ON public.smile_assessments(auth_user_id);

RAISE NOTICE '✓ Performance indexes added';

-- 7. Create diagnostic function
CREATE OR REPLACE FUNCTION diagnose_smile_assessments()
RETURNS TABLE(
    step TEXT,
    status TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check table exists
    RETURN QUERY SELECT 
        'Table exists'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smile_assessments') 
             THEN '✓ PASS'::TEXT 
             ELSE '✗ FAIL'::TEXT END,
        NULL::TEXT;
    
    -- Check account_id column
    RETURN QUERY SELECT 
        'account_id column'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smile_assessments' AND column_name = 'account_id') 
             THEN '✓ PASS'::TEXT 
             ELSE '✗ FAIL'::TEXT END,
        NULL::TEXT;
    
    -- Check Pool Account
    RETURN QUERY SELECT 
        'Pool Account exists'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM accounts WHERE id = '00000000-0000-4000-a000-000000000004') 
             THEN '✓ PASS'::TEXT 
             ELSE '✗ FAIL'::TEXT END,
        id::TEXT
    FROM accounts
    WHERE id = '00000000-0000-4000-a000-000000000004';
    
    -- Check RLS enabled
    RETURN QUERY SELECT 
        'RLS enabled'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'smile_assessments' AND rowsecurity = true) 
             THEN '✓ PASS'::TEXT 
             ELSE '✗ FAIL'::TEXT END,
        NULL::TEXT;
    
    -- Check policies
    RETURN QUERY SELECT 
        'RLS policies count'::TEXT,
        CASE WHEN COUNT(*) >= 5 THEN '✓ PASS'::TEXT ELSE '✗ FAIL'::TEXT END,
        COUNT(*)::TEXT
    FROM pg_policies 
    WHERE tablename = 'smile_assessments';
    
    RETURN;
END;
$$;

RAISE NOTICE '✓ Diagnostic function created';

-- 8. Run diagnostics
SELECT * FROM diagnose_smile_assessments();

RAISE NOTICE '═══════════════════════════════════════════════════════════════';
RAISE NOTICE 'Smile Assessment Setup Complete!';
RAISE NOTICE '═══════════════════════════════════════════════════════════════';
RAISE NOTICE 'To run diagnostics later: SELECT * FROM diagnose_smile_assessments();';
RAISE NOTICE '═══════════════════════════════════════════════════════════════';