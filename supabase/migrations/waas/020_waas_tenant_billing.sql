-- =============================================================================
-- WaaS Phase 7.4: Migration 020 - Tenant Billing
--
-- Adds Stripe billing columns to the tenants table so each WaaS tenant can
-- have their own Stripe customer / subscription tracked server-side.
--
-- Safe to re-run (all statements use IF NOT EXISTS / DO $$ blocks).
-- Run AFTER 019_waas_gallery_section.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add Stripe billing columns to tenants
-- ---------------------------------------------------------------------------

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT    NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT    NULL,
  ADD COLUMN IF NOT EXISTS plan_interval          TEXT    NULL   -- 'month' | 'year' | NULL
    CHECK (plan_interval IN ('month', 'year') OR plan_interval IS NULL);

-- ---------------------------------------------------------------------------
-- 2. Indexes for webhook lookup (update subscription by customer_id)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id
  ON tenants(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_subscription_id
  ON tenants(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Comments
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN tenants.stripe_customer_id IS
'Stripe customer ID for this WaaS tenant (e.g. cus_...). Used to create
billing portal sessions. Distinct from crm_stripe_customer_id on the users table.';

COMMENT ON COLUMN tenants.stripe_subscription_id IS
'Active Stripe subscription ID (e.g. sub_...). Updated by the
/api/waas/webhooks/stripe endpoint on subscription lifecycle events.';

COMMENT ON COLUMN tenants.plan_interval IS
'Billing interval of the active subscription: ''month'' or ''year''.
NULL when on the free/hosting tier with no paid subscription.';
