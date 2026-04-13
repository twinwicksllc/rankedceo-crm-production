// =============================================================================
// WaaS Phase 4: SiteFooter
// Master footer shared across all tenant sites — DRY, SEO-friendly
// =============================================================================

import Link from 'next/link'
import type { ResolvedTenant } from '@/lib/waas/templates/types'

interface SiteFooterProps {
  tenant: ResolvedTenant
}

export function SiteFooter({ tenant }: SiteFooterProps) {
  const { brand_config } = tenant
  const businessName = brand_config.business_name ?? tenant.legal_name ?? 'Our Company'
  const contact      = brand_config.contact
  const social       = brand_config.social
  const currentYear  = new Date().getFullYear()

  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: 'var(--brand-text)',
        borderColor:     'var(--brand-accent)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <h2 className="font-brand-heading text-xl font-bold text-white mb-3">
              {businessName}
            </h2>
            {brand_config.tagline && (
              <p className="font-brand-body text-white/60 text-sm mb-4 max-w-xs">
                {brand_config.tagline}
              </p>
            )}
            {tenant.target_location && (
              <p className="font-brand-body text-white/50 text-xs">
                📍 Proudly serving {tenant.target_location}
              </p>
            )}

            {/* Social links */}
            {social && (
              <div className="flex gap-3 mt-4">
                {social.facebook && (
                  <a
                    href={social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    aria-label="Facebook"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
                {social.instagram && (
                  <a
                    href={social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    aria-label="Instagram"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                )}
                {social.google && (
                  <a
                    href={social.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    aria-label="Google Reviews"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-brand-heading font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {[
                { label: 'Services',   href: '#services' },
                { label: 'About Us',   href: '#trust' },
                { label: 'Reviews',    href: '#reviews' },
                { label: 'Book Now',   href: '#booking' },
                { label: 'Financing',  href: '#financing' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="font-brand-body text-sm text-white/60 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h3 className="font-brand-heading font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Contact
            </h3>
            <ul className="space-y-3 font-brand-body text-sm text-white/60">
              {contact?.phone && (
                <li>
                  <a
                    href={`tel:${contact.phone.replace(/\D/g, '')}`}
                    className="flex items-center gap-2 hover:text-white transition-colors"
                  >
                    <span aria-hidden="true">📞</span>
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact?.email && (
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 hover:text-white transition-colors"
                  >
                    <span aria-hidden="true">✉️</span>
                    {contact.email}
                  </a>
                </li>
              )}
              {(contact?.city || contact?.state) && (
                <li className="flex items-center gap-2">
                  <span aria-hidden="true">📍</span>
                  {[contact.address, contact.city, contact.state, contact.zip]
                    .filter(Boolean)
                    .join(', ')}
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-brand-body text-xs text-white/40">
            © {currentYear} {businessName}. All rights reserved.
          </p>
          <p className="font-brand-body text-xs text-white/30">
            Powered by{' '}
            <Link
              href="https://advantagepoint.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/50 transition-colors"
            >
              AdvantagePoint
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}