import { NextRequest, NextResponse } from 'next/server'
import { AppointmentService } from '@/lib/services/appointment-service'
import { getAvailableSlots, refreshAccessToken } from '@/lib/services/calendly-service'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventTypeUri = searchParams.get('event_type_uri')
    const startTime = searchParams.get('start_time')
    const endTime = searchParams.get('end_time')
    const accountId = searchParams.get('account_id') // for public widget

    if (!eventTypeUri || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'event_type_uri, start_time, and end_time are required' },
        { status: 400 }
      )
    }

    const appointmentService = new AppointmentService()

    // Get connection - either for current user or for a specific account (public widget)
    let connection = null
    if (accountId) {
      connection = await appointmentService.getAccountCalendlyConnection(accountId)
    } else {
      connection = await appointmentService.getCalendlyConnection()
    }

    if (!connection) {
      return NextResponse.json(
        { error: 'Calendly not connected', connected: false },
        { status: 404 }
      )
    }

    // Refresh token if needed
    let accessToken = connection.access_token
    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000) &&
      connection.refresh_token
    ) {
      try {
        const refreshed = await refreshAccessToken(connection.refresh_token)
        accessToken = refreshed.access_token
        const supabase = await createClient()
        await supabase
          .from('calendly_connections')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          })
          .eq('id', connection.id)
      } catch (err) {
        console.warn('[Calendly Availability] Token refresh failed:', err)
      }
    }

    const slots = await getAvailableSlots(accessToken, eventTypeUri, startTime, endTime)

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('[Calendly Availability] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}