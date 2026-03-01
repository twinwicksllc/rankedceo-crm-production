import { NextRequest, NextResponse } from 'next/server'
import { verifyCalendlyWebhook } from '@/lib/services/calendly-service'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('calendly-webhook-signature') || ''
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY || ''

    // Verify webhook signature
    if (signingKey && !verifyCalendlyWebhook(rawBody, signature, signingKey)) {
      console.error('[Calendly Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const eventType = payload.event
    const eventData = payload.payload

    console.log('[Calendly Webhook] Event received:', eventType)

    const supabase = await createClient()

    switch (eventType) {
      case 'invitee.created': {
        // New appointment booked via Calendly
        const eventUri = eventData.event
        const inviteeUri = eventData.uri
        const inviteeName = eventData.name
        const inviteeEmail = eventData.email
        const startTime = eventData.scheduled_event?.start_time
        const endTime = eventData.scheduled_event?.end_time
        const cancelUrl = eventData.cancel_url
        const rescheduleUrl = eventData.reschedule_url
        const meetingUrl = eventData.scheduled_event?.location?.join_url || null
        const location = eventData.scheduled_event?.location?.location || null

        // Find the account that owns this Calendly event
        const organizerUri = eventData.scheduled_event?.event_memberships?.[0]?.user
        const { data: connection } = await supabase
          .from('calendly_connections')
          .select('account_id, user_id')
          .eq('calendly_user_uri', organizerUri)
          .eq('is_active', true)
          .single()

        if (!connection) {
          console.warn('[Calendly Webhook] No matching connection for organizer:', organizerUri)
          break
        }

        // Check if appointment already exists
        const { data: existing } = await supabase
          .from('appointments')
          .select('id')
          .eq('calendly_invitee_uri', inviteeUri)
          .single()

        if (!existing) {
          // Create appointment record
          await supabase.from('appointments').insert({
            account_id: connection.account_id,
            booked_by_user_id: connection.user_id,
            invitee_name: inviteeName,
            invitee_email: inviteeEmail,
            title: `Call with ${inviteeName}`,
            status: 'scheduled',
            appointment_type: 'call',
            start_time: startTime,
            end_time: endTime,
            timezone: eventData.timezone || 'UTC',
            duration_minutes: startTime && endTime
              ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
              : null,
            location,
            meeting_url: meetingUrl,
            calendly_event_uri: eventUri,
            calendly_invitee_uri: inviteeUri,
            calendly_cancel_url: cancelUrl,
            calendly_reschedule_url: rescheduleUrl,
            source: 'ai_agent',
          })
          console.log('[Calendly Webhook] Appointment created for:', inviteeEmail)
        }
        break
      }

      case 'invitee.canceled': {
        // Appointment cancelled
        const inviteeUri = eventData.uri
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('calendly_invitee_uri', inviteeUri)

        if (!error) {
          console.log('[Calendly Webhook] Appointment cancelled:', inviteeUri)
        }
        break
      }

      case 'invitee_no_show.created': {
        // No show recorded
        const inviteeUri = eventData.invitee
        await supabase
          .from('appointments')
          .update({ status: 'no_show' })
          .eq('calendly_invitee_uri', inviteeUri)
        break
      }

      default:
        console.log('[Calendly Webhook] Unhandled event type:', eventType)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Calendly Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}