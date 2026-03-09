-- =============================================================================
-- Migration: Create CRM Stripe Billing Tables
-- Date: 2024-03-10
-- Description: Creates crm_subscriptions and crm_billing_events tables,
--              and adds CRM-prefixed billing columns to accounts and users tables.
--              All new tables/columns use crm_ prefix to distinguish from any
--              other app tables sharing this Supabase project.
-- =============================================================================

-- =============================================================================
-- 1. crm_subscriptions
-- Tracks all Stripe subscription records for the RankedCEO CRM product suite.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.crm_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User & Account (CRM)
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  -- Stripe References
  stripe_customer_id     TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id        TEXT NOT NULL,
  stripe_product_id      TEXT NOT NULL,

  -- Plan Details
  plan_name         TEXT NOT NULL,
  plan_tier         TEXT NOT NULL DEFAULT 'pro',     -- 'starter', 'pro', 'enterprise'
  industry          TEXT NOT NULL,                    -- 'hvac', 'plumbing', 'electrical', 'smile'
  billing_interval  TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly', 'yearly'
  amount_cents      INTEGER NOT NULL DEFAULT 0,       -- price in cents (e.g. 4900 = $49.00)
  currency          TEXT NOT NULL DEFAULT 'usd',

  -- Status
  status               TEXT NOT NULL DEFAULT 'active',
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end   TIMESTAMPTZ NOT NULL,
  trial_start          TIMESTAMPTZ,
  trial_end            TIMESTAMPTZ,
  canceled_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT crm_subscriptions_status_check
    CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'unpaid')),
  CONSTRAINT crm_subscriptions_billing_check
    CHECK (billing_interval IN ('monthly', 'yearly')),
  CONSTRAINT crm_subscriptions_industry_check
    CHECK (industry IN ('hvac', 'plumbing', 'electrical', 'smile')),
  CONSTRAINT crm_subscriptions_plan_tier_check
    CHECK (plan_tier IN ('starter', 'pro', 'enterprise'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_user_id
  ON public.crm_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_account_id
  ON public.crm_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_stripe_customer_id
  ON public.crm_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_stripe_subscription_id
  ON public.crm_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_status
  ON public.crm_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_industry
  ON public.crm_subscriptions(industry);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_crm_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_subscriptions_updated_at ON public.crm_subscriptions;
CREATE TRIGGER trg_crm_subscriptions_updated_at
  BEFORE UPDATE ON public.crm_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_crm_subscriptions_updated_at();

-- =============================================================================
-- 2. crm_billing_events
-- Audit log of all Stripe webhook events processed for the CRM product suite.
-- Enables idempotency checks and debugging of billing issues.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.crm_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe Event Reference
  stripe_event_id   TEXT NOT NULL UNIQUE,  -- Stripe event ID (evt_...)
  stripe_event_type TEXT NOT NULL,          -- e.g. 'customer.subscription.updated'

  -- Related Records
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,

  -- Processing
  processed      BOOLEAN NOT NULL DEFAULT false,
  processed_at   TIMESTAMPTZ,
  error_message  TEXT,

  -- Raw Payload (for debugging/replay)
  payload JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_billing_events_stripe_event_id
  ON public.crm_billing_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_crm_billing_events_stripe_subscription_id
  ON public.crm_billing_events(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_crm_billing_events_processed
  ON public.crm_billing_events(processed);
CREATE INDEX IF NOT EXISTS idx_crm_billing_events_created_at
  ON public.crm_billing_events(created_at DESC);

-- =============================================================================
-- 3. Update accounts table — add CRM-prefixed billing columns
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'crm_stripe_customer_id'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN crm_stripe_customer_id TEXT;
    COMMENT ON COLUMN public.accounts.crm_stripe_customer_id
      IS 'Stripe customer ID for RankedCEO CRM billing. Prefixed crm_ to distinguish from other apps.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'crm_plan_tier'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN crm_plan_tier TEXT DEFAULT 'free';
    COMMENT ON COLUMN public.accounts.crm_plan_tier
      IS 'Current CRM plan tier: free, starter, pro, enterprise.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'crm_billing_enabled'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN crm_billing_enabled BOOLEAN DEFAULT false;
    COMMENT ON COLUMN public.accounts.crm_billing_enabled
      IS 'Whether CRM billing/subscription is active for this account.';
  END IF;
END $$;

-- =============================================================================
-- 4. Update users table — add CRM-prefixed Stripe customer reference
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'crm_stripe_customer_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN crm_stripe_customer_id TEXT;
    COMMENT ON COLUMN public.users.crm_stripe_customer_id
      IS 'Stripe customer ID for this user in the RankedCEO CRM product. Prefixed crm_ to distinguish from other apps.';
  END IF;
END $$;

-- =============================================================================
-- 5. RLS Policies
-- =============================================================================

-- crm_subscriptions
ALTER TABLE public.crm_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM users can view own subscriptions"   ON public.crm_subscriptions;
DROP POLICY IF EXISTS "CRM users can manage own subscriptions" ON public.crm_subscriptions;
DROP POLICY IF EXISTS "Service role manages crm_subscriptions" ON public.crm_subscriptions;

CREATE POLICY "CRM users can view own subscriptions"
  ON public.crm_subscriptions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "CRM users can manage own subscriptions"
  ON public.crm_subscriptions FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role manages crm_subscriptions"
  ON public.crm_subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- crm_billing_events
ALTER TABLE public.crm_billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages crm_billing_events" ON public.crm_billing_events;

CREATE POLICY "Service role manages crm_billing_events"
  ON public.crm_billing_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- Done
-- =============================================================================
RAISE NOTICE 'CRM Stripe tables migration complete.';