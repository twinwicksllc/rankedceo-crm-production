// =============================================================================
// app/api/waas/webhooks/stripe/route.ts
// Phase 7.4: WaaS Stripe Webhook Handler
//
// POST /api/waas/webhooks/stripe
//
// Receives Stripe lifecycle events for WaaS subscriptions and updates the
// `tenants` table accordingly. This is a separate webhook endpoint from
// the CRM webhook (/api/stripe/webhook) — register it separately in the
// Stripe Dashboard with a dedicated signing secret (WAAS_STRIPE_WEBHOOK_SECRET).
//
// Events handled:
//   checkout.session.completed      — new subscription created via Checkout
//   customer.subscription.updated   — plan changed, interval changed, status change
//   customer.subscription.deleted   — subscription cancelled / expired
//   invoice.payment_failed          — subscription payment failed (log only for now)
//
// Security:
//   - Signature verified with WAAS_STRIPE_WEBHOOK_SECRET
//   - Tenant lookup by stripe_customer_id (set on checkout.session.completed)
//   - All mutations are idempotent (upsert-style, safe for event replays)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key, { apiVersion: '2026-02-25.clover', typescript: true })
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase admin env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Derive WaasPackageTier from Stripe price ID
// ---------------------------------------------------------------------------

function tierFromPriceId(priceId: string | null): string | null {
  if (!priceId) return null
  const standardMonthly = process.env.WAAS_STRIPE_PRICE_STANDARD_MONTHLY
  const standardYearly  = process.env.WAAS_STRIPE_PRICE_STANDARD_YEARLY
  const premiumMonthly  = process.env.WAAS_STRIPE_PRICE_PREMIUM_MONTHLY
  const premiumYearly   = process.env.WAAS_STRIPE_PRICE_PREMIUM_YEARLY
  if (priceId === standardMonthly || priceId === standardYearly) return 'standard'
  if (priceId === premiumMonthly  || priceId === premiumYearly)  return 'premium'
  return null  // unknown price — don't overwrite tier
}

// ---------------------------------------------------------------------------
// Update tenant billing fields by customer_id
// ---------------------------------------------------------------------------

async function updateTenantByCustomerId(
  customerId:  string,
  fields: Partial<{
    stripe_subscription_id: string | null
    package_tier:           string
    plan_interval:          string | null
    stripe_customer_id:     string
  }>,
): Promise<{ updated: boolean; tenantId: string | null }> {
  const supabase = getAdminClient()

  const { data: row } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!row) {
    console.warn(`[WaaS Webhook] No tenant found for customer ${customerId}`)
    return { updated: false, tenantId: null }
  }

  const tenant = row as { id: string }

  const { error } = await supabase
    .from('tenants')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', tenant.id)

  if (error) {
    console.error(`[WaaS Webhook] DB update error for tenant ${tenant.id}:`, error.message)
    return { updated: false, tenantId: tenant.id }
  }

  return { updated: true, tenantId: tenant.id }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.WAAS_STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[WaaS Webhook] WAAS_STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WaaS Webhook] Signature verification failed:', message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  console.log(`[WaaS Webhook] Event: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // New subscription created via Checkout
      // -----------------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId     = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        const tenantId       = session.metadata?.waas_tenant_id
        const tier           = session.metadata?.package_tier
        const interval       = (session.metadata?.plan_interval ?? null) as 'month' | 'year' | null

        if (!customerId || !subscriptionId || !tenantId) {
          console.warn('[WaaS Webhook] checkout.session.completed missing required fields', { customerId, subscriptionId, tenantId })
          break
        }

        const supabase = getAdminClient()
        const { error } = await supabase
          .from('tenants')
          .update({
            stripe_customer_id:    customerId,
            stripe_subscription_id: subscriptionId,
            package_tier:          tier ?? undefined,
            plan_interval:         interval,
            updated_at:            new Date().toISOString(),
          })
          .eq('id', tenantId)

        if (error) {
          console.error('[WaaS Webhook] checkout.session.completed DB error:', error.message)
        } else {
          console.log(`[WaaS Webhook] Tenant ${tenantId} subscribed → ${tier} (${interval})`)
        }
        break
      }

      // -----------------------------------------------------------------------
      // Subscription updated (plan change, interval change, reactivated)
      // -----------------------------------------------------------------------
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

        // Derive tier from the first line item price
        const priceId = sub.items.data[0]?.price?.id ?? null
        const tier    = tierFromPriceId(priceId)

        const interval = sub.items.data[0]?.price?.recurring?.interval === 'year'
          ? 'year'
          : sub.items.data[0]?.price?.recurring?.interval === 'month'
            ? 'month'
            : null

        const updateFields: Record<string, string | null> = {
          stripe_subscription_id: sub.id,
          plan_interval:          interval,
        }
        if (tier) updateFields.package_tier = tier

        // If subscription is cancelled/unpaid → downgrade to hosting
        if (sub.status === 'canceled' || sub.status === 'unpaid') {
          updateFields.package_tier          = 'hosting'
          updateFields.stripe_subscription_id = null
          updateFields.plan_interval          = null
        }

        const { updated, tenantId } = await updateTenantByCustomerId(customerId, updateFields)
        console.log(`[WaaS Webhook] subscription.updated → tenant ${tenantId} updated=${updated} status=${sub.status} tier=${tier ?? 'unchanged'}`)
        break
      }

      // -----------------------------------------------------------------------
      // Subscription deleted / cancelled
      // -----------------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

        const { updated, tenantId } = await updateTenantByCustomerId(customerId, {
          stripe_subscription_id: null,
          package_tier:           'hosting',
          plan_interval:          null,
        })
        console.log(`[WaaS Webhook] subscription.deleted → tenant ${tenantId} downgraded to hosting, updated=${updated}`)
        break
      }

      // -----------------------------------------------------------------------
      // Payment failed — log, but don't downgrade yet (Stripe handles retries)
      // -----------------------------------------------------------------------
      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        console.warn(`[WaaS Webhook] Payment failed for customer ${customerId ?? 'unknown'} — invoice ${invoice.id}`)
        // TODO (Phase 8): send email notification to tenant
        break
      }

      default:
        console.log(`[WaaS Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WaaS Webhook] Handler error:', message)
    // Return 200 to prevent Stripe retrying — log to Sentry in production
    return NextResponse.json({ received: true, warning: message })
  }
}
