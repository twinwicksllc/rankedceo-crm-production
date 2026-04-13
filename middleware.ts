import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { resolveTenantByHostname } from '@/lib/waas/supabase'
import {
  WAAS_HEADERS,
  type WaasTenantResolved,
} from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// Multi-tenant middleware — RankedCEO Unified Router
// ---------------------------------------------------------------------------
//
// ROUTING PRIORITY (evaluated in order):
//
//   1. WaaS Custom Domain     client-a.com           → /_sites/[slug]/*
//   2. WaaS Subdomain         client-a.rankedceo.com → /_sites/[slug]/*
//   3. Audit Subdomain        audit.rankedceo.com    → /audit-landing (public landing)
//   4. Industry Subdomain     smile.rankedceo.com    → /smile/*
//                             hvac.rankedceo.com     → /hvac/*
//                             plumbing.rankedceo.com → /plumbing/*
//                             electrical.rankedceo.com → /electrical/*
//   5. CRM Domain             crm.rankedceo.com      → app/* (auth-gated)
//   6. Root Domain            rankedceo.com          → app/* (landing / audit tool)
//
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// Known industry subdomains (existing feature — unchanged behaviour)
const INDUSTRY_SUBDOMAINS = ['smile', 'hvac', 'plumbing', 'electrical'] as const
type IndustrySubdomain = typeof INDUSTRY_SUBDOMAINS[number]

const INDUSTRY_MAP: Record<IndustrySubdomain, string> = {
  smile:       'smile',
  hvac:        'hvac',
  plumbing:    'plumbing',
  electrical:  'electrical',
}

// WaaS env flag — if WaaS Supabase vars are not set, skip WaaS lookup entirely
const WAAS_ENABLED =
  !!process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY

// Internal subdomains that are NEVER treated as WaaS tenants
const RESERVED_SUBDOMAINS = new Set([
  ...INDUSTRY_SUBDOMAINS,
  'crm',
  'audit',     // Audit tool landing page (audit.rankedceo.com → /audit-landing)
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'smtp',
  'ftp',
  'staging',
  'dev',
  'preview',
])

// CRM public paths (no auth required)
const PUBLIC_CRM_PATHS = [
  '/',
  '/login',
  '/signup',
  '/pay',
  '/api/auth',
  '/api/',
  '/_next',
]

// CRM protected paths (auth required)
const PROTECTED_CRM_PATHS = [
  '/dashboard',
  '/contacts',
  '/campaigns',
  '/deals',
  '/appointments',
  '/settings',
  '/billing',
]

// Industry subdomain public paths
const PUBLIC_INDUSTRY_PATH_SEGMENTS = ['/', '/login', '/signup', '/onboarding', '/api/']

// ---------------------------------------------------------------------------
// MAIN MIDDLEWARE
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // Always pass through static assets and Next.js internals immediately
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // ── 1. Refresh CRM Supabase session ──────────────────────────────────────
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

  const { data: { user } } = await supabase.auth.getUser()

  // ── 2. Extract subdomain ──────────────────────────────────────────────────
  const subdomain = extractSubdomain(hostname)

  // ── 3. Industry subdomains (existing behaviour — unchanged) ───────────────
  if (subdomain && INDUSTRY_SUBDOMAINS.includes(subdomain as IndustrySubdomain)) {
    return handleIndustrySubdomain(request, response, subdomain as IndustrySubdomain, user, hostname)
  }

  // ── 4. WaaS tenant resolution ─────────────────────────────────────────────
  // Skip WaaS lookup if:
  //   a) WaaS is not configured (env vars missing)
  //   b) This is a reserved/known subdomain
  //   c) This is the bare rankedceo.com or crm.rankedceo.com domain
  const isCrmDomain = isKnownCrmDomain(hostname)

  if (WAAS_ENABLED && !isCrmDomain && !isReservedSubdomain(subdomain)) {
    const tenant = await resolveTenantByHostname(hostname)

    if (tenant) {
      return handleWaasTenant(request, tenant, pathname)
    }
  }

  // ── 5. CRM domain — auth protection ──────────────────────────────────────
  if (isStaticOrApiRoute(pathname)) return response

  const isPublicRoute = PUBLIC_CRM_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isPublicRoute) return response

  const isProtectedRoute = PROTECTED_CRM_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isProtectedRoute && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

// ---------------------------------------------------------------------------
// HANDLER: WaaS Tenant
// ---------------------------------------------------------------------------

function handleWaasTenant(
  request: NextRequest,
  tenant: WaasTenantResolved,
  pathname: string
): NextResponse {
  const url = request.nextUrl.clone()

  // Rewrite to /_sites/[slug]/[...path]
  // e.g. client-a.com/services → /_sites/client-a/services
  url.pathname = `/_sites/${tenant.slug}${pathname === '/' ? '' : pathname}`

  const rewrite = NextResponse.rewrite(url)

  // Inject tenant context into request headers for downstream page components
  rewrite.headers.set(WAAS_HEADERS.TENANT_ID,    tenant.id)
  rewrite.headers.set(WAAS_HEADERS.TENANT_SLUG,  tenant.slug)
  rewrite.headers.set(WAAS_HEADERS.BRAND_CONFIG, JSON.stringify(tenant.brand_config))
  rewrite.headers.set(WAAS_HEADERS.PACKAGE_TIER, tenant.package_tier)
  rewrite.headers.set(WAAS_HEADERS.INDUSTRY,     tenant.target_industry ?? '')
  rewrite.headers.set(WAAS_HEADERS.LOCATION,     tenant.target_location ?? '')

  // Cache hint: tenant data is stable, allow CDN edge caching for 60s
  rewrite.headers.set('x-waas-cache-hint', 'tenant-resolved')

  return rewrite
}

// ---------------------------------------------------------------------------
// HANDLER: Industry Subdomain (existing logic, preserved exactly)
// ---------------------------------------------------------------------------

function handleIndustrySubdomain(
  request: NextRequest,
  response: NextResponse,
  industry: IndustrySubdomain,
  user: { user_metadata?: Record<string, unknown> } | null,
  hostname: string
): NextResponse {
  const { pathname } = request.nextUrl

  // Allow shared API and onboarding routes
  const isSharedRoute = ['/api/auth', '/api/', '/onboarding', '/_next'].some(p =>
    pathname.startsWith(p)
  )
  if (isSharedRoute) return response

  const isPublicPath = PUBLIC_INDUSTRY_PATH_SEGMENTS.some(segment =>
    pathname.includes(segment)
  )

  // Industry isolation for authenticated routes
  if (!isPublicPath && user) {
    const userIndustry = user.user_metadata?.industry as string | undefined
    const expectedIndustry = INDUSTRY_MAP[industry]

    if (userIndustry && userIndustry !== expectedIndustry) {
      const correctUrl = request.nextUrl.clone()
      const host = hostname.split(':')[0]
      const port = hostname.includes(':') ? ':' + hostname.split(':')[1] : ''
      const baseDomain = host.split('.').slice(1).join('.')
      correctUrl.hostname = `${userIndustry}.${baseDomain}${port}`
      correctUrl.pathname = '/'
      return NextResponse.redirect(correctUrl)
    }
  }

  // Special handling for subdomain root landing pages
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

  // Rewrite to /{industry}/* internally
  const url = request.nextUrl.clone()
  if (!pathname.startsWith(`/${industry}`)) {
    url.pathname = `/${industry}${pathname}`
  }

  const rewrite = NextResponse.rewrite(url)
  response.cookies.getAll().forEach(cookie => {
    rewrite.cookies.set(cookie.name, cookie.value)
  })
  return rewrite
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Extract subdomain from hostname.
 *
 * Examples:
 *   client-a.rankedceo.com  → 'client-a'
 *   smile.rankedceo.com     → 'smile'
 *   crm.rankedceo.com       → 'crm'
 *   client-a.com            → null  (custom domain — no subdomain to extract)
 *   rankedceo.com           → null
 *   localhost:3000          → null
 *   client-a.localhost:3000 → 'client-a'
 */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0]   // strip port
  const parts = host.split('.')

  if (parts.length < 2) return null

  // sub.localhost → 'sub'
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0]
  }

  // sub.rankedceo.com → 'sub'
  const knownDomains = ['rankedceo.com']
  const domain = parts.slice(-2).join('.')
  if (knownDomains.includes(domain) && parts.length > 2) {
    return parts[0]
  }

  // custom-domain.com → no subdomain
  return null
}

/**
 * Returns true if hostname is the main CRM domain (not a WaaS tenant site).
 */
function isKnownCrmDomain(hostname: string): boolean {
  const host = hostname.split(':')[0]
  return (
    host === 'rankedceo.com' ||
    host === 'crm.rankedceo.com' ||
    host === 'www.rankedceo.com' ||
    host === 'localhost'
  )
}

/**
 * Returns true if subdomain is reserved (never a WaaS tenant).
 */
function isReservedSubdomain(subdomain: string | null): boolean {
  if (!subdomain) return false
  return RESERVED_SUBDOMAINS.has(subdomain)
}

/**
 * Returns true if this is a static asset (skip all middleware logic).
 */
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico'
  )
}

/**
 * Returns true if this is a static or API route (pass through for CRM).
 */
function isStaticOrApiRoute(pathname: string): boolean {
  return ['/_next', '/api/', '/favicon.ico'].some(p => pathname.startsWith(p))
}

/**
 * Returns true if the request is on production rankedceo.com.
 * Used to conditionally set cross-subdomain cookies only in production.
 */
function isProductionDomain(request: NextRequest): boolean {
  const host = (request.headers.get('host') || '').split(':')[0]
  return host.endsWith('.rankedceo.com') || host === 'rankedceo.com'
}

// ---------------------------------------------------------------------------
// MATCHER — skip static file extensions
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// HANDLER: Audit Subdomain
// ---------------------------------------------------------------------------

function handleAuditSubdomain(
  request: NextRequest,
  response: NextResponse,
  user: { user_metadata?: Record<string, unknown> } | null,
  hostname: string
): NextResponse {
  const { pathname } = request.nextUrl

  // Allow API and onboarding routes to pass through
  const isSharedRoute = ['/api/auth', '/api/', '/onboarding', '/_next'].some(p =>
    pathname.startsWith(p)
  )
  if (isSharedRoute) return response

  // Rewrite root / to /audit-landing
  const url = request.nextUrl.clone()
  if (pathname === '/') {
    url.pathname = '/audit-landing'
  } else {
    url.pathname = `/audit-landing${pathname}`
  }

  const rewrite = NextResponse.rewrite(url)
  response.cookies.getAll().forEach(cookie => {
    rewrite.cookies.set(cookie.name, cookie.value)
  })
  return rewrite
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot)$).*)',
  ],
}