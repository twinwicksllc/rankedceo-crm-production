// =============================================================================
// Supabase OAuth Callback Handler
// Handles Google OAuth and Magic Link redirects
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('[Auth Callback] OAuth error:', error)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    )
  }

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[Auth Callback] Code exchange error:', exchangeError.message)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    return response
  }

  // No code — redirect to login
  return NextResponse.redirect(`${origin}/login`)
}