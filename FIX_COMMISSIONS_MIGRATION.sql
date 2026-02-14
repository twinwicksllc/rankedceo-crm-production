-- ============================================================================
-- FIXED COMMISSION TRACKING MIGRATION
-- ============================================================================
-- This version checks if the stage column exists before creating triggers
-- If stage column doesn't exist, it will be added first
-- ============================================================================

-- Step 1: Add stage column to deals table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deals' 
        AND column_name = 'stage'
    ) THEN
        ALTER TABLE deals ADD COLUMN stage VARCHAR(50) DEFAULT 'Lead';
        
        -- Add check constraint for valid stage values
        ALTER TABLE deals ADD CONSTRAINT deals_stage_check 
        CHECK (stage IN ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 'lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'));
        
        RAISE NOTICE 'Added stage column to deals table';
    ELSE
        RAISE NOTICE 'Stage column already exists in deals table';
    END IF;
END $$;

-- Step 2: Create commission_rates table
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

-- Step 3: Create commissions table
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

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_rates_account_id ON commission_rates(account_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_user_id ON commission_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_active ON commission_rates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_commissions_account_id ON commissions(account_id);
CREATE INDEX IF NOT EXISTS idx_commissions_deal_id ON commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at);

-- Step 5: Enable Row Level Security
ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for commission_rates
DROP POLICY IF EXISTS "Users can view account commission rates" ON commission_rates;
CREATE POLICY "Users can view account commission rates" ON commission_rates
    FOR SELECT TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account commission rates" ON commission_rates;
CREATE POLICY "Users can manage account commission rates" ON commission_rates
    FOR ALL TO authenticated
    USING (account_id = get_current_user_account_id())
    WITH CHECK (account_id = get_current_user_account_id());

-- Step 7: Create RLS policies for commissions
DROP POLICY IF EXISTS "Users can view account commissions" ON commissions;
CREATE POLICY "Users can view account commissions" ON commissions
    FOR SELECT TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account commissions" ON commissions;
CREATE POLICY "Users can manage account commissions" ON commissions
    FOR ALL TO authenticated
    USING (account_id = get_current_user_account_id())
    WITH CHECK (account_id = get_current_user_account_id());

-- Step 8: Function to get active commission rate for a user
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

-- Step 9: Function to calculate commission amount
CREATE OR REPLACE FUNCTION calculate_commission_amount(p_deal_value DECIMAL(12,2), p_rate DECIMAL(5,2))
RETURNS DECIMAL(12,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN ROUND(p_deal_value * (p_rate / 100), 2);
END;
$$;

-- Step 10: Trigger function to auto-calculate commission when deal is won
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
        -- Get the user who owns the deal (assigned_to or created_by or user_id)
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

-- Step 11: Create trigger on deals table
DROP TRIGGER IF EXISTS trigger_auto_create_commission ON deals;
CREATE TRIGGER trigger_auto_create_commission
    AFTER INSERT OR UPDATE OF stage ON deals
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_commission();

-- Step 12: Function to update commission when deal value changes
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

-- Step 13: Create trigger for deal value changes
DROP TRIGGER IF EXISTS trigger_update_commission_on_deal_change ON deals;
CREATE TRIGGER trigger_update_commission_on_deal_change
    AFTER UPDATE OF value ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_commission_on_deal_change();

-- Step 14: Add updated_at trigger for commission_rates
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

-- Step 15: Add updated_at trigger for commissions
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
-- MIGRATION COMPLETE
-- ============================================================================
-- What was created/fixed:
-- 1. Added stage column to deals table (if missing)
-- 2. Created commission_rates and commissions tables
-- 3. Created triggers for automatic commission calculation
-- 4. Made stage comparison case-insensitive (handles 'won', 'Won', 'WON')
-- 5. Added fallback for user_id (checks assigned_to, user_id, created_by)
--
-- Next steps:
-- 1. Test by creating a deal and marking it as 'Won'
-- 2. Check commissions table for auto-created commission record
-- 3. Visit /commissions page to view commission tracking
-- ============================================================================