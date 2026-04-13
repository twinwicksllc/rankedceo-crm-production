// =============================================================================
// WaaS Phase 4: FinancingBlock
// Conditional rendering for Optimus/Pricebook financing links
// Only renders if tenant.financing_enabled === true
// =============================================================================

import type { ResolvedTenant, SectionConfig } from '@/lib/waas/templates/types'

interface FinancingBlockProps {
  tenant: ResolvedTenant
  config: SectionConfig['config']
}

export function FinancingBlock({ tenant, config }: FinancingBlockProps) {
  // Don't render if financing not enabled for this tenant
  if (!tenant.financing_enabled) return null

  const businessName = tenant.brand_config.business_name ?? tenant.legal_name ?? 'We'
  const optimusUrl   = (config.optimus_url as string) ?? '#'
  const pricebookUrl = (config.pricebook_url as string) ?? '#'

  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: 'var(--brand-background)' }}
      aria-label="Financing options"
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
            Financing Available
          </span>
          <h2
            className="font-brand-heading text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: 'var(--brand-text)' }}
          >
            Don't Let Budget Stop You
          </h2>
          <p
            className="font-brand-body text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--brand-text)', opacity: 0.65 }}
          >
            {businessName} offers flexible financing options so you can get the
            services you need today and pay over time.
          </p>
        </div>

        {/* Financing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Optimus Financing */}
          <div
            className="relative overflow-hidden rounded-2xl p-8 border-2"
            style={{
              borderColor:     'var(--brand-primary)',
              backgroundColor: 'var(--brand-background)',
            }}
          >
            {/* Popular badge */}
            <div
              className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              POPULAR
            </div>

            <div className="text-4xl mb-4" aria-hidden="true">💳</div>
            <h3
              className="font-brand-heading text-2xl font-bold mb-3"
              style={{ color: 'var(--brand-text)' }}
            >
              Optimus Financing
            </h3>
            <ul
              className="font-brand-body text-sm space-y-2 mb-6"
              style={{ color: 'var(--brand-text)', opacity: 0.7 }}
            >
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> 0% APR promotional periods
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Fast approval decisions
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> No prepayment penalties
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Flexible monthly payments
              </li>
            </ul>
            <a
              href={optimusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              Apply for Optimus Financing →
            </a>
          </div>

          {/* Pricebook / Service Financing */}
          <div
            className="relative overflow-hidden rounded-2xl p-8 border-2"
            style={{
              borderColor:     'var(--brand-accent)',
              backgroundColor: 'var(--brand-accent)',
            }}
          >
            <div className="text-4xl mb-4" aria-hidden="true">📋</div>
            <h3
              className="font-brand-heading text-2xl font-bold mb-3"
              style={{ color: 'var(--brand-text)' }}
            >
              View Our Pricebook
            </h3>
            <ul
              className="font-brand-body text-sm space-y-2 mb-6"
              style={{ color: 'var(--brand-text)', opacity: 0.7 }}
            >
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Transparent, flat-rate pricing
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> No surprise charges
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Know your cost upfront
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Price-match guarantee
              </li>
            </ul>
            <a
              href={pricebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl font-semibold border-2 transition-opacity hover:opacity-90"
              style={{
                borderColor: 'var(--brand-primary)',
                color:        'var(--brand-primary)',
              }}
            >
              View Our Pricebook →
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <p
          className="text-center text-xs mt-8 font-brand-body"
          style={{ color: 'var(--brand-text)', opacity: 0.4 }}
        >
          Subject to credit approval. Terms and conditions apply.
          Contact us for full financing details.
        </p>
      </div>
    </section>
  )
}