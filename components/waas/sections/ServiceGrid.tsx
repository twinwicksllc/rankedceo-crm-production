// =============================================================================
// WaaS Phase 4: ServiceGrid
// Displays the primary trade services in a responsive grid
// =============================================================================

import type { ResolvedTenant, SectionConfig } from '@/lib/waas/templates/types'

interface ServiceGridProps {
  tenant: ResolvedTenant
  config: SectionConfig['config']
}

// Trade → services mapping
const TRADE_SERVICES: Record<string, { icon: string; label: string }[]> = {
  Plumbing: [
    { icon: '🚰', label: 'Drain Cleaning' },
    { icon: '🔧', label: 'Pipe Repair & Replacement' },
    { icon: '🚿', label: 'Water Heater Services' },
    { icon: '🏠', label: 'Fixture Installation' },
    { icon: '🚨', label: '24/7 Emergency Service' },
    { icon: '🔍', label: 'Leak Detection' },
  ],
  HVAC: [
    { icon: '❄️', label: 'AC Installation & Repair' },
    { icon: '🔥', label: 'Heating Services' },
    { icon: '🌬️', label: 'Air Quality & Filtration' },
    { icon: '🔧', label: 'Maintenance Plans' },
    { icon: '🌡️', label: 'Thermostat Upgrades' },
    { icon: '🚨', label: '24/7 Emergency Service' },
  ],
  Electrical: [
    { icon: '⚡', label: 'Panel Upgrades' },
    { icon: '💡', label: 'Lighting Installation' },
    { icon: '🔌', label: 'Outlet & Switch Repair' },
    { icon: '🏠', label: 'Whole-Home Rewiring' },
    { icon: '🔋', label: 'EV Charger Installation' },
    { icon: '🚨', label: '24/7 Emergency Service' },
  ],
  Roofing: [
    { icon: '🏠', label: 'Roof Replacement' },
    { icon: '🔧', label: 'Leak Repair' },
    { icon: '🌧️', label: 'Storm Damage Restoration' },
    { icon: '🔍', label: 'Roof Inspections' },
    { icon: '🪟', label: 'Gutters & Downspouts' },
    { icon: '📋', label: 'Insurance Claims Support' },
  ],
  Landscaping: [
    { icon: '🌿', label: 'Lawn Maintenance' },
    { icon: '🌳', label: 'Tree Trimming & Removal' },
    { icon: '💧', label: 'Irrigation Systems' },
    { icon: '🏡', label: 'Landscape Design' },
    { icon: '🍂', label: 'Seasonal Cleanup' },
    { icon: '🌱', label: 'Sod & Seeding' },
  ],
  Painting: [
    { icon: '🏠', label: 'Interior Painting' },
    { icon: '🎨', label: 'Exterior Painting' },
    { icon: '🪵', label: 'Cabinet Refinishing' },
    { icon: '✨', label: 'Deck Staining' },
    { icon: '🔧', label: 'Drywall Repair' },
    { icon: '🌟', label: 'Color Consultation' },
  ],
  'General Contracting': [
    { icon: '🏗️', label: 'Home Renovations' },
    { icon: '🏠', label: 'Room Additions' },
    { icon: '🚪', label: 'Door & Window Install' },
    { icon: '🪟', label: 'Remodeling' },
    { icon: '🔧', label: 'Repairs & Handyman' },
    { icon: '📋', label: 'Project Management' },
  ],
  Flooring: [
    { icon: '🪵', label: 'Hardwood Flooring' },
    { icon: '🏠', label: 'Tile & Stone' },
    { icon: '🌿', label: 'Luxury Vinyl Plank' },
    { icon: '✨', label: 'Carpet Installation' },
    { icon: '🔧', label: 'Floor Refinishing' },
    { icon: '📐', label: 'Free Estimates' },
  ],
  default: [
    { icon: '⭐', label: 'Quality Workmanship' },
    { icon: '⏱️', label: 'On-Time Service' },
    { icon: '💰', label: 'Upfront Pricing' },
    { icon: '🛡️', label: 'Licensed & Insured' },
    { icon: '📞', label: 'Free Estimates' },
    { icon: '🚨', label: '24/7 Availability' },
  ],
}

export function ServiceGrid({ tenant, config }: ServiceGridProps) {
  const columns  = (config.columns as number) ?? 3
  const showIcons = config.showIcons !== false
  const trade    = tenant.primary_trade ?? tenant.target_industry ?? 'default'
  const services = TRADE_SERVICES[trade] ?? TRADE_SERVICES.default
  const businessName = tenant.brand_config.business_name ?? tenant.legal_name ?? 'Our Team'

  const gridClass = columns === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: 'var(--brand-background)' }}
      aria-label="Services"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span
            className="inline-block text-sm font-semibold uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full"
            style={{
              backgroundColor: 'var(--brand-accent)',
              color:            'var(--brand-primary)',
            }}
          >
            Our Services
          </span>
          <h2
            className="font-brand-heading text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: 'var(--brand-text)' }}
          >
            What {businessName} Does Best
          </h2>
          <p
            className="font-brand-body text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--brand-text)', opacity: 0.65 }}
          >
            From routine maintenance to emergency calls, we handle it all with
            expert care and transparent pricing.
          </p>
        </div>

        {/* Service cards */}
        <div className={`grid ${gridClass} gap-6`}>
          {services.map(({ icon, label }) => (
            <div
              key={label}
              className="group flex items-start gap-4 p-6 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-lg"
              style={{
                borderColor:     'var(--brand-accent)',
                backgroundColor: 'var(--brand-background)',
              }}
            >
              {showIcons && (
                <span
                  className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: 'var(--brand-accent)' }}
                  aria-hidden="true"
                >
                  {icon}
                </span>
              )}
              <div>
                <h3
                  className="font-brand-heading font-semibold text-lg mb-1 group-hover:text-brand-primary transition-colors"
                  style={{ color: 'var(--brand-text)' }}
                >
                  {label}
                </h3>
                <p
                  className="font-brand-body text-sm"
                  style={{ color: 'var(--brand-text)', opacity: 0.6 }}
                >
                  Professional, reliable, and backed by our satisfaction guarantee.
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p
            className="font-brand-body text-base mb-4"
            style={{ color: 'var(--brand-text)', opacity: 0.6 }}
          >
            Don't see what you need? We offer more services than listed here.
          </p>
          {tenant.brand_config.contact?.phone && (
            <a
              href={`tel:${tenant.brand_config.contact.phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              📞 Call Us: {tenant.brand_config.contact.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}