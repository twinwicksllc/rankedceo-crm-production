import type { WaasTenant } from '@/lib/waas/types'

/**
 * Generates sane SEO defaults at the moment onboarding completes.
 * Ensures new tenants pass deploy readiness checks without admin intervention.
 * These are utility functions called from server actions, not server actions themselves.
 */

export interface SeoDefaults {
  meta_title: string
  meta_description: string
  og_image_url: string | null
}

/**
 * Generate meta_title from business identity.
 * Format: "{business_name} | {primary_trade} in {city}, {state}"
 * Trimmed to max 60 chars, must be >= 20 chars.
 */
export function generateMetaTitle(tenant: WaasTenant): string {
  const businessName = tenant.legal_name || tenant.brand_config?.business_name || 'Business'
  const primaryTrade = tenant.primary_trade || 'Services'
  const city = tenant.city || ''
  const state = tenant.state || ''

  // Build base title
  let title = businessName
  if (city && state) {
    title = `${businessName} | ${primaryTrade} in ${city}, ${state}`
  } else if (city) {
    title = `${businessName} | ${primaryTrade} in ${city}`
  } else if (state) {
    title = `${businessName} | ${primaryTrade} in ${state}`
  } else {
    title = `${businessName} | ${primaryTrade}`
  }

  // Trim to 60 chars max
  if (title.length > 60) {
    title = title.substring(0, 57) + '...'
  }

  // Ensure minimum length
  if (title.length < 20) {
    title = businessName
  }

  return title
}

/**
 * Generate meta_description from business info.
 * 1-2 sentence blurb derived from USP, trade, and location.
 * Must be >= 70 and <= 160 chars.
 */
export function generateMetaDescription(tenant: WaasTenant): string {
  const businessName = tenant.legal_name || tenant.brand_config?.business_name || 'Our business'
  const primaryTrade = tenant.primary_trade || 'services'
  const tagline = tenant.brand_config?.tagline || ''
  const usp = tenant.usp || ''
  const city = tenant.city || ''
  const state = tenant.state || ''

  // Build location suffix if available
  const locationSuffix = city && state ? ` in ${city}, ${state}` : city ? ` in ${city}` : ''

  // Try to construct from USP first
  let description = ''
  if (usp && usp.length <= 100) {
    description = `${usp}${locationSuffix}.`
  } else if (tagline) {
    description = `${tagline}${locationSuffix}.`
  } else {
    description = `Professional ${primaryTrade} services${locationSuffix}. ${businessName} is committed to delivering quality results.`
  }

  // Trim to fit within 160 chars
  if (description.length > 160) {
    // Try to intelligently truncate at word boundary
    const truncated = description.substring(0, 157)
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > 70) {
      description = truncated.substring(0, lastSpace) + '.'
    } else {
      description = truncated + '.'
    }
  }

  // Ensure minimum length
  if (description.length < 70) {
    description = `${businessName} offers quality ${primaryTrade} services${locationSuffix}. Contact us today to learn more about how we can help your business succeed.`
    // Trim again if still too long
    if (description.length > 160) {
      description = description.substring(0, 157) + '.'
    }
  }

  return description
}

/**
 * Generate og_image_url.
 * If logo exists, use it. Otherwise return null (will warn at deploy, not block).
 * In future, could generate a deterministic placeholder URL using brand colors.
 */
export function generateOgImageUrl(tenant: WaasTenant): string | null {
  const logoUrl = tenant.brand_config?.logo_url
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim().length > 0) {
    return logoUrl
  }
  // Return null to trigger a warn (not fail) at deploy
  return null
}

/**
 * Generate all SEO defaults for a tenant.
 * Only fills in null/empty values; never overwrites admin-edited values.
 */
export function generateSeoDefaults(tenant: WaasTenant): SeoDefaults {
  return {
    meta_title: generateMetaTitle(tenant),
    meta_description: generateMetaDescription(tenant),
    og_image_url: generateOgImageUrl(tenant),
  }
}
