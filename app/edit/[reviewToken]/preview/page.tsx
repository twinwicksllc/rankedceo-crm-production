// =============================================================================
// app/edit/[reviewToken]/preview/page.tsx
// Preview renderer for the client editor iframe.
// Resolves the review token, loads the selected variant, renders the site.
// =============================================================================

import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { SectionRenderer } from "@/components/waas/SectionRenderer";
import { getTemplate, resolveSections } from "@/lib/waas/templates/registry";
import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import type {
  ResolvedTenant,
  BrandConfig,
  TenantSiteConfig,
  SectionConfig,
} from "@/lib/waas/templates/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PreviewProps {
  params: Promise<{ reviewToken: string }>;
}

// ---------------------------------------------------------------------------
// Fetch tenant row + site config + variant sections (if any).
// All reads use service-role key; we only return data after the review token
// validates in resolveClientEditSession.
// ---------------------------------------------------------------------------

async function loadPreviewData(session: {
  tenantId: string;
  selectedVariantIndex: number | null;
  selectedTemplateSlug: string | null;
}): Promise<{
  tenant: ResolvedTenant;
  sections: SectionConfig[];
  siteConfig: TenantSiteConfig | null;
} | null> {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (supabase as any)
    .from("tenants")
    .select(
      `
      id, slug, subdomain, domain, brand_config, package_tier, status,
      target_industry, target_location, legal_name, primary_trade,
      usp, calendly_url, financing_enabled, source_audit_id
    `,
    )
    .eq("id", session.tenantId)
    .single();

  if (!tenantRow) return null;

  const row = tenantRow as Record<string, unknown>;

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
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siteConfigRow } = await (supabase as any)
    .from("tenant_site_config")
    .select("*, site_templates(slug)")
    .eq("tenant_id", session.tenantId)
    .single();

  const configRow = siteConfigRow as
    (TenantSiteConfig & { site_templates?: { slug: string } }) | null;

  const templateSlug =
    session.selectedTemplateSlug ?? configRow?.site_templates?.slug ?? "modern";
  const template = getTemplate(templateSlug);

  // Prefer the selected variant's sections_json; fall back to tenant's
  // active_sections_json → template default layout.
  let sections: SectionConfig[] | null = null;

  if (session.selectedVariantIndex != null) {
    const { data: variantRow } = await supabase
      .from("tenant_site_variants")
      .select("sections_json")
      .eq("tenant_id", session.tenantId)
      .eq("variant_index", session.selectedVariantIndex)
      .single();

    const variantSections = (variantRow as { sections_json?: unknown } | null)
      ?.sections_json;
    if (Array.isArray(variantSections) && variantSections.length > 0) {
      sections = variantSections as SectionConfig[];
    }
  }

  if (!sections) {
    const tenantOverrides: SectionConfig[] =
      configRow?.active_sections_json ?? [];
    sections = resolveSections(template.default_layout_json, tenantOverrides);
  }

  return { tenant, sections, siteConfig: configRow };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ClientEditorPreviewPage({
  params,
}: PreviewProps) {
  const { reviewToken } = await params;
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) notFound();

  const data = await loadPreviewData({
    tenantId: sessionResult.session.tenantId,
    selectedVariantIndex: sessionResult.session.selectedVariantIndex,
    selectedTemplateSlug: sessionResult.session.selectedTemplateSlug,
  });
  if (!data) notFound();

  return (
    <SectionRenderer
      tenant={data.tenant}
      sections={data.sections}
      siteConfig={data.siteConfig}
    />
  );
}
