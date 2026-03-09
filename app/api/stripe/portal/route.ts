// ============================================================
// Stripe Billing Portal — RankedCEO CRM
// POST /api/stripe/portal
// ============================================================
// Creates a Stripe Billing Portal session so users can manage
// their subscription, update payment method, view invoices, etc.
// Requires authenticated user with an active subscription.
//
// Response:
//   { url: string }  — Stripe billing portal URL
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionService } from '@/lib/services/subscription-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Stripe customer ID
    const { data: userRecord } = await supabase
      .from('users')
      .select('crm_stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!userRecord?.crm_stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe to a plan first.' },
        { status: 400 }
      )
    }

    // Build return URL
    const origin = process.env.NEXT_PUBLIC_CRM_URL || 'https://crm.rankedceo.com'
    const returnUrl = `${origin}/dashboard/billing`

    // Create billing portal session
    const subscriptionService = new SubscriptionService()
    const session = await subscriptionService.createPortalSession(
      userRecord.crm_stripe_customer_id,
      returnUrl
    )

    return NextResponse.json({ url: session.url })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Billing Portal] Error:', message)
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 })
  }
}