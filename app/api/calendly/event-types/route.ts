import { NextResponse } from 'next/server'
import { AppointmentService } from '@/lib/services/appointment-service'
import { getEventTypes, refreshAccessToken } from '@/lib/services/calendly-service'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const appointmentService = new AppointmentService()
    const connection = await appointmentService.getCalendlyConnection()

    if (!connection) {
      return NextResponse.json(
        { error: 'Calendly not connected', connected: false },
        { status: 404 }
      )
    }

    // Check if token needs refresh
    let accessToken = connection.access_token
    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)
    ) {
      if (connection.refresh_token) {
        try {
          const refreshed = await refreshAccessToken(connection.refresh_token)
          accessToken = refreshed.access_token

          // Update token in database
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
          console.error('[Calendly Event Types] Token refresh failed:', err)
        }
      }
    }

    const eventTypes = await getEventTypes(accessToken, connection.calendly_user_uri!)

    return NextResponse.json({
      connected: true,
      event_types: eventTypes,
      user: {
        name: connection.calendly_user_name,
        email: connection.calendly_user_email,
      },
    })
  } catch (error) {
    console.error('[Calendly Event Types] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event types' },
      { status: 500 }
    )
  }
}