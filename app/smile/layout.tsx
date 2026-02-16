import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Smile MakeOver - Dentist Dashboard',
  description: 'Patient qualification and case mix revenue management for dental practices',
}

/**
 * Smile Dashboard Layout
 * 
 * Protects /smile routes: only accessible via smile.rankedceo.com subdomain.
 * Direct access to /smile from the main domain redirects to /.
 */
export default async function SmileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ── Guard: Verify subdomain is "smile" ──────────────────────────────
  const headersObj = await headers()
  const hostname = headersObj.get('host') || ''
  
  // Extract subdomain
  const host = hostname.split(':')[0] // strip port
  const parts = host.split('.')
  
  let isSmileSubdomain = false
  
  // Check if subdomain is "smile"
  if (parts.length === 2 && parts[1] === 'localhost') {
    // smile.localhost:3000 → "smile"
    isSmileSubdomain = parts[0] === 'smile'
  } else if (parts.length > 2) {
    // smile.rankedceo.com → "smile"
    isSmileSubdomain = parts[0] === 'smile'
  }
  
  // Redirect if not on smile subdomain
  if (!isSmileSubdomain) {
    redirect('/')
  }
  
  return <>{children}</>
}
