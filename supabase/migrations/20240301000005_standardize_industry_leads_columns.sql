-- Migration: Standardize industry_leads columns to be industry-agnostic
-- This renames patient-specific columns to generic lead columns
-- Date: 2024-03-01

-- NOTE: guarded with existence checks. On a fresh/preview database, the
-- 20240222000000_create_industry_leads.sql migration's own CREATE TABLE IF
-- NOT EXISTS creates customer_name/customer_email/customer_phone columns
-- (not patient_name/patient_email/patient_phone) — this migration's rename
-- targets only ever existed on the live production table (created out-of-band
-- with the old dental-specific "patient_*" naming, later renamed here to
-- "lead_*"). Skip the rename entirely if the source column doesn't exist,
-- since the target ("lead_name" etc.) already exists on live production.

-- Rename patient_name → lead_name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='industry_leads' AND column_name='patient_name') THEN
    ALTER TABLE industry_leads RENAME COLUMN patient_name TO lead_name;
  END IF;
END $$;

-- Rename patient_email → lead_email
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='industry_leads' AND column_name='patient_email') THEN
    ALTER TABLE industry_leads RENAME COLUMN patient_email TO lead_email;
  END IF;
END $$;

-- Rename patient_phone → lead_phone
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='industry_leads' AND column_name='patient_phone') THEN
    ALTER TABLE industry_leads RENAME COLUMN patient_phone TO lead_phone;
  END IF;
END $$;

-- Update any RLS policies that reference the old column names
-- (This will be handled by the system automatically, but we'll verify)

-- Verify the changes
DO $$
DECLARE
    column_exists boolean;
BEGIN
    -- Check if lead_name exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'industry_leads' 
        AND column_name = 'lead_name'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✓ Column lead_name exists';
    ELSE
        RAISE NOTICE '✗ Column lead_name does NOT exist';
    END IF;
    
    -- Check if lead_email exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'industry_leads' 
        AND column_name = 'lead_email'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✓ Column lead_email exists';
    ELSE
        RAISE NOTICE '✗ Column lead_email does NOT exist';
    END IF;
    
    -- Check if lead_phone exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'industry_leads' 
        AND column_name = 'lead_phone'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✓ Column lead_phone exists';
    ELSE
        RAISE NOTICE '✗ Column lead_phone does NOT exist';
    END IF;
    
    -- Check if old columns are gone
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'industry_leads' 
        AND column_name = 'patient_name'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        RAISE NOTICE '✓ Old column patient_name removed';
    ELSE
        RAISE NOTICE '✗ Old column patient_name still exists';
    END IF;
END $$;