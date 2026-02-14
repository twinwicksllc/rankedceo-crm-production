-- ============================================================================
-- COMPLETE DEALS TABLE FIX
-- ============================================================================
-- This migration ensures the deals table has all required columns
-- Run this BEFORE the commission migration
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
-- VERIFICATION
-- ============================================================================
-- Show all columns in deals table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;