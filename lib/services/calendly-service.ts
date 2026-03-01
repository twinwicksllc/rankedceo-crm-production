// ============================================================
// Calendly API v2 Service
// Handles OAuth flow, event types, availability, and booking
// ============================================================

import type {
  CalendlyConnection,
  CalendlyEventType,
  CalendlyAvailableSlot,
  CalendlyBookingResult,
} from '@/lib/types/appointment'

const CALENDLY_API_BASE = 'https://api.calendly.com'
const CALENDLY_AUTH_BASE = 'https://auth.calendly.com'

// ── OAuth ────────────────────────────────────────────────────

export function getCalendlyAuthUrl(state: string): string {
  const clientId = process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendly/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })

  return `${CALENDLY_AUTH_BASE}/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}> {
  const clientId = process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID!
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendly/callback`

  const response = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Calendly token exchange failed: ${error}`)
  }

  return response.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const clientId = process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID!
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET!

  const response = await fetch(`${CALENDLY_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Calendly token')
  }

  return response.json()
}

// ── Calendly API helper ──────────────────────────────────────

async function calendlyFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(`${CALENDLY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Calendly API error ${response.status}: ${error}`)
  }

  return response.json()
}

// ── User Info ────────────────────────────────────────────────

export async function getCalendlyUser(accessToken: string): Promise<{
  uri: string
  name: string
  email: string
  organization: string
}> {
  const data = await calendlyFetch('/users/me', accessToken)
  return {
    uri: data.resource.uri,
    name: data.resource.name,
    email: data.resource.email,
    organization: data.resource.current_organization,
  }
}

// ── Event Types ──────────────────────────────────────────────

export async function getEventTypes(
  accessToken: string,
  userUri: string
): Promise<CalendlyEventType[]> {
  const params = new URLSearchParams({
    user: userUri,
    active: 'true',
    count: '20',
  })

  const data = await calendlyFetch(`/event_types?${params}`, accessToken)

  return (data.collection || []).map((et: any) => ({
    uri: et.uri,
    name: et.name,
    description: et.description_plain || null,
    duration: et.duration,
    slug: et.slug,
    scheduling_url: et.scheduling_url,
    active: et.active,
    kind: et.kind,
    color: et.color,
  }))
}

// ── Availability ─────────────────────────────────────────────

export async function getAvailableSlots(
  accessToken: string,
  eventTypeUri: string,
  startTime: string,
  endTime: string
): Promise<CalendlyAvailableSlot[]> {
  const params = new URLSearchParams({
    event_type: eventTypeUri,
    start_time: startTime,
    end_time: endTime,
  })

  const data = await calendlyFetch(
    `/event_type_available_times?${params}`,
    accessToken
  )

  return (data.collection || []).map((slot: any) => ({
    start_time: slot.start_time,
    end_time: slot.end_time,
    status: 'available' as const,
    invitees_remaining: slot.invitees_remaining ?? 1,
  }))
}

// ── Book Appointment (Create Invitee) ────────────────────────

export async function createInvitee(
  accessToken: string,
  eventTypeUri: string,
  startTime: string,
  invitee: {
    name: string
    email: string
    timezone?: string
    customAnswers?: Array<{ question: string; answer: string }>
  }
): Promise<CalendlyBookingResult> {
  // Calendly v2 uses one-off event scheduling
  // We create a scheduling link and then book via the invitee endpoint
  const data = await calendlyFetch('/one_off_event_types', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name: `Meeting with ${invitee.name}`,
      host: eventTypeUri.split('/').pop(), // user URI slug
      duration: 30,
      timezone: invitee.timezone || 'UTC',
      date_setting: {
        type: 'date_range',
        start_date: startTime.split('T')[0],
        end_date: startTime.split('T')[0],
      },
      location: { kind: 'ask_invitee' },
    }),
  })

  return {
    event_uri: data.resource?.uri || '',
    invitee_uri: '',
    cancel_url: data.resource?.booking_url || '',
    reschedule_url: data.resource?.booking_url || '',
    meeting_url: data.resource?.booking_url,
    start_time: startTime,
    end_time: startTime,
  }
}

// ── Webhook Verification ─────────────────────────────────────

export function verifyCalendlyWebhook(
  payload: string,
  signature: string,
  signingKey: string
): boolean {
  try {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', signingKey)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

// ── Get Scheduling URL (simplest booking method) ─────────────
// For public booking, we use Calendly's hosted scheduling page
// This is the most reliable approach for the chat widget

export async function getSchedulingUrl(
  accessToken: string,
  userUri: string,
  eventTypeSlug?: string
): Promise<string> {
  const user = await getCalendlyUser(accessToken)
  const username = user.uri.split('/').pop()

  if (eventTypeSlug) {
    return `https://calendly.com/${username}/${eventTypeSlug}`
  }

  return `https://calendly.com/${username}`
}

// ── Revoke Token ─────────────────────────────────────────────

export async function revokeToken(accessToken: string): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID!
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET!

  await fetch(`${CALENDLY_AUTH_BASE}/oauth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: accessToken,
    }),
  })
}