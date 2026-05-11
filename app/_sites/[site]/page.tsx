// =============================================================================
// WaaS Phase 4: _sites/[site]/page.tsx
// Multi-tenant renderer — fetches tenant config, resolves sections, renders site
//
// Phase 8.5: Added generateMetadata() for per-tenant SEO (title, description,
//            OG tags, canonical URL, favicon, structured data)
// =============================================================================

import type { Metadata }   from 'next'
import { notFound }         from 'next/navigation'
import { createClient }     from '@supabase/supabase-js'
import { SectionRenderer }  from '@/components/waas/SectionRenderer'
import { getTemplate, resolveSections } from '@/lib/waas/templates/registry'
import type { ResolvedTenant, BrandConfig, TenantSiteConfig, SectionConfig } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getTenantPage(slug: string): Promise<{
  tenant:     ResolvedTenant
  sections:   SectionConfig[]
  siteConfig: TenantSiteConfig | null
} | null> {
  const client = createClient(
    process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL!,
    process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow, error } = await (client as any)
    .from('tenants')
    .select(`
      id, slug, subdomain, domain, brand_config, package_tier, status,
      target_industry, target_location, legal_name, primary_trade,
      usp, calendly_url, financing_enabled, source_audit_id
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (error || !tenantRow) return null

  // Fetch site config (template + section overrides)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siteConfigRow } = await (client as any)
    .from('tenant_site_config')
    .select('*, site_templates(slug)')
    .eq('tenant_id', tenantRow.id)
    .single()

  const row = tenantRow as Record<string, unknown>

  const tenant: ResolvedTenant = {
    id:                row.id                as string,
    slug:              row.slug              as string,
    subdomain:         row.subdomain         as string,
    domain:            row.domain            as string | null,
    brand_config:      row.brand_config      as BrandConfig,
    package_tier:      row.package_tier      as string,
    status:            row.status            as string,
    target_industry:   row.target_industry   as string | null,
    target_location:   row.target_location   as string | null,
    legal_name:        row.legal_name        as string | null,
    primary_trade:     row.primary_trade     as string | null,
    usp:               row.usp               as string | null,
    calendly_url:      row.calendly_url      as string | null,
    financing_enabled: (row.financing_enabled as boolean) ?? false,
    source_audit_id:   row.source_audit_id   as string | null,
  }

  // Resolve which template to use
  const configRow = siteConfigRow as (TenantSiteConfig & { site_templates?: { slug: string } }) | null
  const templateSlug = configRow?.site_templates?.slug ?? 'modern'
  const template = getTemplate(templateSlug)

  // Merge tenant section overrides onto template defaults
  const tenantOverrides: SectionConfig[] = configRow?.active_sections_json ?? []
  const sections = resolveSections(template.default_layout_json, tenantOverrides)

  return { tenant, sections, siteConfig: configRow }
}

// ---------------------------------------------------------------------------
// SEO helpers
// ---------------------------------------------------------------------------

function buildCanonicalUrl(tenant: ResolvedTenant): string {
  if (tenant.domain) {
    return `https://${tenant.domain}`
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rankedceo.com'
  return `${appUrl}/sites/${tenant.slug}`
}

function buildMetaDescription(tenant: ResolvedTenant): string {
  const brand   = tenant.brand_config as BrandConfig & { tagline?: string }
  const name    = brand.business_name ?? tenant.slug
  const trade   = tenant.primary_trade ?? tenant.target_industry ?? 'local service'
  const loc     = tenant.target_location ?? ''
  const tagline = brand.tagline ?? tenant.usp ?? null

  if (tagline) return `${name} — ${tagline}`

  const tradeLabel = trade.charAt(0).toUpperCase() + trade.slice(1).toLowerCase()
  const locSuffix  = loc ? ` in ${loc}` : ''
  return `${name} — Professional ${tradeLabel} services${locSuffix}. Book online today.`
}

function buildStructuredData(tenant: ResolvedTenant, canonicalUrl: string): object {
  const brand   = tenant.brand_config as BrandConfig & {
    contact?: { phone?: string; email?: string; address?: string; city?: string; state?: string; zip?: string }
    social?:  { google?: string }
    logo_url?: string
  }
  const name    = brand.business_name ?? tenant.slug
  const contact = brand.contact ?? {}

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type':    'LocalBusiness',
    name,
    url:        canonicalUrl,
  }

  if (brand.logo_url)    schema.logo        = brand.logo_url
  if (contact.phone)     schema.telephone   = contact.phone
  if (contact.email)     schema.email       = contact.email
  if (contact.address)   schema.address     = {
    '@type':          'PostalAddress',
    streetAddress:    contact.address,
    addressLocality:  contact.city    ?? undefined,
    addressRegion:    contact.state   ?? undefined,
    postalCode:       contact.zip     ?? undefined,
    addressCountry:   'US',
  }
  if (brand.social?.google) schema.sameAs = [brand.social.google]

  return schema
}

// ---------------------------------------------------------------------------
// generateMetadata — per-tenant dynamic SEO (Phase 8.5)
// ---------------------------------------------------------------------------

export async function generateMetadata(
  { params }: { params: { site: string } },
): Promise<Metadata> {
  const result = await getTenantPage(params.site)

  if (!result) {
    return {
      title:       'Not Found',
      description: 'This page could not be found.',
    }
  }

  const { tenant } = result
  const brand       = tenant.brand_config as BrandConfig & { tagline?: string; logo_url?: string; favicon_url?: string; hero_image_url?: string }
  const name        = brand.business_name ?? tenant.slug
  const description = buildMetaDescription(tenant)
  const canonical   = buildCanonicalUrl(tenant)

  // OG image — use hero image if available, fallback to logo, then default
  const ogImage = brand.hero_image_url ?? brand.logo_url ?? null

  return {
    title:       name,
    description,
    metadataBase: new URL(canonical),
    alternates: {
      canonical: '/',
    },
    icons: brand.favicon_url
      ? { icon: brand.favicon_url, shortcut: brand.favicon_url }
      : undefined,
    openGraph: {
      type:        'website',
      url:         canonical,
      title:       name,
      description,
      siteName:    name,
      ...(ogImage ? {
        images: [{ url: ogImage, width: 1200, height: 630, alt: name }],
      } : {}),
    },
    twitter: {
      card:        'summary_large_image',
      title:       name,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: {
      index:   true,
      follow:  true,
      googleBot: { index: true, follow: true },
    },
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function SitePage({ params }: { params: { site: string } }) {
  const result = await getTenantPage(params.site)
  if (!result) notFound()

  const { tenant, sections, siteConfig } = result
  const canonical  = buildCanonicalUrl(tenant)
  const structuredData = buildStructuredData(tenant, canonical)

  return (
    <>
      {/* JSON-LD structured data for local business */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SectionRenderer
        tenant={tenant}
        sections={sections}
        siteConfig={siteConfig}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// ISR: Revalidate every 60 seconds so brand config changes propagate quickly
// ---------------------------------------------------------------------------

export const revalidate = 60
