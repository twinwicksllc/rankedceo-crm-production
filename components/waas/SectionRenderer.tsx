// =============================================================================
// WaaS Phase 4: SectionRenderer
// Dynamically loops through enabled sections and renders them in order
// =============================================================================

import type { ResolvedTenant, SectionConfig, TenantSiteConfig } from '@/lib/waas/templates/types'
import { HeroSection }       from '@/components/waas/sections/HeroSection'
import { ServiceGrid }       from '@/components/waas/sections/ServiceGrid'
import { TrustBar }          from '@/components/waas/sections/TrustBar'
import { FinancingBlock }    from '@/components/waas/sections/FinancingBlock'
import { BookingSection }    from '@/components/waas/sections/BookingSection'
import { ReviewNFCSection }  from '@/components/waas/sections/ReviewNFCSection'

interface SectionRendererProps {
  tenant:     ResolvedTenant
  sections:   SectionConfig[]
  siteConfig: TenantSiteConfig | null
}

// ---------------------------------------------------------------------------
// Render a single section by id
// ---------------------------------------------------------------------------

function renderSection(
  section: SectionConfig,
  tenant:  ResolvedTenant,
): React.ReactNode {
  const props = { tenant, config: section.config }

  switch (section.section) {
    case 'hero':
      return <HeroSection key="hero" {...props} />
    case 'services':
      return <ServiceGrid key="services" {...props} />
    case 'trust':
      return <TrustBar key="trust" {...props} />
    case 'financing':
      return <FinancingBlock key="financing" {...props} />
    case 'booking':
      return <BookingSection key="booking" {...props} />
    case 'reviews':
      return <ReviewNFCSection key="reviews" {...props} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// SectionRenderer — loops through sections, renders enabled ones in order
// ---------------------------------------------------------------------------

export function SectionRenderer({ tenant, sections, siteConfig }: SectionRendererProps) {
  const enabledSections = sections
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order)

  if (enabledSections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">No sections configured for this site.</p>
      </div>
    )
  }

  return (
    <main id="main-content">
      {enabledSections.map(section => renderSection(section, tenant))}

      {/* Custom CSS injection */}
      {siteConfig?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: siteConfig.custom_css }} />
      )}
    </main>
  )
}