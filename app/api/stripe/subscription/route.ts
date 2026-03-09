// ============================================================
// Subscription Status — RankedCEO CRM
// GET /api/stripe/subscription
// GET /api/stripe/subscription?industry=hvac
// ============================================================
// Returns the current subscription status for the authenticated user.
// Optionally filtered by industry.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionService } from '@/lib/services/subscription-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const industry = searchParams.get('industry') || undefined

    const subscriptionService = new SubscriptionService()

    if (industry) {
      // Return single subscription for specific industry
      const { data, error } = await subscriptionService.getActiveSubscription(user.id, industry)
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }
      return NextResponse.json({ subscription: data || null })
    } else {
      // Return all subscriptions
      const { data, error } = await subscriptionService.getAllSubscriptions(user.id)
      if (error) throw error
      return NextResponse.json({ subscriptions: data || [] })
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Subscription Status] Error:', message)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/stripe/subscription
// Cancel a subscription (at period end by default)
// Body: { stripeSubscriptionId: string, immediately?: boolean }
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { stripeSubscriptionId, immediately = false } = body

    if (!stripeSubscriptionId) {
      return NextResponse.json({ error: 'Missing stripeSubscriptionId' }, { status: 400 })
    }

    // Verify the subscription belongs to this user
    const { data: sub } = await supabase
      .from('crm_subscriptions')
      .select('id, user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single()

    if (!sub || sub.user_id !== user.id) {
      return NextResponse.json({ error: 'Subscription not found or unauthorized' }, { status: 403 })
    }

    const subscriptionService = new SubscriptionService()
    await subscriptionService.cancelSubscription(stripeSubscriptionId, !immediately)

    return NextResponse.json({
      success: true,
      message: immediately
        ? 'Subscription canceled immediately.'
        : 'Subscription will be canceled at the end of the billing period.',
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Cancel Subscription] Error:', message)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}