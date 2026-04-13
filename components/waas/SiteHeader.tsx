// =============================================================================
// WaaS Phase 4: SiteHeader
// Master header shared across all tenant sites
// SEO-friendly: uses nav, aria-labels, skip-to-content link
// =============================================================================

import Image from 'next/image'
import Link  from 'next/link'
import type { ResolvedTenant } from '@/lib/waas/templates/types'
import { generateTextmarkSvg, svgToDataUrl } from '@/lib/waas/utils/generate-textmark'
import { getBrandColor } from '@/lib/waas/utils/theme'

interface SiteHeaderProps {
  tenant: ResolvedTenant
}

export function SiteHeader({ tenant }: SiteHeaderProps) {
  const { brand_config } = tenant
  const businessName  = brand_config.business_name ?? tenant.legal_name ?? 'Home'
  const phone         = brand_config.contact?.phone
  const primaryColor  = getBrandColor(brand_config, 'primary')
  const logoSrc       = brand_config.logo_url
    ?? svgToDataUrl(generateTextmarkSvg(businessName, primaryColor))

  return (
    <>
      {/* Skip to content (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:bg-white focus:text-black"
      >
        Skip to main content
      </a>

      <header
        className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
        style={{
          backgroundColor: `rgb(var(--brand-background-rgb) / 0.95)`,
          borderColor:     'var(--brand-accent)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo / Wordmark */}
            <Link href="/" className="flex items-center gap-3" aria-label={`${businessName} Home`}>
              <Image
                src={logoSrc}
                alt={`${businessName} logo`}
                width={160}
                height={44}
                className="h-10 sm:h-11 w-auto object-contain"
                priority
              />
            </Link>

            {/* Nav */}
            <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
              {[
                { label: 'Services',  href: '#services' },
                { label: 'About',     href: '#trust' },
                { label: 'Reviews',   href: '#reviews' },
                { label: 'Contact',   href: '#booking' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="font-brand-body text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--brand-text)' }}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* CTA Phone */}
            {phone && (
              <a
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--brand-primary)' }}
                aria-label={`Call us at ${phone}`}
              >
                <span aria-hidden="true">📞</span>
                <span className="hidden sm:inline">{phone}</span>
                <span className="sm:hidden">Call</span>
              </a>
            )}
          </div>
        </div>
      </header>
    </>
  )
}