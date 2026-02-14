-- ============================================================================
-- COMPLETE MIGRATION - DEALS TABLE FIX + ALL CRITICAL MIGRATIONS
-- ============================================================================
-- This file includes:
-- 0. Fix deals table (add missing columns)
-- 1. Commission tracking
-- 2. Onboarding fields
-- 3. Onboarding functions
-- ============================================================================

-- ============================================================================
-- STEP 0: FIX DEALS TABLE - Add all missing columns
-- ============================================================================

-- Check if deals table exists, if not create it
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    stage VARCHAR(50) DEFAULT 'Lead',
    value DECIMAL(12,2) DEFAULT 0.00,
    win_probability INTEGER DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100),
    expected_close_date DATE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add stage column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'stage'
    ) THEN
        ALTER TABLE deals ADD COLUMN stage VARCHAR(50) DEFAULT 'Lead';
        RAISE NOTICE 'Added stage column to deals table';
    END IF;

    -- Add value column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'value'
    ) THEN
        ALTER TABLE deals ADD COLUMN value DECIMAL(12,2) DEFAULT 0.00;
        RAISE NOTICE 'Added value column to deals table';
    END IF;

    -- Add win_probability column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'win_probability'
    ) THEN
        ALTER TABLE deals ADD COLUMN win_probability INTEGER DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100);
        RAISE NOTICE 'Added win_probability column to deals table';
    END IF;

    -- Add expected_close_date column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'expected_close_date'
    ) THEN
        ALTER TABLE deals ADD COLUMN expected_close_date DATE;
        RAISE NOTICE 'Added expected_close_date column to deals table';
    END IF;

    -- Add assigned_to column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE deals ADD COLUMN assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added assigned_to column to deals table';
    END IF;

    -- Add created_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE deals ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added created_by column to deals table';
    END IF;

    -- Add title column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'title'
    ) THEN
        ALTER TABLE deals ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Untitled Deal';
        RAISE NOTICE 'Added title column to deals table';
    END IF;

    -- Add description column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE deals ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to deals table';
    END IF;
END $$;

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
        RAISE NOTICE 'Added stage check constraint';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Stage check constraint already exists';
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_account_id ON deals(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);

-- Enable Row Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view account deals" ON deals;
CREATE POLICY "Users can view account deals" ON deals
    FOR SELECT TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account deals" ON deals;
CREATE POLICY "Users can manage account deals" ON deals
    FOR ALL TO authenticated
    USING (account_id = get_current_user_account_id())
    WITH CHECK (account_id = get_current_user_account_id());

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_deals_updated_at ON deals;
CREATE TRIGGER trigger_update_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_deals_updated_at();

-- ============================================================================
-- MIGRATION 1: Commission Tracking (Phase 12)
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
        -- Get the user who owns the deal (assigned_to or user_id or created_by)
        v_user_id := COALESCE(NEW.assigned_to, NEW.user_id, NEW.created_by);
        
        IF v_user_id IS NOT NULL THEN
            -- Get active commission rate for the user
            v_rate := get_active_commission_rate(v_user_id, CURRENT_DATE);
            
            -- Calculate commission amount
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
-- MIGRATION 2: Onboarding Fields (Phase 13)
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

COMMENT ON COLUMN accounts.onboarding_completed IS 'Whether the user has completed the onboarding process';
COMMENT ON COLUMN accounts.onboarding_step IS 'Current step in the onboarding process (0-5)';
COMMENT ON COLUMN accounts.onboarding_skipped IS 'Whether the user skipped the onboarding';
COMMENT ON COLUMN accounts.company_size IS 'Size of the company (1-10, 11-50, 51-200, 201-500, 501+)';
COMMENT ON COLUMN accounts.industry IS 'Industry/vertical of the company';

-- ============================================================================
-- MIGRATION 3: Company Info Update Functions (Phase 13)
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

COMMENT ON FUNCTION update_company_info IS 'Updates company information during onboarding, bypassing RLS';
COMMENT ON FUNCTION update_preferences IS 'Updates user preferences during onboarding, bypassing RLS';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All migrations have been applied successfully!
-- 
-- What was created/fixed:
-- 0. Fixed deals table - added all missing columns (stage, value, etc.)
-- 1. Commission tracking tables and triggers
-- 2. Onboarding fields in accounts table
-- 3. SECURITY DEFINER functions for onboarding
--
-- Next steps:
-- 1. Test deals page at /deals
-- 2. Test commissions page at /commissions
-- 3. Test onboarding wizard at /onboarding
-- 4. Create a test deal and mark it as won to verify commission auto-creation
-- ============================================================================