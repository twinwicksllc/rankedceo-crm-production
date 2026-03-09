// ============================================================
// Stripe Webhook Handler — RankedCEO CRM
// POST /api/stripe/webhook
// ============================================================
// Receives Stripe events, verifies signature, and dispatches
// to SubscriptionService for processing.
//
// IMPORTANT: This route must NOT parse the body as JSON.
// Stripe signature verification requires the raw request body.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { SubscriptionService } from '@/lib/services/subscription-service'

export const dynamic = 'force-dynamic'

// Disable body parsing — we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header')
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET env var')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Verify the webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[Stripe Webhook] Signature verification failed:', message)
      return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`)

    // Process the event
    const subscriptionService = new SubscriptionService()
    await subscriptionService.handleWebhookEvent(event)

    return NextResponse.json({ received: true })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Stripe Webhook] Unhandled error:', message)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}