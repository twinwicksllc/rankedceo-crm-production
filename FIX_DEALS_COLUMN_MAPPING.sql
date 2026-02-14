-- ============================================================================
-- FIX: Map Existing Deals Columns to Expected Names
-- ============================================================================
-- Your deals table uses different column names than the application expects
-- This migration adds the missing columns that the app code requires
-- ============================================================================

-- Existing columns in your deals table:
-- - owner_user_id (but app expects: user_id)
-- - amount (but app expects: value)
-- - stage_id (but app expects: stage as text)
-- - probability (but app expects: win_probability)
-- - close_date (but app expects: expected_close_date)

-- ============================================================================
-- Option 1: Add missing columns (keeps existing data intact)
-- ============================================================================

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
-- Sync data from existing columns to new columns
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

-- Map stage_id to stage text (you'll need to adjust this based on your pipeline stages)
-- For now, set a default stage based on won/lost status
UPDATE deals 
SET stage = CASE 
    WHEN won = true THEN 'Won'
    WHEN won = false THEN 'Lost'
    ELSE 'Lead'
END
WHERE stage IS NULL OR stage = 'Lead';

-- ============================================================================
-- Add check constraint for valid stage values
-- ============================================================================

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

-- ============================================================================
-- Create indexes on new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_value ON deals(value);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Show all columns now
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;

-- Show sample data
SELECT 
    id,
    title,
    owner_user_id,
    user_id,
    amount,
    value,
    stage_id,
    stage,
    probability,
    win_probability,
    close_date,
    expected_close_date
FROM deals 
LIMIT 3;