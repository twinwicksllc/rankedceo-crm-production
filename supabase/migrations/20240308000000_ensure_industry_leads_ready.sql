-- =============================================================================
-- Ensure industry_leads table and pool accounts are production-ready
-- Safe to run multiple times (idempotent)
-- =============================================================================

-- 1. Ensure accounts table has slug, status, plan columns (if not already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN slug VARCHAR(255);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN status VARCHAR(50) DEFAULT 'active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'plan'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN plan VARCHAR(50) DEFAULT 'starter';
  END IF;
END $$;

-- 2. Seed pool accounts (safe — ON CONFLICT DO NOTHING)
INSERT INTO public.accounts (id, name, slug, status, plan)
VALUES
  ('00000000-0000-0000-0001-000000000001', 'HVAC Pool',       'hvac-pool',       'active', 'pool'),
  ('00000000-0000-0000-0002-000000000002', 'Plumbing Pool',   'plumbing-pool',   'active', 'pool'),
  ('00000000-0000-0000-0003-000000000003', 'Electrical Pool', 'electrical-pool', 'active', 'pool')
ON CONFLICT (id) DO NOTHING;

-- 3. Ensure industry_leads table exists with correct columns
CREATE TABLE IF NOT EXISTS public.industry_leads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  auth_user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  industry                 TEXT NOT NULL,
  customer_name            TEXT NOT NULL,
  customer_email           TEXT NOT NULL,
  customer_phone           TEXT NOT NULL,
  service_address          TEXT,
  city                     TEXT,
  state                    TEXT,
  zip_code                 TEXT,
  urgency                  TEXT NOT NULL DEFAULT 'scheduled',
  preferred_contact_method TEXT NOT NULL DEFAULT 'phone',
  preferred_time           TEXT,
  notes                    TEXT,
  service_details          JSONB NOT NULL DEFAULT '{}',
  status                   TEXT NOT NULL DEFAULT 'new',
  estimated_value          NUMERIC(10,2),
  assigned_to              TEXT,
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT industry_leads_industry_check
    CHECK (industry IN ('hvac', 'plumbing', 'electrical')),
  CONSTRAINT industry_leads_status_check
    CHECK (status IN ('new', 'contacted', 'scheduled', 'completed', 'lost')),
  CONSTRAINT industry_leads_urgency_check
    CHECK (urgency IN ('emergency', 'urgent', 'scheduled', 'estimate_only')),
  CONSTRAINT industry_leads_contact_method_check
    CHECK (preferred_contact_method IN ('phone', 'email', 'text')),
  CONSTRAINT industry_leads_email_check
    CHECK (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 4. Add any missing columns to existing table (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_leads' AND column_name = 'customer_name') THEN
    ALTER TABLE public.industry_leads ADD COLUMN customer_name TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_leads' AND column_name = 'customer_email') THEN
    ALTER TABLE public.industry_leads ADD COLUMN customer_email TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_leads' AND column_name = 'customer_phone') THEN
    ALTER TABLE public.industry_leads ADD COLUMN customer_phone TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_leads' AND column_name = 'zip_code') THEN
    ALTER TABLE public.industry_leads ADD COLUMN zip_code TEXT;
  END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_industry_leads_account_id ON public.industry_leads(account_id);
CREATE INDEX IF NOT EXISTS idx_industry_leads_industry   ON public.industry_leads(industry);
CREATE INDEX IF NOT EXISTS idx_industry_leads_status     ON public.industry_leads(status);
CREATE INDEX IF NOT EXISTS idx_industry_leads_submitted  ON public.industry_leads(submitted_at DESC);

-- 6. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_industry_leads_updated_at ON public.industry_leads;
CREATE TRIGGER set_industry_leads_updated_at
  BEFORE UPDATE ON public.industry_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. RLS
ALTER TABLE public.industry_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators can view account leads"   ON public.industry_leads;
DROP POLICY IF EXISTS "Operators can manage account leads" ON public.industry_leads;
DROP POLICY IF EXISTS "Public can submit leads"            ON public.industry_leads;

-- Authenticated operators: view leads for their account
CREATE POLICY "Operators can view account leads"
  ON public.industry_leads FOR SELECT TO authenticated
  USING (account_id = get_current_user_account_id());

-- Authenticated operators: full management of their account leads
CREATE POLICY "Operators can manage account leads"
  ON public.industry_leads FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id())
  WITH CHECK (account_id = get_current_user_account_id());

-- Anonymous public: INSERT only (landing page form submissions)
CREATE POLICY "Public can submit leads"
  ON public.industry_leads FOR INSERT TO anon
  WITH CHECK (true);

-- 8. Verification
DO $$
BEGIN
  RAISE NOTICE '✓ industry_leads table ready';
  RAISE NOTICE '✓ Pool accounts seeded (hvac, plumbing, electrical)';
  RAISE NOTICE '✓ RLS policies applied';
  RAISE NOTICE '✓ Run: SELECT column_name FROM information_schema.columns WHERE table_name = ''industry_leads'' ORDER BY ordinal_position;';
END $$;