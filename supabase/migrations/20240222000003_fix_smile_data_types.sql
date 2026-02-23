-- ============================================================================
-- Fix Smile Assessments Data Types and Verify Columns
-- ============================================================================
-- This migration:
-- 1. Verifies patient identity columns exist (patient_name, patient_email, patient_phone)
-- 2. Converts smile_goals and medical_conditions from text to text[] (arrays)
-- 3. Handles data migration safely
-- ============================================================================

-- 1. Verify patient identity columns exist
DO $$
DECLARE
    missing_cols TEXT[];
BEGIN
    -- Check patient_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'smile_assessments' AND column_name = 'patient_name'
    ) THEN
        missing_cols := array_append(missing_cols, 'patient_name');
    END IF;
    
    -- Check patient_email
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'smile_assessments' AND column_name = 'patient_email'
    ) THEN
        missing_cols := array_append(missing_cols, 'patient_email');
    END IF;
    
    -- Check patient_phone
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'smile_assessments' AND column_name = 'patient_phone'
    ) THEN
        missing_cols := array_append(missing_cols, 'patient_phone');
    END IF;
    
    -- Check patient_dob
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'smile_assessments' AND column_name = 'patient_dob'
    ) THEN
        missing_cols := array_append(missing_cols, 'patient_dob');
    END IF;
    
    IF array_length(missing_cols, 1) > 0 THEN
        RAISE EXCEPTION 'Missing patient identity columns: %', array_to_string(missing_cols, ', ');
    END IF;
    
    RAISE NOTICE '✓ All patient identity columns verified';
END $$;

-- 2. Convert smile_goals from text to text[] if needed
DO $$
BEGIN
    -- Check if smile_goals is currently text type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'smile_assessments' 
        AND column_name = 'smile_goals'
        AND data_type = 'text'
    ) THEN
        RAISE NOTICE 'Converting smile_goals from text to text[]...';
        
        -- Create backup of existing data
        ALTER TABLE smile_assessments ADD COLUMN smile_goals_backup TEXT;
        UPDATE smile_assessments SET smile_goals_backup = smile_goals;
        
        -- Drop old column
        ALTER TABLE smile_assessments DROP COLUMN smile_goals;
        
        -- Add new array column
        ALTER TABLE smile_assessments ADD COLUMN smile_goals TEXT[] DEFAULT '{}';
        
        -- Restore data (convert comma-separated strings to arrays)
        UPDATE smile_assessments 
        SET smile_goals = CASE 
            WHEN smile_goals_backup IS NULL THEN '{}'::TEXT[]
            WHEN smile_goals_backup = '' THEN '{}'::TEXT[]
            ELSE string_to_array(smile_goals_backup, ',')
        END
        WHERE smile_goals_backup IS NOT NULL;
        
        -- Drop backup column
        ALTER TABLE smile_assessments DROP COLUMN smile_goals_backup;
        
        RAISE NOTICE '✓ smile_goals converted to text[] array';
    ELSE
        RAISE NOTICE '✓ smile_goals is already text[] or does not exist';
    END IF;
END $$;

-- 3. Convert medical_conditions from text to text[] if needed
DO $$
BEGIN
    -- Check if medical_conditions is currently text type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'smile_assessments' 
        AND column_name = 'medical_conditions'
        AND data_type = 'text'
    ) THEN
        RAISE NOTICE 'Converting medical_conditions from text to text[]...';
        
        -- Create backup of existing data
        ALTER TABLE smile_assessments ADD COLUMN medical_conditions_backup TEXT;
        UPDATE smile_assessments SET medical_conditions_backup = medical_conditions;
        
        -- Drop old column
        ALTER TABLE smile_assessments DROP COLUMN medical_conditions;
        
        -- Add new array column
        ALTER TABLE smile_assessments ADD COLUMN medical_conditions TEXT[] DEFAULT '{}';
        
        -- Restore data (convert comma-separated strings to arrays)
        UPDATE smile_assessments 
        SET medical_conditions = CASE 
            WHEN medical_conditions_backup IS NULL THEN '{}'::TEXT[]
            WHEN medical_conditions_backup = '' THEN '{}'::TEXT[]
            ELSE string_to_array(medical_conditions_backup, ',')
        END
        WHERE medical_conditions_backup IS NOT NULL;
        
        -- Drop backup column
        ALTER TABLE smile_assessments DROP COLUMN medical_conditions_backup;
        
        RAISE NOTICE '✓ medical_conditions converted to text[] array';
    ELSE
        RAISE NOTICE '✓ medical_conditions is already text[] or does not exist';
    END IF;
END $$;

-- 4. Display final schema
RAISE NOTICE '============================================================';
RAISE NOTICE 'Final smile_assessments table schema:';
RAISE NOTICE '============================================================';

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'smile_assessments'
ORDER BY ordinal_position;

RAISE NOTICE '============================================================';
RAISE NOTICE 'Migration complete!';
RAISE NOTICE '============================================================';