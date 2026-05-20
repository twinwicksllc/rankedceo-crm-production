import { getContentPack } from '@/lib/waas/content-packs'
import type { WaasTenant } from '@/lib/waas/types'
import type { GenerationProfile } from './types'
import { asRecord, extractList } from './_shared'

// ---------------------------------------------------------------------------
// Build generation profile from WaasTenant
// ---------------------------------------------------------------------------

export function buildProfile(tenant: WaasTenant): GenerationProfile {
  const brand   = asRecord(tenant.brand_config)
  const content = asRecord(brand.content)
  const seo     = asRecord(brand.seo)
  const intake  = asRecord(brand.intake_profile)

  const businessName =
    typeof brand.business_name === 'string' && brand.business_name.trim()
      ? brand.business_name.trim()
      : (tenant.legal_name ?? 'Your Business')

  const trade = tenant.primary_trade ?? tenant.target_industry ?? 'Local service'

  // ── Industry content pack ────────────────────────────────────────────────
  // Provides trade-specific fallbacks for services, keywords, and trust
  // signals when the tenant's own intake profile is sparse.
  const pack = getContentPack(trade)

  // Services: intake data wins; pack defaults fill the gap
  const intakeServices = extractList(intake.services_offered)
  const services =
    intakeServices.length > 0
      ? intakeServices
      : pack.defaultServices.slice(0, 6).map((s) => s.title)

  // SEO key phrases: merge tenant phrases with pack terms (deduplicated)
  const intakeKeyPhrases = extractList(seo.key_phrases)
  const packKeyPhrases   = [...pack.seoKeywords.headTerms, ...pack.seoKeywords.midTail.slice(0, 3)]
  const keyPhrases =
    intakeKeyPhrases.length > 0
      ? [
          ...intakeKeyPhrases,
          ...packKeyPhrases.filter((kw) => !intakeKeyPhrases.includes(kw)),
        ].slice(0, 12)
      : packKeyPhrases.slice(0, 8)

  return {
    businessName,
    trade,
    industry:          tenant.target_industry ?? trade,
    location:          tenant.target_location
      ?? ([tenant.city, tenant.state].filter(Boolean).join(', ') || 'your local area'),
    usp:               typeof tenant.usp === 'string' && tenant.usp.trim()
      ? tenant.usp.trim()
      : (typeof content.usp === 'string' && content.usp.trim()
        ? content.usp.trim()
        : 'Trusted local service with fast response'),
    tagline:           typeof brand.tagline === 'string' && brand.tagline.trim()
      ? brand.tagline.trim()
      : '',
    primaryCta:        typeof content.primary_cta === 'string' && content.primary_cta.trim()
      ? content.primary_cta.trim()
      : 'Book a Free Estimate',
    aboutNarrative:    typeof content.about_narrative === 'string' && content.about_narrative.trim()
      ? content.about_narrative.trim()
      : `${businessName} serves clients in ${tenant.target_location ?? 'the local area'} with reliable ${trade.toLowerCase()} services.`,
    valuePropositions: extractList(content.value_propositions),
    keyPhrases,
    targetAudience:    typeof intake.target_audience === 'string'
      ? intake.target_audience
      : 'Homeowners and local businesses',
    tone:              typeof brand.tone === 'string' && brand.tone.trim()
      ? brand.tone.trim()
      : 'Professional',
    serviceArea:       typeof seo.service_area === 'string' && seo.service_area.trim()
      ? seo.service_area.trim()
      : (tenant.target_location ?? 'Local area'),
    services,
    tradeDisplayName:  pack.displayName,
    trustSignals:      pack.trustSignals,
  }
}
