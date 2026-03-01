import { NextResponse } from 'next/server'
import { AppointmentService } from '@/lib/services/appointment-service'
import { revokeToken } from '@/lib/services/calendly-service'

export async function POST() {
  try {
    const appointmentService = new AppointmentService()

    // Get current connection before disconnecting
    const connection = await appointmentService.getCalendlyConnection()

    if (connection) {
      // Revoke token with Calendly
      try {
        await revokeToken(connection.access_token)
      } catch (err) {
        // Continue even if revocation fails - still disconnect locally
        console.warn('[Calendly Disconnect] Token revocation failed:', err)
      }

      // Mark as inactive in database
      await appointmentService.disconnectCalendly()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Calendly Disconnect] Error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Calendly' },
      { status: 500 }
    )
  }
}