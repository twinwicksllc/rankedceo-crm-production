-- ============================================================================
-- Fix Smile Assessments Missing Columns
-- ============================================================================
-- This migration:
-- 1. Adds any missing columns to smile_assessments table
-- 2. Verifies all required columns exist
-- 3. Updates column constraints if needed
-- ============================================================================

-- Check and add dentist_name if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'dentist_name'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN dentist_name TEXT;
        RAISE NOTICE '✓ Added dentist_name column';
    ELSE
        RAISE NOTICE '✓ dentist_name column already exists';
    END IF;
END $$;

-- Check and add other potentially missing columns
DO $$
BEGIN
    -- last_dental_visit
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'last_dental_visit'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN last_dental_visit TEXT;
        RAISE NOTICE '✓ Added last_dental_visit column';
    END IF;
    
    -- dental_insurance
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'dental_insurance'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN dental_insurance BOOLEAN DEFAULT false;
        RAISE NOTICE '✓ Added dental_insurance column';
    END IF;
    
    -- insurance_provider
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'insurance_provider'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN insurance_provider TEXT;
        RAISE NOTICE '✓ Added insurance_provider column';
    END IF;
    
    -- current_concerns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'current_concerns'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN current_concerns TEXT;
        RAISE NOTICE '✓ Added current_concerns column';
    END IF;
    
    -- pain_sensitivity
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'pain_sensitivity'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN pain_sensitivity TEXT;
        RAISE NOTICE '✓ Added pain_sensitivity column';
    END IF;
    
    -- smile_goals (array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'smile_goals'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN smile_goals TEXT[] DEFAULT '{}';
        RAISE NOTICE '✓ Added smile_goals column';
    END IF;
    
    -- desired_outcome
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'desired_outcome'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN desired_outcome TEXT;
        RAISE NOTICE '✓ Added desired_outcome column';
    END IF;
    
    -- medical_conditions (array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'medical_conditions'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN medical_conditions TEXT[] DEFAULT '{}';
        RAISE NOTICE '✓ Added medical_conditions column';
    END IF;
    
    -- medications
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'medications'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN medications TEXT;
        RAISE NOTICE '✓ Added medications column';
    END IF;
    
    -- allergies
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'allergies'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN allergies TEXT;
        RAISE NOTICE '✓ Added allergies column';
    END IF;
    
    -- status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'smile_assessments'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.smile_assessments ADD COLUMN status TEXT DEFAULT 'pending';
        RAISE NOTICE '✓ Added status column';
    END IF;
END $$;

-- Verify all columns exist
RAISE NOTICE '═══════════════════════════════════════════════════════════════';
RAISE NOTICE 'Verifying all smile_assessments columns:';
RAISE NOTICE '═══════════════════════════════════════════════════════════════';

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'smile_assessments'
ORDER BY ordinal_position;

RAISE NOTICE '═══════════════════════════════════════════════════════════════';
RAISE NOTICE 'Column verification complete!';
RAISE NOTICE '═══════════════════════════════════════════════════════════════';