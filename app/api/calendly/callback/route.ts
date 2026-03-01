import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeCodeForTokens,
  getCalendlyUser,
} from '@/lib/services/calendly-service'
import { AppointmentService } from '@/lib/services/appointment-service'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle Calendly OAuth errors
  if (error) {
    console.error('[Calendly Callback] OAuth error:', error)
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=calendly_denied', appUrl)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=calendly_invalid', appUrl)
    )
  }

  // Verify state to prevent CSRF
  const storedState = request.cookies.get('calendly_oauth_state')?.value
  if (!storedState || storedState !== state) {
    console.error('[Calendly Callback] State mismatch')
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=calendly_state_mismatch', appUrl)
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', appUrl))
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Get Calendly user info
    const calendlyUser = await getCalendlyUser(tokens.access_token)

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Normalize URIs by trimming trailing slashes
    const normalizedUserUri = calendlyUser.uri.replace(/\/$/, '')
    const normalizedOrgUri = calendlyUser.organization?.replace(/\/$/, '')

    // Save connection to database
    const appointmentService = new AppointmentService()
    await appointmentService.saveCalendlyConnection({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      calendly_user_uri: normalizedUserUri,
      calendly_user_name: calendlyUser.name,
      calendly_user_email: calendlyUser.email,
      calendly_organization_uri: normalizedOrgUri,
    })

    // Clear state cookie and redirect to settings
    const response = NextResponse.redirect(
      new URL('/settings?tab=integrations&success=calendly_connected', appUrl)
    )
    response.cookies.delete('calendly_oauth_state')

    return response
  } catch (err) {
    console.error('[Calendly Callback] Error:', err)
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=calendly_failed', appUrl)
    )
  }
}