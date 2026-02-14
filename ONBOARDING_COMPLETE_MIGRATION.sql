-- ============================================================================
-- COMPLETE ONBOARDING MIGRATION
-- Run this entire file in Supabase SQL Editor to enable onboarding
-- ============================================================================

-- ============================================================================
-- PART 1: Add Onboarding Fields to Accounts Table
-- ============================================================================

-- Add onboarding fields to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add company information fields if they don't exist
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS address TEXT;

-- Create index for onboarding queries
CREATE INDEX IF NOT EXISTS idx_accounts_onboarding_completed ON accounts(onboarding_completed);

-- ============================================================================
-- PART 2: Create SECURITY DEFINER Functions
-- ============================================================================

-- Function to mark onboarding as complete
CREATE OR REPLACE FUNCTION complete_onboarding(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE accounts
    SET onboarding_completed = true,
        onboarding_completed_at = NOW(),
        onboarding_step = 5
    WHERE id = p_account_id;
END;
$$;

-- Function to update onboarding step
CREATE OR REPLACE FUNCTION update_onboarding_step(p_account_id UUID, p_step INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE accounts
    SET onboarding_step = p_step
    WHERE id = p_account_id;
END;
$$;

-- Function to skip onboarding
CREATE OR REPLACE FUNCTION skip_onboarding(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE accounts
    SET onboarding_skipped = true,
        onboarding_completed = true,
        onboarding_completed_at = NOW()
    WHERE id = p_account_id;
END;
$$;

-- Function to update company info during onboarding
CREATE OR REPLACE FUNCTION update_company_info(
    p_account_id UUID,
    p_name VARCHAR,
    p_company_size VARCHAR,
    p_industry VARCHAR,
    p_website VARCHAR,
    p_phone VARCHAR,
    p_address TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE accounts
    SET name = p_name,
        company_size = p_company_size,
        industry = p_industry,
        website = p_website,
        phone = p_phone,
        address = p_address,
        onboarding_step = 2
    WHERE id = p_account_id;
END;
$$;

-- Function to update preferences during onboarding
CREATE OR REPLACE FUNCTION update_preferences(
    p_account_id UUID,
    p_timezone VARCHAR,
    p_settings JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE accounts
    SET timezone = p_timezone,
        settings = p_settings
    WHERE id = p_account_id;
END;
$$;

-- ============================================================================
-- PART 3: Add Comments
-- ============================================================================

COMMENT ON COLUMN accounts.onboarding_completed IS 'Whether the user has completed the onboarding process';
COMMENT ON COLUMN accounts.onboarding_step IS 'Current step in the onboarding process (0-5)';
COMMENT ON COLUMN accounts.onboarding_skipped IS 'Whether the user skipped the onboarding';
COMMENT ON COLUMN accounts.company_size IS 'Size of the company (1-10, 11-50, 51-200, 201-500, 501+)';
COMMENT ON COLUMN accounts.industry IS 'Industry/vertical of the company';

COMMENT ON FUNCTION complete_onboarding IS 'Marks onboarding as complete, bypassing RLS';
COMMENT ON FUNCTION update_onboarding_step IS 'Updates current onboarding step, bypassing RLS';
COMMENT ON FUNCTION skip_onboarding IS 'Marks onboarding as skipped, bypassing RLS';
COMMENT ON FUNCTION update_company_info IS 'Updates company information during onboarding, bypassing RLS';
COMMENT ON FUNCTION update_preferences IS 'Updates user preferences during onboarding, bypassing RLS';

-- ============================================================================
-- VERIFICATION QUERY (Run this after to verify)
-- ============================================================================

-- Uncomment and run this to verify all functions were created:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--     AND routine_name IN (
--         'update_onboarding_step',
--         'complete_onboarding',
--         'skip_onboarding',
--         'update_company_info',
--         'update_preferences'
--     )
-- ORDER BY routine_name;

-- You should see 5 functions listed.
