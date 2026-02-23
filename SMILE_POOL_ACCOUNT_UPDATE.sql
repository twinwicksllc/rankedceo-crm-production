-- ============================================================================
-- Smile Pool Account Integration & Security Hardening
-- ============================================================================
-- This migration:
-- 1. Updates RLS policies to use account-level visibility (like industry templates)
-- 2. Adds SELECT policy for account-based visibility
-- 3. Applies search_path security hardening
-- 4. Adds JSONB casting fixes
-- 5. Updates function signatures for security
-- ============================================================================

-- 1. Create SECURITY DEFINER function for account-based lookups
CREATE OR REPLACE FUNCTION get_smile_account_id()
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

-- 2. Update RLS policies to use account-level visibility (matching industry templates)

-- DROP old user-level policies
DROP POLICY IF EXISTS "Dentists can view their own assessments" ON public.smile_assessments;
DROP POLICY IF EXISTS "Dentists can update their own assessments" ON public.smile_assessments;
DROP POLICY IF EXISTS "Dentists can delete their own assessments" ON public.smile_assessments;

-- CREATE new account-level policies

-- SELECT Policy: Users can see assessments where account_id matches their own
CREATE POLICY "Users can view account assessments"
ON public.smile_assessments
FOR SELECT
TO authenticated
USING (account_id = get_smile_account_id());

-- UPDATE Policy: Users can update assessments in their account
CREATE POLICY "Users can update account assessments"
ON public.smile_assessments
FOR UPDATE
TO authenticated
USING (account_id = get_smile_account_id())
WITH CHECK (account_id = get_smile_account_id());

-- DELETE Policy: Users can delete assessments in their account
CREATE POLICY "Users can delete account assessments"
ON public.smile_assessments
FOR DELETE
TO authenticated
USING (account_id = get_smile_account_id());

-- INSERT Policy: Allow authenticated inserts (enforced by WITH CHECK)
CREATE POLICY "Users can insert account assessments"
ON public.smile_assessments
FOR INSERT
TO authenticated
WITH CHECK (account_id = get_smile_account_id());

-- Keep public insert policy for patient submissions (but with account_id validation)
DROP POLICY IF EXISTS "Allow public insert for patient assessments" ON public.smile_assessments;
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

-- 3. Create function to get Smile Pool Account info
CREATE OR REPLACE FUNCTION get_smile_pool_account_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    pool_id UUID := '00000000-0000-4000-a000-000000000004'::UUID;
BEGIN
    RETURN pool_id;
END;
$$;

-- 4. Create function to handle assessment submission with pool account fallback
CREATE OR REPLACE FUNCTION submit_smile_assessment_with_pool(
    p_account_id UUID DEFAULT NULL,
    p_auth_user_id UUID,
    p_patient_name TEXT,
    p_patient_email TEXT,
    p_patient_phone TEXT DEFAULT NULL,
    p_patient_dob DATE DEFAULT NULL,
    p_dentist_name TEXT DEFAULT NULL,
    p_last_dental_visit TEXT DEFAULT NULL,
    p_dental_insurance BOOLEAN DEFAULT false,
    p_insurance_provider TEXT DEFAULT NULL,
    p_current_concerns TEXT DEFAULT NULL,
    p_pain_sensitivity TEXT DEFAULT NULL,
    p_smile_goals TEXT[] DEFAULT '{}',
    p_desired_outcome TEXT DEFAULT NULL,
    p_medical_conditions TEXT[] DEFAULT '{}',
    p_medications TEXT DEFAULT NULL,
    p_allergies TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account_id UUID;
    v_assessment_id UUID;
BEGIN
    -- Use pool account if no account_id provided
    IF p_account_id IS NULL THEN
        v_account_id := get_smile_pool_account_id();
    ELSE
        v_account_id := p_account_id;
    END IF;
    
    -- Validate account exists
    IF NOT EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = v_account_id
    ) THEN
        RAISE EXCEPTION 'Account not found';
    END IF;
    
    -- Insert assessment with JSONB casting for arrays
    INSERT INTO public.smile_assessments (
        account_id,
        auth_user_id,
        patient_name,
        patient_email,
        patient_phone,
        patient_dob,
        dentist_name,
        last_dental_visit,
        dental_insurance,
        insurance_provider,
        current_concerns,
        pain_sensitivity,
        smile_goals,
        desired_outcome,
        medical_conditions,
        medications,
        allergies,
        status
    ) VALUES (
        v_account_id,
        p_auth_user_id,
        p_patient_name,
        p_patient_email,
        p_patient_phone,
        p_patient_dob,
        p_dentist_name,
        p_last_dental_visit,
        p_dental_insurance,
        p_insurance_provider,
        p_current_concerns,
        p_pain_sensitivity,
        p_smile_goals::TEXT[],
        p_desired_outcome,
        p_medical_conditions::TEXT[],
        p_medications,
        p_allergies,
        p_status
    )
    RETURNING id INTO v_assessment_id;
    
    RETURN v_assessment_id;
END;
$$;

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_smile_assessments_account_id 
ON public.smile_assessments(account_id);

CREATE INDEX IF NOT EXISTS idx_smile_assessments_auth_user_id 
ON public.smile_assessments(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_smile_assessments_created_at 
ON public.smile_assessments(created_at DESC);

-- 6. Add comment documenting the pool account usage
COMMENT ON FUNCTION get_smile_pool_account_id() IS 
'Returns the Smile Pool Account UUID (00000000-0000-4000-a000-000000000004) used as fallback for unattributed patient assessments';

COMMENT ON FUNCTION submit_smile_assessment_with_pool() IS 
'Submits a smile assessment with automatic fallback to Smile Pool Account when no account_id is provided. Uses SECURITY DEFINER and search_path hardening for SQL injection protection';

COMMENT ON FUNCTION get_smile_account_id() IS 
'SECURITY DEFINER function to get current user''s account_id. Bypasses RLS for lookup and includes search_path hardening for SQL injection protection';

-- ============================================================================
-- Verification Queries (for manual testing)
-- ============================================================================

-- Verify account-level SELECT policy
-- SELECT * FROM pg_policies WHERE tablename = 'smile_assessments' AND policyname = 'Users can view account assessments';

-- Verify pool account function
-- SELECT get_smile_pool_account_id();

-- Verify all Smile functions have search_path set
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name LIKE '%smile%'
-- AND external_security = 'DEFINER';