import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ---------------------------------------------------------------------------
// Multi-tenant middleware
// ---------------------------------------------------------------------------
// Two products share one Next.js app:
//   • smile.rankedceo.com  →  app/smile/*   (Smile Dentist Dashboard)
//   • rankedceo.com / crm.rankedceo.com  →  app/*  (Main CRM)
//
// The middleware:
//   1. Refreshes the Supabase session (cookies) on every request.
//   2. Detects the subdomain from the Host header.
//   3. For "smile" subdomain → rewrites to /smile/* internally.
//   4. For CRM domain → passes through to existing routes.
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  // ── 1. Refresh Supabase auth session ──────────────────────────────────
  // We build the Supabase client inline so we can attach cookies to
  // whichever response we ultimately return (next OR rewrite).
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Touch the session so Supabase refreshes tokens if needed
  await supabase.auth.getUser()

  // ── 2. Detect subdomain ───────────────────────────────────────────────
  const hostname = request.headers.get('host') || ''
  const subdomain = extractSubdomain(hostname)

  // ── 3. Smile subdomain → rewrite to /smile/* ─────────────────────────
  if (subdomain === 'smile') {
    const url = request.nextUrl.clone()
    const { pathname } = url

    // Exclude auth/API routes from subdomain rewrite so both products can share auth
    const excludedPaths = [
      '/login',
      '/signup',
      '/api/auth',
    ]

    const isExcluded = excludedPaths.some(path => pathname.startsWith(path))

    // Don't rewrite excluded paths (auth routes)
    if (isExcluded) {
      return response
    }

    // Don't double-prefix if the path already starts with /smile
    if (!pathname.startsWith('/smile')) {
      url.pathname = `/smile${pathname}`
    }

    // Build a rewrite response and copy over the auth cookies
    const rewrite = NextResponse.rewrite(url)
    response.cookies.getAll().forEach((cookie) => {
      rewrite.cookies.set(cookie.name, cookie.value)
    })
    return rewrite
  }

  // ── 4. CRM domain → pass through (existing routes) ───────────────────
  return response
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract subdomain from the Host header.
 *
 * smile.rankedceo.com  → "smile"
 * crm.rankedceo.com    → "crm"
 * smile.localhost:3000  → "smile"
 * localhost:3000        → null
 */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0] // strip port

  const parts = host.split('.')

  // Plain localhost or bare IP
  if (parts.length < 2) return null

  // smile.localhost → "smile"
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0]
  }

  // sub.rankedceo.com → "sub"
  const knownDomains = ['rankedceo.com']
  const domain = parts.slice(-2).join('.')
  if (knownDomains.includes(domain) && parts.length > 2) {
    return parts[0]
  }

  return null
}

// ---------------------------------------------------------------------------
// Matcher – skip static assets
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}