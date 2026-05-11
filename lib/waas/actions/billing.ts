'use server'

// =============================================================================
// lib/waas/actions/billing.ts
// Phase 7.4: WaaS Tenant Self-Serve Billing Portal
//
// All actions use the Stripe API (same key as CRM Stripe), but operate on
// WaaS-specific Stripe customers/subscriptions stored on the `tenants` table.
//
// Exports:
//   createBillingPortalSession   — returns a Stripe Billing Portal URL for tenant
//   createCheckoutSession        — creates a Stripe Checkout session to subscribe
//   getTenantBillingStatus       — reads plan tier + Stripe IDs for a tenant
//   adminUpdateTenantPlan        — admin override: set plan_interval + tier
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { revalidatePath }        from 'next/cache'
import Stripe from 'stripe'
import type { WaasPackageTier } from '@/lib/waas/types'
import { WAAS_PLAN_DISPLAY, type WaasPlanDisplay } from '@/lib/waas/billing-config'

// ---------------------------------------------------------------------------
// Stripe client (shared STRIPE_SECRET_KEY, same account as CRM billing)
// ---------------------------------------------------------------------------

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY env var is not set')
  return new Stripe(key, { apiVersion: '2026-02-25.clover', typescript: true })
}

// ---------------------------------------------------------------------------
// WaaS Stripe Price IDs  (set in Vercel env vars)
// ---------------------------------------------------------------------------

// NOTE: Not exported — "use server" files may only export async functions.
// This constant is used only internally within this module.
const WAAS_PLAN_PRICES: Record<WaasPackageTier, { monthly: string; yearly: string } | { yearly: string } | null> = {
  hosting_only: {
    // Annual only — no monthly price
    yearly: process.env.WAAS_STRIPE_PRICE_HOSTING_ONLY ?? '',
  },
  hosting:  null,  // free tier — no Stripe price
  standard: {
    monthly: process.env.WAAS_STRIPE_PRICE_STANDARD_MONTHLY ?? '',
    yearly:  process.env.WAAS_STRIPE_PRICE_STANDARD_YEARLY  ?? '',
  },
  premium: {
    monthly: process.env.WAAS_STRIPE_PRICE_PREMIUM_MONTHLY ?? '',
    yearly:  process.env.WAAS_STRIPE_PRICE_PREMIUM_YEARLY  ?? '',
  },
}

// ---------------------------------------------------------------------------
// Admin client (service-role, bypasses RLS)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase admin env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Shared result shape
// ---------------------------------------------------------------------------

export interface ActionResult<T = null> {
  success: boolean
  data?:   T
  error?:  string
}

// ---------------------------------------------------------------------------
// getTenantBillingStatus
// Returns the tenant's current plan tier, Stripe IDs, and plan interval.
// Used by the PlanCard component in the client portal.
// ---------------------------------------------------------------------------

export interface TenantBillingStatus {
  packageTier:           WaasPackageTier
  planInterval:          'month' | 'year' | null
  stripeCustomerId:      string | null
  stripeSubscriptionId:  string | null
  hasActiveSubscription: boolean
  planDisplay:           WaasPlanDisplay
}

export async function getTenantBillingStatus(
  tenantId: string,
): Promise<ActionResult<TenantBillingStatus>> {
  try {
    const supabase = getAdminClient()
    const { data: row, error } = await supabase
      .from('tenants')
      .select('package_tier, plan_interval, stripe_customer_id, stripe_subscription_id')
      .eq('id', tenantId)
      .single()

    if (error || !row) {
      return { success: false, error: 'Tenant not found' }
    }

    const t = row as {
      package_tier:           string
      plan_interval:          string | null
      stripe_customer_id:     string | null
      stripe_subscription_id: string | null
    }

    const tier = (t.package_tier ?? 'hosting') as WaasPackageTier

    return {
      success: true,
      data: {
        packageTier:           tier,
        planInterval:          (t.plan_interval as 'month' | 'year' | null) ?? null,
        stripeCustomerId:      t.stripe_customer_id      ?? null,
        stripeSubscriptionId:  t.stripe_subscription_id  ?? null,
        hasActiveSubscription: !!t.stripe_subscription_id && tier !== 'hosting',
        planDisplay:           WAAS_PLAN_DISPLAY[tier],
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch billing status',
    }
  }
}

// ---------------------------------------------------------------------------
// createBillingPortalSession
// Creates a Stripe Billing Portal session for the tenant so they can manage
// their payment method, view invoices, and cancel their subscription.
//
// If the tenant has no Stripe customer yet, this returns an error — they
// should subscribe via createCheckoutSession first.
// ---------------------------------------------------------------------------

export interface BillingPortalArgs {
  tenantId:    string
  returnUrl:   string  // URL to redirect back to after portal session ends
}

export async function createBillingPortalSession(
  args: BillingPortalArgs,
): Promise<ActionResult<{ url: string }>> {
  const { tenantId, returnUrl } = args

  try {
    const supabase  = getAdminClient()
    const { data: row, error } = await supabase
      .from('tenants')
      .select('stripe_customer_id, package_tier')
      .eq('id', tenantId)
      .single()

    if (error || !row) return { success: false, error: 'Tenant not found' }

    const t = row as { stripe_customer_id: string | null; package_tier: string }

    if (!t.stripe_customer_id) {
      return {
        success: false,
        error: 'No billing account found. Please subscribe to a plan first.',
      }
    }

    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer:   t.stripe_customer_id,
      return_url: returnUrl,
    })

    return { success: true, data: { url: session.url } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create billing portal session',
    }
  }
}

// ---------------------------------------------------------------------------
// createCheckoutSession
// Creates a Stripe Checkout session for a tenant to subscribe to a paid plan.
// On success, Stripe redirects to successUrl with ?session_id={CHECKOUT_SESSION_ID}
// The webhook handler will update the tenant's Stripe fields after payment.
// ---------------------------------------------------------------------------

export interface CheckoutArgs {
  tenantId:       string
  packageTier:    Exclude<WaasPackageTier, 'hosting'>  // 'hosting_only' | 'standard' | 'premium'
  interval:       'month' | 'year'
  successUrl:     string
  cancelUrl:      string
  customerEmail?: string
}

export async function createCheckoutSession(
  args: CheckoutArgs,
): Promise<ActionResult<{ url: string }>> {
  const { tenantId, packageTier, interval, successUrl, cancelUrl, customerEmail } = args

  // hosting_only is annual-only — reject monthly requests
  if (packageTier === 'hosting_only' && interval === 'month') {
    return { success: false, error: 'Hosting Only plan is available on annual billing only.' }
  }

  // Validate price exists
  const prices = WAAS_PLAN_PRICES[packageTier]
  if (!prices) {
    return { success: false, error: `No price configured for tier: ${packageTier}` }
  }
  const priceId = interval === 'month'
    ? ('monthly' in prices ? prices.monthly : null)
    : prices.yearly
  if (!priceId) {
    return { success: false, error: `No Stripe price ID set for ${packageTier}/${interval}` }
  }

  try {
    const supabase = getAdminClient()
    const { data: row, error } = await supabase
      .from('tenants')
      .select('stripe_customer_id, brand_config, slug')
      .eq('id', tenantId)
      .single()

    if (error || !row) return { success: false, error: 'Tenant not found' }

    const t = row as {
      stripe_customer_id: string | null
      brand_config:       Record<string, unknown>
      slug:               string
    }

    const stripe = getStripe()

    // Re-use existing Stripe customer if available
    let customerId = t.stripe_customer_id

    if (!customerId) {
      const businessName =
        typeof t.brand_config?.business_name === 'string'
          ? t.brand_config.business_name
          : t.slug

      const customer = await stripe.customers.create({
        email:    customerEmail,
        name:     businessName,
        metadata: {
          waas_tenant_id:   tenantId,
          waas_tenant_slug: t.slug,
        },
      })
      customerId = customer.id

      // Persist immediately so concurrent requests don't create duplicates
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenantId)
    }

    const session = await stripe.checkout.sessions.create({
      mode:               'subscription',
      customer:           customerId,
      line_items:         [{ price: priceId, quantity: 1 }],
      success_url:        `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:         cancelUrl,
      metadata: {
        waas_tenant_id: tenantId,
        package_tier:   packageTier,
        plan_interval:  interval,
      },
      subscription_data: {
        metadata: {
          waas_tenant_id: tenantId,
          package_tier:   packageTier,
          plan_interval:  interval,
        },
      },
    })

    if (!session.url) {
      return { success: false, error: 'Stripe did not return a checkout URL' }
    }

    return { success: true, data: { url: session.url } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create checkout session',
    }
  }
}

// ---------------------------------------------------------------------------
// adminUpdateTenantPlan
// Admin override: manually set package_tier + plan_interval (e.g. for
// comped accounts, manual invoices, or test mode tenants).
// Does NOT touch Stripe — purely a database update.
// ---------------------------------------------------------------------------

export interface AdminUpdatePlanArgs {
  tenantId:    string
  packageTier: WaasPackageTier
  interval:    'month' | 'year' | null
}

export async function adminUpdateTenantPlan(
  args: AdminUpdatePlanArgs,
): Promise<ActionResult> {
  const { tenantId, packageTier, interval } = args

  try {
    const supabase = getAdminClient()
    const { error } = await supabase
      .from('tenants')
      .update({
        package_tier:  packageTier,
        plan_interval: interval,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (error) throw error

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/admin/dashboard`)

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update tenant plan',
    }
  }
}
