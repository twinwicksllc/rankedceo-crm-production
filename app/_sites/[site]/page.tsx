// =============================================================================
// WaaS Tenant Home Page
// Renders the home page for a WaaS tenant site.
// Brand config is passed from the layout via headers (injected by middleware).
// This is a placeholder — Phase 2 will add the full page builder / templates.
// =============================================================================

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { WAAS_HEADERS, type WaasBrandConfig, DEFAULT_BRAND_CONFIG } from '@/lib/waas/types'

interface WaasTenantPageProps {
  params: { site: string }
}

export default function WaasTenantHomePage({ params }: WaasTenantPageProps) {
  const headersList = headers()

  const tenantId   = headersList.get(WAAS_HEADERS.TENANT_ID)
  const brandRaw   = headersList.get(WAAS_HEADERS.BRAND_CONFIG)
  const industry   = headersList.get(WAAS_HEADERS.INDUSTRY) ?? ''
  const location   = headersList.get(WAAS_HEADERS.LOCATION) ?? ''

  if (!tenantId) notFound()

  let brand: WaasBrandConfig = DEFAULT_BRAND_CONFIG
  if (brandRaw) {
    try { brand = JSON.parse(brandRaw) } catch { /* use default */ }
  }

  const colors = { ...DEFAULT_BRAND_CONFIG.colors, ...brand.colors }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      {/* ── Hero ── */}
      <section style={{
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
        color:      '#fff',
        padding:    '80px 24px',
        textAlign:  'center',
      }}>
        {brand.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logo_url}
            alt={brand.business_name}
            style={{ height: 64, marginBottom: 24, objectFit: 'contain' }}
          />
        )}
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, margin: '0 0 16px' }}>
          {brand.business_name}
        </h1>
        {brand.tagline && (
          <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', opacity: 0.9, maxWidth: 600, margin: '0 auto 32px' }}>
            {brand.tagline}
          </p>
        )}
        {brand.contact?.phone && (
          <a
            href={`tel:${brand.contact.phone}`}
            style={{
              display:         'inline-block',
              background:      '#fff',
              color:           colors.primary,
              fontWeight:      700,
              padding:         '14px 32px',
              borderRadius:    8,
              textDecoration:  'none',
              fontSize:        '1.1rem',
            }}
          >
            📞 {brand.contact.phone}
          </a>
        )}
      </section>

      {/* ── Info Bar ── */}
      {(industry || location) && (
        <section style={{
          background: colors.accent,
          padding:    '16px 24px',
          textAlign:  'center',
          fontSize:   '0.9rem',
          color:      colors.text,
        }}>
          {industry && <span style={{ marginRight: 16 }}>🏢 {industry.charAt(0).toUpperCase() + industry.slice(1)}</span>}
          {location && <span>📍 {location}</span>}
        </section>
      )}

      {/* ── Placeholder Notice (remove in Phase 2) ── */}
      <section style={{ padding: '60px 24px', textAlign: 'center', color: '#6B7280' }}>
        <div style={{
          display:      'inline-block',
          border:       '2px dashed #E5E7EB',
          borderRadius: 12,
          padding:      '40px 48px',
          maxWidth:     480,
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚧</div>
          <h2 style={{ color: '#374151', marginBottom: 8 }}>Site Under Construction</h2>
          <p style={{ margin: '0 0 8px' }}>
            Tenant: <strong>{params.site}</strong>
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Full page builder coming in Phase 2.
          </p>
        </div>
      </section>

      {/* ── Contact Footer ── */}
      {brand.contact && (
        <footer style={{
          background:   '#F9FAFB',
          borderTop:    '1px solid #E5E7EB',
          padding:      '32px 24px',
          textAlign:    'center',
          fontSize:     '0.9rem',
          color:        '#6B7280',
        }}>
          {brand.contact.phone   && <span style={{ marginRight: 16 }}>📞 {brand.contact.phone}</span>}
          {brand.contact.email   && <span style={{ marginRight: 16 }}>✉️ {brand.contact.email}</span>}
          {brand.contact.city    && brand.contact.state && (
            <span>📍 {brand.contact.city}, {brand.contact.state}</span>
          )}
        </footer>
      )}
    </main>
  )
}