import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ---------------------------------------------------------------------------
// Multi-tenant middleware
// ---------------------------------------------------------------------------
// Products sharing one Next.js app via subdomain-based routing:
//
//   • smile.rankedceo.com      →  app/smile/*       (Smile Dentist Dashboard)
//   • hvac.rankedceo.com       →  app/hvac/*        (HVAC Pro)
//   • plumbing.rankedceo.com   →  app/plumbing/*    (Plumb Pro)
//   • electrical.rankedceo.com →  app/electrical/*  (Spark Pro)
//   • rankedceo.com / crm.*    →  app/*             (Main CRM)
//
// The middleware:
//   1. Refreshes the Supabase session (cookies) on every request.
//   2. Detects the subdomain from the Host header.
//   3. For industry subdomains → enforces industry isolation (auth metadata check).
//   4. Rewrites industry subdomain paths to /smile/*, /hvac/*, etc. internally.
//   5. For CRM domain → passes through to existing routes.
// ---------------------------------------------------------------------------

// All industry subdomains handled by this middleware
const INDUSTRY_SUBDOMAINS = ['smile', 'hvac', 'plumbing', 'electrical'] as const
type IndustrySubdomain = typeof INDUSTRY_SUBDOMAINS[number]

// Maps subdomain → expected user metadata industry value
const INDUSTRY_MAP: Record<IndustrySubdomain, string> = {
  smile:       'smile',
  hvac:        'hvac',
  plumbing:    'plumbing',
  electrical:  'electrical',
}

// Public paths on industry subdomains (no auth required)
const PUBLIC_INDUSTRY_PATH_SEGMENTS = [
  '/',                  // landing page (smile subdomain only)
  '/login',
  '/signup',
  '/onboarding',
  '/api/',
]

// Paths on the CRM domain that are public (no auth required)
const PUBLIC_CRM_PATHS = [
  '/',                      // landing page
  '/login',                 // login page
  '/signup',                // signup page
  '/pay',                   // checkout page (handles own auth redirect)
  '/api/auth',              // auth API routes
  '/api/',                  // all API routes
  '/_next',                 // Next.js internals
]

// Paths on the CRM domain that require authentication
const PROTECTED_CRM_PATHS = [
  '/dashboard',             // main dashboard
  '/contacts',              // contacts management
  '/campaigns',             // campaigns management
  '/deals',                 // deals/sales pipeline
  '/appointments',          // appointments
  '/settings',              // account settings
  '/billing',               // subscription billing
]

export async function middleware(request: NextRequest) {
  // ── 1. Refresh Supabase auth session ──────────────────────────────────────
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
          // Share auth cookies across all *.rankedceo.com subdomains
          // so a login on crm.rankedceo.com is valid on hvac.rankedceo.com, etc.
          const sharedOptions = isProductionDomain(request)
            ? { ...options, domain: '.rankedceo.com' }
            : options
          request.cookies.set({ name, value, ...sharedOptions })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...sharedOptions })
        },
        remove(name: string, options: CookieOptions) {
          const sharedOptions = isProductionDomain(request)
            ? { ...options, domain: '.rankedceo.com' }
            : options
          request.cookies.set({ name, value: '', ...sharedOptions })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...sharedOptions })
        },
      },
    }
  )

  // Touch the session so Supabase refreshes tokens if needed
  const { data: { user } } = await supabase.auth.getUser()

  // ── 2. Detect subdomain ───────────────────────────────────────────────────
  const hostname = request.headers.get('host') || ''
  const subdomain = extractSubdomain(hostname)

  // ── 3. Industry subdomain handling ────────────────────────────────────────
  if (subdomain && INDUSTRY_SUBDOMAINS.includes(subdomain as IndustrySubdomain)) {
    const industry = subdomain as IndustrySubdomain
    const { pathname } = request.nextUrl

    // Allow shared API and onboarding routes (not industry-specific)
    const isSharedRoute = ['/api/auth', '/api/', '/onboarding', '/_next'].some(p =>
      pathname.startsWith(p)
    )
    if (isSharedRoute) return response

    // Check if this is a public path (no auth or industry enforcement needed)
    const isPublicPath = PUBLIC_INDUSTRY_PATH_SEGMENTS.some(segment =>
      pathname.includes(segment)
    )

    // ── 3a. Industry isolation for authenticated routes ────────────────────
    if (!isPublicPath && user) {
      const userIndustry = user.user_metadata?.industry as string | undefined
      const expectedIndustry = INDUSTRY_MAP[industry]

      if (userIndustry && userIndustry !== expectedIndustry) {
        // User belongs to a different industry — redirect to their correct subdomain
        const correctUrl = request.nextUrl.clone()
        const host = hostname.split(':')[0]
        const port = hostname.includes(':') ? ':' + hostname.split(':')[1] : ''
        const baseDomain = host.split('.').slice(1).join('.')  // e.g. "rankedceo.com"
        correctUrl.hostname = `${userIndustry}.${baseDomain}${port}`
        correctUrl.pathname = '/'
        return NextResponse.redirect(correctUrl)
      }
    }

    // ── 3b. Special handling for subdomain root landing pages ─────────────
    // Each industry subdomain root → rewrites to its dedicated landing page
    const landingRoutes: Partial<Record<IndustrySubdomain, string>> = {
      smile:      '/landing',
      hvac:       '/landing-hvac',
      plumbing:   '/landing-plumbing',
      electrical: '/landing-electrical',
    }

    if (pathname === '/' && landingRoutes[industry]) {
      const url = request.nextUrl.clone()
      url.pathname = landingRoutes[industry]!
      const rewrite = NextResponse.rewrite(url)
      response.cookies.getAll().forEach(cookie => {
        rewrite.cookies.set(cookie.name, cookie.value)
      })
      return rewrite
    }

    // ── 3c. Rewrite to /{industry}/* internally ───────────────────────────
    const url = request.nextUrl.clone()

    // Don't double-prefix if already starts with /{industry}
    if (!pathname.startsWith(`/${industry}`)) {
      url.pathname = `/${industry}${pathname}`
    }

    const rewrite = NextResponse.rewrite(url)
    response.cookies.getAll().forEach(cookie => {
      rewrite.cookies.set(cookie.name, cookie.value)
    })
    return rewrite
  }

  // ── 4. CRM domain → check auth for protected routes ──────────────────────
  const { pathname } = request.nextUrl
  
  // Check if this is a static/API route (always allowed)
  const isStaticRoute = [
    '/_next',
    '/api/',
    '/favicon.ico',
  ].some(p => pathname.startsWith(p))
  
  if (isStaticRoute) return response

  // Check if this is a public route (allowed without auth)
  const isPublicRoute = PUBLIC_CRM_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  
  if (isPublicRoute) return response

  // Check if this is a protected route that requires auth
  const isProtectedRoute = PROTECTED_CRM_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  
  if (isProtectedRoute && !user) {
    // Redirect unauthenticated users to login
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // All other routes (authenticated routes or unmatched routes) → pass through
  return response
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the request is on the production rankedceo.com domain.
 * Used to conditionally set cross-subdomain cookies only in production.
 * In local development (localhost), we skip the domain cookie to avoid issues.
 */
function isProductionDomain(request: NextRequest): boolean {
  const host = (request.headers.get('host') || '').split(':')[0]
  return host.endsWith('.rankedceo.com') || host === 'rankedceo.com'
}

/**
 * Extract subdomain from the Host header.
 *
 * smile.rankedceo.com      → "smile"
 * hvac.rankedceo.com       → "hvac"
 * plumbing.rankedceo.com   → "plumbing"
 * electrical.rankedceo.com → "electrical"
 * crm.rankedceo.com        → "crm"
 * smile.localhost:3000     → "smile"
 * localhost:3000           → null
 */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0] // strip port

  const parts = host.split('.')

  // Plain localhost or bare IP — no subdomain
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