import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendlyAuthUrl } from '@/lib/services/calendly-service'
import { randomBytes } from 'crypto'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))
    }

    // Generate state token to prevent CSRF
    const state = randomBytes(32).toString('hex')

    // Store state in a short-lived cookie
    const authUrl = getCalendlyAuthUrl(state)

    const response = NextResponse.redirect(authUrl)
    response.cookies.set('calendly_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[Calendly Connect] Error:', error)
    return NextResponse.redirect(
      new URL('/settings?error=calendly_connect_failed', process.env.NEXT_PUBLIC_APP_URL!)
    )
  }
}