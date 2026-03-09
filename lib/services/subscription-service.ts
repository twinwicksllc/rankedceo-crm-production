// ============================================================
// SubscriptionService — RankedCEO CRM
// ============================================================
// Handles all Stripe subscription operations:
//   - Creating/retrieving Stripe customers
//   - Creating checkout sessions
//   - Processing webhook events
//   - Syncing subscription state to Supabase (crm_subscriptions)
//   - Billing portal sessions
// ============================================================

import Stripe from 'stripe'
import { stripe, INDUSTRY_SUBDOMAIN_MAP } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export class SubscriptionService {
  private supabase = createAdminClient()

  // ----------------------------------------------------------
  // Customer Management
  // ----------------------------------------------------------

  /**
   * Get or create a Stripe customer for a given user.
   * Stores the customer ID in users.crm_stripe_customer_id.
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    // Check if user already has a Stripe customer ID
    const { data: user } = await this.supabase
      .from('users')
      .select('crm_stripe_customer_id')
      .eq('id', userId)
      .single()

    if (user?.crm_stripe_customer_id) {
      return user.crm_stripe_customer_id
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId,
        app: 'crm',
      },
    })

    // Persist customer ID to users table
    await this.supabase
      .from('users')
      .update({ crm_stripe_customer_id: customer.id })
      .eq('id', userId)

    // Also update accounts table
    const { data: userRecord } = await this.supabase
      .from('users')
      .select('account_id')
      .eq('id', userId)
      .single()

    if (userRecord?.account_id) {
      await this.supabase
        .from('accounts')
        .update({ crm_stripe_customer_id: customer.id })
        .eq('id', userRecord.account_id)
    }

    return customer.id
  }

  // ----------------------------------------------------------
  // Checkout Session
  // ----------------------------------------------------------

  /**
   * Create a Stripe Checkout Session for a subscription.
   * Returns the session URL to redirect the user to.
   */
  async createCheckoutSession({
    userId,
    email,
    priceId,
    industry,
    successUrl,
    cancelUrl,
  }: {
    userId: string
    email: string
    priceId: string
    industry: string
    successUrl: string
    cancelUrl: string
  }): Promise<Stripe.Checkout.Session> {
    const customerId = await this.getOrCreateCustomer(userId, email)

    // Check for existing active subscription for this industry
    const { data: existingSub } = await this.supabase
      .from('crm_subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .eq('industry', industry)
      .in('status', ['active', 'trialing'])
      .single()

    if (existingSub) {
      throw new Error(`User already has an active ${industry} subscription.`)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      metadata: {
        userId,
        industry,
        app: 'crm',
      },
      subscription_data: {
        metadata: {
          userId,
          industry,
          app: 'crm',
        },
      },
    })

    return session
  }

  // ----------------------------------------------------------
  // Billing Portal
  // ----------------------------------------------------------

  /**
   * Create a Stripe Billing Portal session for managing subscriptions.
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return session
  }

  // ----------------------------------------------------------
  // Subscription Queries
  // ----------------------------------------------------------

  /**
   * Get the active subscription for a user (optionally filtered by industry).
   */
  async getActiveSubscription(userId: string, industry?: string) {
    let query = this.supabase
      .from('crm_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })

    if (industry) {
      query = query.eq('industry', industry)
    }

    const { data, error } = await query.limit(1).single()
    return { data, error }
  }

  /**
   * Get all subscriptions for a user.
   */
  async getAllSubscriptions(userId: string) {
    const { data, error } = await this.supabase
      .from('crm_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return { data, error }
  }

  /**
   * Cancel a subscription at period end (default) or immediately.
   */
  async cancelSubscription(stripeSubscriptionId: string, atPeriodEnd = true) {
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: atPeriodEnd,
    })

    await this.supabase
      .from('crm_subscriptions')
      .update({ cancel_at_period_end: atPeriodEnd })
      .eq('stripe_subscription_id', stripeSubscriptionId)

    return subscription
  }

  // ----------------------------------------------------------
  // Webhook Event Processing
  // ----------------------------------------------------------

  /**
   * Main webhook dispatcher. Routes Stripe events to the appropriate handler.
   * Implements idempotency via crm_billing_events table.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    // Idempotency check — skip if already processed
    const { data: existing } = await this.supabase
      .from('crm_billing_events')
      .select('id, processed')
      .eq('stripe_event_id', event.id)
      .single()

    if (existing?.processed) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping.`)
      return
    }

    // Log the event (upsert)
    await this.supabase
      .from('crm_billing_events')
      .upsert({
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        stripe_customer_id: (event.data.object as any)?.customer || null,
        stripe_subscription_id: (event.data.object as any)?.subscription || (event.data.object as any)?.id || null,
        payload: event as any,
        processed: false,
      })

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
          break

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
          break

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
          break

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
          break

        case 'customer.deleted':
          await this.handleCustomerDeleted(event.data.object as Stripe.Customer)
          break

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
      }

      // Mark as processed
      await this.supabase
        .from('crm_billing_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('stripe_event_id', event.id)

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[Stripe Webhook] Error processing event ${event.id}:`, message)

      // Log the error
      await this.supabase
        .from('crm_billing_events')
        .update({ error_message: message })
        .eq('stripe_event_id', event.id)

      throw error
    }
  }

  // ----------------------------------------------------------
  // Private Webhook Handlers
  // ----------------------------------------------------------

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode !== 'subscription' || !session.subscription) return

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await this.syncSubscriptionToDb(subscription)
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    await this.syncSubscriptionToDb(subscription)
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.supabase
      .from('crm_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id)

    // Downgrade account plan tier
    const { data: sub } = await this.supabase
      .from('crm_subscriptions')
      .select('account_id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    if (sub?.account_id) {
      await this.supabase
        .from('accounts')
        .update({ crm_plan_tier: 'free', crm_billing_enabled: false })
        .eq('id', sub.account_id)
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id

    if (!subscriptionId) return

    await this.supabase
      .from('crm_subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id

    if (!subscriptionId) return

    await this.supabase
      .from('crm_subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)
  }

  private async handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
    // Clear customer ID from users and accounts
    await this.supabase
      .from('users')
      .update({ crm_stripe_customer_id: null })
      .eq('crm_stripe_customer_id', customer.id)

    await this.supabase
      .from('accounts')
      .update({ crm_stripe_customer_id: null, crm_billing_enabled: false })
      .eq('crm_stripe_customer_id', customer.id)
  }

  // ----------------------------------------------------------
  // Core Sync: Stripe Subscription → Supabase
  // ----------------------------------------------------------

  /**
   * Upserts a Stripe subscription into crm_subscriptions.
   * Also updates the account's crm_plan_tier and crm_billing_enabled.
   */
  private async syncSubscriptionToDb(subscription: Stripe.Subscription): Promise<void> {
    const { metadata } = subscription
    const userId = metadata?.userId

    if (!userId) {
      console.error('[Stripe] Subscription missing userId metadata:', subscription.id)
      return
    }

    // Get user's account_id
    const { data: user } = await this.supabase
      .from('users')
      .select('account_id')
      .eq('id', userId)
      .single()

    if (!user?.account_id) {
      console.error('[Stripe] User missing account_id:', userId)
      return
    }

    // Get price details
    const priceItem = subscription.items.data[0]
    const priceId = priceItem.price.id
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
    const priceMetadata = price.metadata as {
      industry?: string
      plan_tier?: string
      billing_interval?: string
      app?: string
    }

    const industry = metadata.industry || priceMetadata.industry || 'hvac'
    const planTier = priceMetadata.plan_tier || 'pro'
    const billingInterval = priceItem.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
    const amountCents = priceItem.price.unit_amount || 0
    const currency = priceItem.price.currency || 'usd'
    const productId = typeof price.product === 'string' ? price.product : price.product?.id || ''
    const productName = typeof price.product === 'object' && price.product !== null
      ? (price.product as Stripe.Product).name
      : productId

    // Upsert subscription record
    const { error } = await this.supabase
      .from('crm_subscriptions')
      .upsert(
        {
          user_id: userId,
          account_id: user.account_id,
          stripe_customer_id: typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          stripe_product_id: productId,
          plan_name: productName,
          plan_tier: planTier,
          industry,
          billing_interval: billingInterval,
          amount_cents: amountCents,
          currency,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          // In Stripe v20, current_period_start/end are not directly on subscription
          // Default to subscription start_date as fallback
          current_period_start: new Date(subscription.start_date * 1000).toISOString(),
          current_period_end: subscription.ended_at
            ? new Date(subscription.ended_at * 1000).toISOString()
            : null,
          trial_start: subscription.trial_start
            ? new Date(subscription.trial_start * 1000).toISOString()
            : null,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
        },
        { onConflict: 'stripe_subscription_id' }
      )

    if (error) {
      console.error('[Stripe] Error syncing subscription to DB:', error)
      throw error
    }

    // Update account plan tier
    const isActive = ['active', 'trialing'].includes(subscription.status)
    await this.supabase
      .from('accounts')
      .update({
        crm_plan_tier: isActive ? planTier : 'free',
        crm_billing_enabled: isActive,
      })
      .eq('id', user.account_id)
  }
}