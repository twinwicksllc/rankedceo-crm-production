-- ============================================================================
-- FINAL COMPLETE MIGRATION - Custom for Your Schema
-- ============================================================================
-- This migration is customized for your actual deals table structure
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Add Missing Columns to Deals Table
-- ============================================================================

-- Your deals table has: owner_user_id, amount, stage_id, probability, close_date
-- App expects: user_id, value, stage, win_probability, expected_close_date

-- Add user_id column (maps to owner_user_id)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add value column (maps to amount)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS value DECIMAL(12,2) DEFAULT 0.00;

-- Add stage column (text version of stage_id)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage VARCHAR(50) DEFAULT 'Lead';

-- Add win_probability column (maps to probability)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS win_probability INTEGER DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100);

-- Add expected_close_date column (maps to close_date)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Add description column (missing entirely)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT;

-- Add assigned_to column (for commission tracking)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add created_by column (for audit trail)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: Sync Data from Existing Columns to New Columns
-- ============================================================================

-- Copy owner_user_id to user_id
UPDATE deals SET user_id = owner_user_id WHERE user_id IS NULL;

-- Copy amount to value
UPDATE deals SET value = amount WHERE value = 0.00 OR value IS NULL;

-- Copy probability to win_probability
UPDATE deals SET win_probability = probability WHERE win_probability = 0 OR win_probability IS NULL;

-- Copy close_date to expected_close_date
UPDATE deals SET expected_close_date = close_date WHERE expected_close_date IS NULL;

-- Set assigned_to to owner_user_id if not set
UPDATE deals SET assigned_to = owner_user_id WHERE assigned_to IS NULL;

-- Set created_by to owner_user_id if not set
UPDATE deals SET created_by = owner_user_id WHERE created_by IS NULL;

-- Map won/lost status to stage text
UPDATE deals 
SET stage = CASE 
    WHEN won = true THEN 'Won'
    WHEN won = false THEN 'Lost'
    ELSE 'Lead'
END
WHERE stage IS NULL OR stage = 'Lead';

-- ============================================================================
-- STEP 3: Add Constraints and Indexes
-- ============================================================================

-- Add check constraint for valid stage values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'deals_stage_check'
    ) THEN
        ALTER TABLE deals ADD CONSTRAINT deals_stage_check 
        CHECK (stage IN ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 
                         'lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Stage check constraint already exists';
END $$;

-- Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_value ON deals(value);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);

-- ============================================================================
-- STEP 4: Commission Tracking Tables
-- ============================================================================

-- Create commission_rates table
CREATE TABLE IF NOT EXISTS commission_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0 AND rate <= 100),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Create commissions table
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    deal_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_rates_account_id ON commission_rates(account_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_user_id ON commission_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_active ON commission_rates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_commissions_account_id ON commissions(account_id);
CREATE INDEX IF NOT EXISTS idx_commissions_deal_id ON commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at);

-- Enable Row Level Security
ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for commission_rates
DROP POLICY IF EXISTS "Users can view account commission rates" ON commission_rates;
CREATE POLICY "Users can view account commission rates" ON commission_rates
    FOR SELECT TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account commission rates" ON commission_rates;
CREATE POLICY "Users can manage account commission rates" ON commission_rates
    FOR ALL TO authenticated
    USING (account_id = get_current_user_account_id())
    WITH CHECK (account_id = get_current_user_account_id());

-- Create RLS policies for commissions
DROP POLICY IF EXISTS "Users can view account commissions" ON commissions;
CREATE POLICY "Users can view account commissions" ON commissions
    FOR SELECT TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account commissions" ON commissions;
CREATE POLICY "Users can manage account commissions" ON commissions
    FOR ALL TO authenticated
    USING (account_id = get_current_user_account_id())
    WITH CHECK (account_id = get_current_user_account_id());

-- ============================================================================
-- STEP 5: Commission Functions
-- ============================================================================

-- Function to get active commission rate for a user
CREATE OR REPLACE FUNCTION get_active_commission_rate(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(5,2)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_rate DECIMAL(5,2);
BEGIN
    SELECT rate INTO v_rate
    FROM commission_rates
    WHERE user_id = p_user_id
        AND is_active = true
        AND effective_from <= p_date
        AND (effective_to IS NULL OR effective_to >= p_date)
    ORDER BY effective_from DESC
    LIMIT 1;
    
    RETURN COALESCE(v_rate, 0.00);
END;
$$;

-- Function to calculate commission amount
CREATE OR REPLACE FUNCTION calculate_commission_amount(p_deal_value DECIMAL(12,2), p_rate DECIMAL(5,2))
RETURNS DECIMAL(12,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN ROUND(p_deal_value * (p_rate / 100), 2);
END;
$$;

-- Trigger function to auto-calculate commission when deal is won
CREATE OR REPLACE FUNCTION auto_create_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rate DECIMAL(5,2);
    v_amount DECIMAL(12,2);
    v_user_id UUID;
BEGIN
    -- Only create commission when deal is marked as won (case-insensitive)
    IF LOWER(NEW.stage) = 'won' AND (OLD.stage IS NULL OR LOWER(OLD.stage) != 'won') THEN
        -- Get the user who owns the deal (assigned_to or user_id or owner_user_id)
        v_user_id := COALESCE(NEW.assigned_to, NEW.user_id, NEW.owner_user_id);
        
        IF v_user_id IS NOT NULL THEN
            -- Get active commission rate for the user
            v_rate := get_active_commission_rate(v_user_id, CURRENT_DATE);
            
            -- Calculate commission amount using the new value column
            v_amount := calculate_commission_amount(NEW.value, v_rate);
            
            -- Create commission record
            INSERT INTO commissions (
                account_id,
                deal_id,
                user_id,
                amount,
                rate,
                deal_value,
                status
            ) VALUES (
                NEW.account_id,
                NEW.id,
                v_user_id,
                v_amount,
                v_rate,
                NEW.value,
                'pending'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on deals table
DROP TRIGGER IF EXISTS trigger_auto_create_commission ON deals;
CREATE TRIGGER trigger_auto_create_commission
    AFTER INSERT OR UPDATE OF stage ON deals
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_commission();

-- Function to update commission when deal value changes
CREATE OR REPLACE FUNCTION update_commission_on_deal_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_commission_id UUID;
    v_new_amount DECIMAL(12,2);
BEGIN
    -- Only update if deal is won and value changed (case-insensitive)
    IF LOWER(NEW.stage) = 'won' AND NEW.value != OLD.value THEN
        -- Find existing commission for this deal
        SELECT id INTO v_commission_id
        FROM commissions
        WHERE deal_id = NEW.id
            AND status = 'pending'
        LIMIT 1;
        
        IF v_commission_id IS NOT NULL THEN
            -- Recalculate commission amount
            SELECT calculate_commission_amount(NEW.value, rate)
            INTO v_new_amount
            FROM commissions
            WHERE id = v_commission_id;
            
            -- Update commission
            UPDATE commissions
            SET amount = v_new_amount,
                deal_value = NEW.value,
                updated_at = NOW()
            WHERE id = v_commission_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for deal value changes
DROP TRIGGER IF EXISTS trigger_update_commission_on_deal_change ON deals;
CREATE TRIGGER trigger_update_commission_on_deal_change
    AFTER UPDATE OF value ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_commission_on_deal_change();

-- Add updated_at trigger for commission_rates
CREATE OR REPLACE FUNCTION update_commission_rates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_commission_rates_updated_at ON commission_rates;
CREATE TRIGGER trigger_update_commission_rates_updated_at
    BEFORE UPDATE ON commission_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_commission_rates_updated_at();

-- Add updated_at trigger for commissions
CREATE OR REPLACE FUNCTION update_commissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_commissions_updated_at ON commissions;
CREATE TRIGGER trigger_update_commissions_updated_at
    BEFORE UPDATE ON commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_commissions_updated_at();

-- ============================================================================
-- STEP 6: Onboarding Fields
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

-- ============================================================================
-- STEP 7: Onboarding Functions
-- ============================================================================

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
-- MIGRATION COMPLETE
-- ============================================================================
-- All migrations have been applied successfully!
-- 
-- What was done:
-- 1. Added missing columns to deals table (user_id, value, stage, etc.)
-- 2. Synced data from existing columns (owner_user_id → user_id, amount → value)
-- 3. Created commission tracking tables and triggers
-- 4. Added onboarding fields to accounts table
-- 5. Created SECURITY DEFINER functions for onboarding
--
-- Next steps:
-- 1. Test deals page at /deals
-- 2. Test commissions page at /commissions
-- 3. Test onboarding wizard at /onboarding
-- 4. Create a test deal and mark it as won to verify commission auto-creation
-- ============================================================================