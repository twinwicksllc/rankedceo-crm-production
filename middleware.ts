import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Get the hostname from the request
  const hostname = request.headers.get('host') || ''
  
  // Extract subdomain from hostname
  // Examples: smile.rankedceo.com -> smile | crm.rankedceo.com -> crm | localhost:3000 -> null
  const subdomain = extractSubdomain(hostname)
  
  // Handle subdomain-specific routing
  if (subdomain === 'smile') {
    // First, update the session to maintain authentication
    const sessionResponse = await updateSession(request)
    
    // Rewrite to (smile) route group while keeping browser URL intact
    const url = request.nextUrl.clone()
    url.pathname = `/smile${url.pathname}`
    
    // Create rewrite response that includes session cookies from sessionResponse
    const rewriteResponse = NextResponse.rewrite(url)
    
    // Copy headers from session response to preserve auth cookies
    sessionResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        rewriteResponse.headers.append(key, value)
      }
    })
    
    return rewriteResponse
  }
  
  // Route: Standard CRM (crm.rankedceo.com, localhost, etc.) - existing behavior
  // Pass through to existing session update middleware
  return await updateSession(request)
}

/**
 * Extract subdomain from hostname
 * @param hostname - The host header value (e.g., 'smile.rankedceo.com', 'smile.localhost:3000', 'crm.rankedceo.com', 'localhost:3000')
 * @returns The subdomain string, or null if no subdomain exists
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0]
  
  // Split by dots
  const parts = host.split('.')
  
  // If less than 2 parts, it's localhost or invalid
  if (parts.length < 2) {
    return null
  }
  
  // Special handling for localhost: if it's smile.localhost, return "smile"
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0]
  }
  
  // Check if it's a known domain (rankedceo.com, etc.)
  const knownDomains = ['rankedceo.com']
  const domain = parts.slice(-2).join('.')
  
  // If the last 2 parts match a known domain and there are more parts, extract subdomain
  if (knownDomains.includes(domain) && parts.length > 2) {
    return parts[0] // Return first part as subdomain
  }
  
  return null
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}