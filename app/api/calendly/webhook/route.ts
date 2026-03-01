import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ── Signature Verification ───────────────────────────────────────────────────
function verifyCalendlySignature(
  rawBody: string,
  signatureHeader: string,
  signingKey: string
): { valid: boolean; expected: string; received: string; timestamp: string } {
  // Calendly signature header format: "t=<timestamp>,v1=<hmac_hex>"
  const parts: Record<string, string> = {}
  signatureHeader.split(',').forEach(part => {
    const [key, ...rest] = part.split('=')
    parts[key.trim()] = rest.join('=').trim()
  })

  const timestamp = parts['t'] || ''
  const received = parts['v1'] || ''

  // Compute expected HMAC-SHA256: HMAC(timestamp + '.' + rawBody)
  const signedPayload = `${timestamp}.${rawBody}`
  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(signedPayload, 'utf8')
    .digest('hex')

  console.log('[Calendly Webhook] Signature debug:')
  console.log('  Timestamp     :', timestamp)
  console.log('  Signed payload:', signedPayload.substring(0, 80) + '...')
  console.log('  Expected sig  :', expected)
  console.log('  Received sig  :', received)

  let valid = false
  try {
    // Use timingSafeEqual to prevent timing attacks
    valid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex')
    )
  } catch {
    // Buffers of different length will throw - means invalid
    valid = false
  }

  return { valid, expected, received, timestamp }
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 1. Read raw body as text (MUST be before any other body parsing)
  const rawBody = await request.text()

  // 2. Get signature header
  const signatureHeader =
    request.headers.get('calendly-webhook-signature') ||
    request.headers.get('x-calendly-signature') ||
    ''

  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY || ''

  console.log('[Calendly Webhook] Received event')
  console.log('  Signature header:', signatureHeader)
  console.log('  Signing key set :', signingKey ? `yes (length: ${signingKey.length})` : 'NO - MISSING')
  console.log('  Raw body length :', rawBody.length)

  // 3. Verify signature (only if signing key is configured)
  if (signingKey) {
    if (!signatureHeader) {
      console.error('[Calendly Webhook] Missing signature header')
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 })
    }

    const { valid, expected, received, timestamp } = verifyCalendlySignature(
      rawBody,
      signatureHeader,
      signingKey
    )

    if (!valid) {
      console.error('[Calendly Webhook] ❌ Signature verification FAILED')
      console.error('  Expected:', expected)
      console.error('  Received:', received)
      console.error('  Timestamp:', timestamp)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    console.log('[Calendly Webhook] ✅ Signature verified successfully')
  } else {
    console.warn('[Calendly Webhook] ⚠️  CALENDLY_WEBHOOK_SIGNING_KEY not set - skipping verification')
  }

  // 4. Parse payload
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch (err) {
    console.error('[Calendly Webhook] Failed to parse JSON body:', err)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const eventType = payload.event
  const eventData = payload.payload

  console.log('[Calendly Webhook] Processing event type:', eventType)

  // 5. Handle events
  try {
    const supabase = await createClient()

    switch (eventType) {
      case 'invitee.created': {
        const eventUri = eventData?.event
        const inviteeUri = eventData?.uri
        const inviteeName = eventData?.name
        const inviteeEmail = eventData?.email
        const startTime = eventData?.scheduled_event?.start_time
        const endTime = eventData?.scheduled_event?.end_time
        const cancelUrl = eventData?.cancel_url
        const rescheduleUrl = eventData?.reschedule_url
        const meetingUrl = eventData?.scheduled_event?.location?.join_url || null
        const location = eventData?.scheduled_event?.location?.location || null
        const timezone = eventData?.timezone || 'UTC'

        console.log('[Calendly Webhook] New invitee:', inviteeEmail, 'for event:', eventUri)

        // Find the account that owns this Calendly connection
        const organizerUri =
          eventData?.scheduled_event?.event_memberships?.[0]?.user || null

        let accountId: string | null = null
        let userId: string | null = null

        if (organizerUri) {
          const { data: connection } = await supabase
            .from('calendly_connections')
            .select('account_id, user_id')
            .eq('calendly_user_uri', organizerUri)
            .eq('is_active', true)
            .single()

          if (connection) {
            accountId = connection.account_id
            userId = connection.user_id
          }
        }

        // Fallback to first active connection if organizer not found
        if (!accountId) {
          const { data: fallback } = await supabase
            .from('calendly_connections')
            .select('account_id, user_id')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (fallback) {
            accountId = fallback.account_id
            userId = fallback.user_id
            console.log('[Calendly Webhook] Using fallback connection for account:', accountId)
          }
        }

        if (!accountId) {
          console.warn('[Calendly Webhook] No matching Calendly connection found - storing to default')
          break
        }

        // Check if appointment already exists
        const { data: existing } = await supabase
          .from('appointments')
          .select('id')
          .eq('calendly_invitee_uri', inviteeUri)
          .single()

        if (!existing) {
          const durationMinutes =
            startTime && endTime
              ? Math.round(
                  (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
                )
              : null

          const { error: insertError } = await supabase.from('appointments').insert({
            account_id: accountId,
            booked_by_user_id: userId,
            invitee_name: inviteeName,
            invitee_email: inviteeEmail,
            title: `Call with ${inviteeName}`,
            status: 'scheduled',
            appointment_type: 'call',
            start_time: startTime,
            end_time: endTime,
            timezone,
            duration_minutes: durationMinutes,
            location,
            meeting_url: meetingUrl,
            calendly_event_uri: eventUri,
            calendly_invitee_uri: inviteeUri,
            calendly_cancel_url: cancelUrl,
            calendly_reschedule_url: rescheduleUrl,
            source: 'ai_agent',
          })

          if (insertError) {
            console.error('[Calendly Webhook] Failed to insert appointment:', insertError)
          } else {
            console.log('[Calendly Webhook] ✅ Appointment created for:', inviteeEmail)
          }
        } else {
          console.log('[Calendly Webhook] Appointment already exists for invitee:', inviteeUri)
        }
        break
      }

      case 'invitee.canceled': {
        const inviteeUri = eventData?.uri
        console.log('[Calendly Webhook] Cancelling appointment for invitee:', inviteeUri)

        const { error } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('calendly_invitee_uri', inviteeUri)

        if (error) {
          console.error('[Calendly Webhook] Failed to cancel appointment:', error)
        } else {
          console.log('[Calendly Webhook] ✅ Appointment cancelled for invitee:', inviteeUri)
        }
        break
      }

      case 'invitee_no_show.created': {
        const inviteeUri = eventData?.invitee
        await supabase
          .from('appointments')
          .update({ status: 'no_show' })
          .eq('calendly_invitee_uri', inviteeUri)
        console.log('[Calendly Webhook] ✅ No-show recorded for invitee:', inviteeUri)
        break
      }

      default:
        console.log('[Calendly Webhook] Unhandled event type:', eventType)
    }
  } catch (err) {
    console.error('[Calendly Webhook] Error processing event:', err)
    // Still return 200 to prevent Calendly from retrying
  }

  return NextResponse.json({ received: true })
}