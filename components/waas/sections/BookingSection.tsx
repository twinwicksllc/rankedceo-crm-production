// =============================================================================
// WaaS Phase 4: BookingSection
// Embeds the Calendly widget for appointment booking
// Supports 'inline' and 'modal-trigger' variants
// =============================================================================

'use client'

import { useEffect, useRef } from 'react'
import type { ResolvedTenant, SectionConfig } from '@/lib/waas/templates/types'

interface BookingSectionProps {
  tenant: ResolvedTenant
  config: SectionConfig['config']
}

// Inline Calendly embed (client component)
function CalendlyInline({ url, primaryColor }: { url: string; primaryColor: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load Calendly widget script
    const script = document.createElement('script')
    script.src   = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    document.head.appendChild(script)

    return () => {
      // Cleanup script on unmount
      const existing = document.querySelector('script[src*="calendly"]')
      if (existing) existing.remove()
    }
  }, [])

  const cleanColor = primaryColor.replace('#', '')

  return (
    <div
      ref={ref}
      className="calendly-inline-widget w-full rounded-2xl overflow-hidden"
      data-url={`${url}?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=${cleanColor}`}
      style={{ minWidth: '320px', height: '700px' }}
    />
  )
}

export function BookingSection({ tenant, config }: BookingSectionProps) {
  const variant      = (config.variant as string) ?? 'inline'
  const calendlyUrl  = tenant.calendly_url
  const businessName = tenant.brand_config.business_name ?? tenant.legal_name ?? 'Us'
  const primaryColor = tenant.brand_config.colors?.primary ?? '#2563EB'
  const phone        = tenant.brand_config.contact?.phone

  // Don't render if no Calendly URL configured
  if (!calendlyUrl) {
    // Fallback: simple contact section
    return (
      <section
        className="py-20 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: 'var(--brand-accent)' }}
        aria-label="Contact us"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="font-brand-heading text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: 'var(--brand-text)' }}
          >
            Ready to Get Started?
          </h2>
          <p
            className="font-brand-body text-lg mb-8"
            style={{ color: 'var(--brand-text)', opacity: 0.65 }}
          >
            Contact {businessName} today for a free estimate. We respond fast.
          </p>
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-3 px-8 py-4 text-xl font-bold rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              📞 Call Now: {phone}
            </a>
          )}
        </div>
      </section>
    )
  }

  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: 'var(--brand-background)' }}
      aria-label="Book an appointment"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span
            className="inline-block text-sm font-semibold uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full"
            style={{
              backgroundColor: 'var(--brand-accent)',
              color:           'var(--brand-primary)',
            }}
          >
            Book Online
          </span>
          <h2
            className="font-brand-heading text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: 'var(--brand-text)' }}
          >
            Schedule with {businessName}
          </h2>
          <p
            className="font-brand-body text-lg max-w-xl mx-auto"
            style={{ color: 'var(--brand-text)', opacity: 0.65 }}
          >
            Pick a time that works for you. We'll confirm within minutes.
          </p>
        </div>

        {/* Calendly embed */}
        {variant === 'inline' ? (
          <div
            className="rounded-2xl overflow-hidden shadow-xl border"
            style={{ borderColor: 'var(--brand-accent)' }}
          >
            <CalendlyInline url={calendlyUrl} primaryColor={primaryColor} />
          </div>
        ) : (
          // modal-trigger variant: button that opens Calendly popup
          <div className="text-center">
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-10 py-5 text-xl font-bold rounded-2xl text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              📅 Book a Free Estimate
            </a>
            <p
              className="mt-4 text-sm font-brand-body"
              style={{ color: 'var(--brand-text)', opacity: 0.5 }}
            >
              Usually responds within 1 hour
            </p>
          </div>
        )}
      </div>
    </section>
  )
}