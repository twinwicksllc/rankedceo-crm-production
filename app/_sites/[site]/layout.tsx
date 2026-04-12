// =============================================================================
// WaaS Tenant Layout
// This layout wraps ALL pages rendered under a WaaS tenant domain.
// It reads tenant context from the request headers (injected by middleware)
// and applies brand configuration (colors, fonts, business name).
// =============================================================================

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { WAAS_HEADERS, type WaasBrandConfig, DEFAULT_BRAND_CONFIG } from '@/lib/waas/types'

interface WaasTenantLayoutProps {
  children: React.ReactNode
  params: { site: string }
}

export default function WaasTenantLayout({ children, params }: WaasTenantLayoutProps) {
  const headersList = headers()

  // Read tenant context injected by middleware
  const tenantId    = headersList.get(WAAS_HEADERS.TENANT_ID)
  const tenantSlug  = headersList.get(WAAS_HEADERS.TENANT_SLUG)
  const packageTier = headersList.get(WAAS_HEADERS.PACKAGE_TIER)
  const industry    = headersList.get(WAAS_HEADERS.INDUSTRY)
  const brandRaw    = headersList.get(WAAS_HEADERS.BRAND_CONFIG)

  // If no tenant context — middleware should have caught this, but guard anyway
  if (!tenantId || tenantSlug !== params.site) {
    notFound()
  }

  // Parse brand config safely
  let brand: WaasBrandConfig = DEFAULT_BRAND_CONFIG
  if (brandRaw) {
    try {
      brand = JSON.parse(brandRaw) as WaasBrandConfig
    } catch {
      // Fall back to default brand
    }
  }

  const colors = { ...DEFAULT_BRAND_CONFIG.colors, ...brand.colors }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{brand.business_name ?? 'RankedCEO'}</title>
        {brand.favicon_url && <link rel="icon" href={brand.favicon_url} />}

        {/* Inject brand colors as CSS custom properties */}
        <style>{`
          :root {
            --brand-primary:    ${colors?.primary    ?? '#2563EB'};
            --brand-secondary:  ${colors?.secondary  ?? '#1E40AF'};
            --brand-accent:     ${colors?.accent     ?? '#DBEAFE'};
            --brand-background: ${colors?.background ?? '#FFFFFF'};
            --brand-text:       ${colors?.text       ?? '#111827'};
          }
          body {
            background-color: var(--brand-background);
            color:            var(--brand-text);
          }
        `}</style>
      </head>
      <body>
        {/* Tenant context available to all child components via props/slots */}
        <div
          data-tenant-id={tenantId}
          data-tenant-slug={tenantSlug}
          data-package-tier={packageTier ?? 'hosting'}
          data-industry={industry ?? ''}
        >
          {children}
        </div>
      </body>
    </html>
  )
}

// Generate metadata for SEO (business name in <title>)
export async function generateMetadata({ params }: { params: { site: string } }) {
  const headersList = headers()
  const brandRaw    = headersList.get(WAAS_HEADERS.BRAND_CONFIG)

  let brand: WaasBrandConfig = DEFAULT_BRAND_CONFIG
  if (brandRaw) {
    try { brand = JSON.parse(brandRaw) } catch { /* use default */ }
  }

  return {
    title:       brand.business_name ?? 'RankedCEO',
    description: brand.tagline       ?? 'AI-Powered Local Business Marketing',
  }
}