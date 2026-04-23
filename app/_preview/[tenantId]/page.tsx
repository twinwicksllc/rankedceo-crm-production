import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { SectionRenderer } from '@/components/waas/SectionRenderer'
import { getTemplate, resolveSections } from '@/lib/waas/templates/registry'
import type { ResolvedTenant, BrandConfig, TenantSiteConfig, SectionConfig } from '@/lib/waas/templates/types'

async function getPreviewPage(tenantId: string, templateSlug?: string): Promise<{
  tenant: ResolvedTenant
  sections: SectionConfig[]
  siteConfig: TenantSiteConfig | null
} | null> {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const client = createClient(url, key)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow, error } = await (client as any)
    .from('tenants')
    .select(`
      id, slug, subdomain, domain, brand_config, package_tier, status,
      target_industry, target_location, legal_name, primary_trade,
      usp, calendly_url, financing_enabled, source_audit_id
    `)
    .eq('id', tenantId)
    .single()

  if (error || !tenantRow) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siteConfigRow } = await (client as any)
    .from('tenant_site_config')
    .select('*, site_templates(slug)')
    .eq('tenant_id', tenantRow.id)
    .single()

  const row = tenantRow as Record<string, unknown>

  const tenant: ResolvedTenant = {
    id: row.id as string,
    slug: row.slug as string,
    subdomain: row.subdomain as string,
    domain: row.domain as string | null,
    brand_config: row.brand_config as BrandConfig,
    package_tier: row.package_tier as string,
    status: row.status as string,
    target_industry: row.target_industry as string | null,
    target_location: row.target_location as string | null,
    legal_name: row.legal_name as string | null,
    primary_trade: row.primary_trade as string | null,
    usp: row.usp as string | null,
    calendly_url: row.calendly_url as string | null,
    financing_enabled: (row.financing_enabled as boolean) ?? false,
    source_audit_id: row.source_audit_id as string | null,
  }

  const configRow = siteConfigRow as (TenantSiteConfig & { site_templates?: { slug: string } }) | null
  const resolvedTemplateSlug = templateSlug?.trim() || configRow?.site_templates?.slug || 'modern'
  const template = getTemplate(resolvedTemplateSlug)

  const tenantOverrides: SectionConfig[] = configRow?.active_sections_json ?? []
  const sections = resolveSections(template.default_layout_json, tenantOverrides)

  return { tenant, sections, siteConfig: configRow }
}

export default async function PreviewTenantPage({
  params,
  searchParams,
}: {
  params: { tenantId: string }
  searchParams?: { template?: string }
}) {
  const result = await getPreviewPage(params.tenantId, searchParams?.template)
  if (!result) notFound()

  return (
    <SectionRenderer
      tenant={result.tenant}
      sections={result.sections}
      siteConfig={result.siteConfig}
    />
  )
}

export const revalidate = 30
