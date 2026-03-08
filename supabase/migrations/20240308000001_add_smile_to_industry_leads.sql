-- =============================================================================
-- Add 'smile' industry to industry_leads table
-- Safe to run multiple times (idempotent)
-- =============================================================================

-- 1. Drop the existing industry check constraint and recreate with 'smile' added
ALTER TABLE public.industry_leads
  DROP CONSTRAINT IF EXISTS industry_leads_industry_check;

ALTER TABLE public.industry_leads
  ADD CONSTRAINT industry_leads_industry_check
    CHECK (industry IN ('hvac', 'plumbing', 'electrical', 'smile'));

-- 2. Seed smile pool account
INSERT INTO public.accounts (id, name, slug, status, plan)
VALUES
  ('00000000-0000-0000-0004-000000000004', 'Smile Pool', 'smile-pool', 'active', 'pool')
ON CONFLICT (id) DO NOTHING;

-- 3. Verification
DO $$
BEGIN
  RAISE NOTICE '✓ smile added to industry_leads_industry_check constraint';
  RAISE NOTICE '✓ Smile Pool account seeded (id: 00000000-0000-0000-0004-000000000004)';
END $$;