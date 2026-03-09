// ============================================================
// Create Stripe Checkout Session — RankedCEO CRM
// POST /api/stripe/create-checkout
// ============================================================
// Creates a Stripe Checkout Session for a subscription.
// Requires authenticated user.
//
// Request body:
//   { priceId: string, industry: string }
//
// Response:
//   { url: string }  — Stripe hosted checkout URL
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

    // Parse request body
    const body = await request.json()
    const { priceId, industry } = body

    if (!priceId) {
      return NextResponse.json({ error: 'Missing required field: priceId' }, { status: 400 })
    }

    if (!industry) {
      return NextResponse.json({ error: 'Missing required field: industry' }, { status: 400 })
    }

    const validIndustries = ['hvac', 'plumbing', 'electrical', 'smile']
    if (!validIndustries.includes(industry)) {
      return NextResponse.json(
        { error: `Invalid industry. Must be one of: ${validIndustries.join(', ')}` },
        { status: 400 }
      )
    }

    // Build success/cancel URLs
    const origin = process.env.NEXT_PUBLIC_CRM_URL || 'https://crm.rankedceo.com'
    const successUrl = `${origin}/pay/success?industry=${industry}`
    const cancelUrl  = `${origin}/pay/cancel?industry=${industry}`

    // Create checkout session
    const subscriptionService = new SubscriptionService()
    const session = await subscriptionService.createCheckoutSession({
      userId: user.id,
      email: user.email!,
      priceId,
      industry,
      successUrl,
      cancelUrl,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session URL' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Create Checkout] Error:', message)

    // Return user-friendly error for known cases
    if (message.includes('already has an active')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}