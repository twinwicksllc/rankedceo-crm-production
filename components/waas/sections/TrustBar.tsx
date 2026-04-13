// =============================================================================
// WaaS Phase 4: TrustBar
// Displays SEO gap score / competition badge from audit data
// Supports 'badge-row' and 'full-width' variants
// =============================================================================

import type { ResolvedTenant, SectionConfig } from '@/lib/waas/templates/types'

interface TrustBarProps {
  tenant:     ResolvedTenant
  config:     SectionConfig['config']
  auditData?: AuditSummary | null
}

interface AuditSummary {
  overall_score:       number
  performance_score:   number
  seo_score:           number
  mobile_score:        number
}

// Default trust badges when no audit data available
const DEFAULT_BADGES = [
  { icon: '🛡️', label: 'Licensed & Insured',    sub: 'Fully certified professionals' },
  { icon: '⭐', label: '5-Star Rated',           sub: 'Hundreds of happy customers' },
  { icon: '⏱️', label: 'Same-Day Service',       sub: 'Fast response times' },
  { icon: '💰', label: 'Upfront Pricing',        sub: 'No hidden fees, ever' },
  { icon: '🏆', label: 'Award-Winning',          sub: 'Best in the area' },
  { icon: '🔒', label: 'Satisfaction Guarantee', sub: '100% satisfaction or we fix it' },
]

export function TrustBar({ tenant, config, auditData }: TrustBarProps) {
  const variant      = (config.variant as string) ?? 'badge-row'
  const businessName = tenant.brand_config.business_name ?? tenant.legal_name ?? 'We'
  const location     = tenant.target_location ?? 'the area'

  if (variant === 'full-width') {
    return (
      <section
        className="py-20 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: 'var(--brand-primary)' }}
        aria-label="Why choose us"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-brand-heading text-3xl sm:text-4xl font-bold text-white mb-4">
              Why {location} Trusts {businessName}
            </h2>
            {auditData && (
              <p className="text-white/70 text-lg max-w-2xl mx-auto">
                Our SEO score of <strong className="text-white">{auditData.overall_score}/100</strong> means
                customers find us first — and our reviews keep them coming back.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEFAULT_BADGES.map(({ icon, label, sub }) => (
              <div
                key={label}
                className="flex items-start gap-4 p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20"
              >
                <span className="text-3xl flex-shrink-0" aria-hidden="true">{icon}</span>
                <div>
                  <h3 className="font-brand-heading font-bold text-white text-lg">{label}</h3>
                  <p className="font-brand-body text-white/70 text-sm mt-1">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Audit score strip */}
          {auditData && (
            <div className="mt-12 pt-12 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { label: 'Overall Score',     value: auditData.overall_score },
                { label: 'SEO Score',         value: auditData.seo_score },
                { label: 'Performance',       value: auditData.performance_score },
                { label: 'Mobile Score',      value: auditData.mobile_score },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-4xl font-bold text-white font-brand-heading">
                    {value}
                    <span className="text-2xl text-white/60">/100</span>
                  </div>
                  <div className="text-white/60 text-sm mt-1 font-brand-body">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    )
  }

  // Default: badge-row variant
  return (
    <section
      className="py-12 px-4 sm:px-6 lg:px-8 border-y"
      style={{
        backgroundColor: 'var(--brand-accent)',
        borderColor:     'var(--brand-accent)',
      }}
      aria-label="Trust signals"
    >
      <div className="max-w-7xl mx-auto">
        {/* Scrollable badge row */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {DEFAULT_BADGES.map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold whitespace-nowrap bg-white shadow-sm"
              style={{ color: 'var(--brand-primary)' }}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Audit-sourced competition badge */}
        {auditData && (
          <div className="mt-8 text-center">
            <div
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white shadow-md"
              style={{ color: 'var(--brand-text)' }}
            >
              <span className="text-2xl" aria-hidden="true">📈</span>
              <div className="text-left">
                <div
                  className="font-brand-heading font-bold text-base"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  Better Than the Competition
                </div>
                <div className="font-brand-body text-sm opacity-70">
                  SEO Score: {auditData.overall_score}/100 — Outranking local competitors
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}