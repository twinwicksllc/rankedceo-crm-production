// =============================================================================
// WaaS Phase 4: _sites/[site]/layout.tsx
// Master tenant site layout — injects theme, header, footer
// One layout to rule them all (DRY — no duplication across templates)
// =============================================================================

import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import { createClient }  from '@supabase/supabase-js'
import { ThemeProvider } from '@/components/waas/ThemeProvider'
import { SiteHeader }    from '@/components/waas/SiteHeader'
import { SiteFooter }    from '@/components/waas/SiteFooter'
import type { ResolvedTenant, BrandConfig, TenantSiteConfig } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Fetch tenant by slug (used for layout-level data)
// ---------------------------------------------------------------------------

async function getTenantBySlug(slug: string): Promise<{
  tenant: ResolvedTenant
  siteConfig: TenantSiteConfig | null
} | null> {
  const client = createClient(
    process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL!,
    process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY!
  )

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siteConfigRow } = await (client as any)
    .from('tenant_site_config')
    .select('*')
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

  return { tenant, siteConfig: siteConfigRow as TenantSiteConfig | null }
}

// ---------------------------------------------------------------------------
// Generate metadata for SEO
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: { site: string }
}): Promise<Metadata> {
  const result = await getTenantBySlug(params.site)
  if (!result) return { title: 'Not Found' }

  const { tenant, siteConfig } = result
  const brandConfig  = tenant.brand_config
  const businessName = brandConfig.business_name ?? tenant.legal_name ?? 'Local Business'
  const title        = siteConfig?.meta_title       ?? businessName
  const description  = siteConfig?.meta_description ?? tenant.usp ?? brandConfig.tagline
    ?? `${businessName} — Professional services in ${tenant.target_location ?? 'your area'}`
  const ogImage      = siteConfig?.og_image_url ?? brandConfig.logo_url

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params:   { site: string }
}) {
  const result = await getTenantBySlug(params.site)
  if (!result) notFound()

  const { tenant, siteConfig } = result

  return (
    <div
      className="min-h-screen flex flex-col font-brand-body"
      style={{ backgroundColor: 'var(--brand-background)', color: 'var(--brand-text)' }}
    >
      {/* Inject CSS variables + custom tenant CSS into <head> */}
      <ThemeProvider
        brandConfig={tenant.brand_config}
        customCss={siteConfig?.custom_css}
      />

      {/* Master header — shared across all templates */}
      <SiteHeader tenant={tenant} />

      {/* Page content (rendered by page.tsx) */}
      <div className="flex-1">
        {children}
      </div>

      {/* Master footer — shared across all templates */}
      <SiteFooter tenant={tenant} />
    </div>
  )
}