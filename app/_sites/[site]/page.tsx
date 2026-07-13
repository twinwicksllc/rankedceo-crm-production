// =============================================================================
// WaaS Phase 4: _sites/[site]/page.tsx
// Multi-tenant renderer — fetches tenant config, resolves sections, renders site
//
// Phase 8.5: Added generateMetadata() for per-tenant SEO (title, description,
//            OG tags, canonical URL, favicon, structured data)
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { SectionRenderer } from "@/components/waas/SectionRenderer";
import { getTemplate, resolveSections } from "@/lib/waas/templates/registry";
import type {
  ResolvedTenant,
  BrandConfig,
  TenantSiteConfig,
  SectionConfig,
} from "@/lib/waas/templates/types";
import {
  buildLocalBusinessServiceJsonLdV2,
  type DayOfWeek,
} from "@/lib/waas/utils/local-business-schema-v2";
import { toSafeJsonLdString } from "@/lib/waas/utils/json-ld";

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getTenantPage(slug: string): Promise<{
  tenant: ResolvedTenant;
  sections: SectionConfig[];
  siteConfig: TenantSiteConfig | null;
} | null> {
  const client = createClient(
    process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL!,
    process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow, error } = await (client as any)
    .from("tenants")
    .select(
      `
      id, slug, subdomain, domain, brand_config, package_tier, status,
      target_industry, target_location, legal_name, primary_trade,
      usp, calendly_url, financing_enabled, source_audit_id
    `,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !tenantRow) return null;

  // Fetch site config (template + section overrides)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siteConfigRow } = await (client as any)
    .from("tenant_site_config")
    .select("*, site_templates(slug)")
    .eq("tenant_id", tenantRow.id)
    .single();

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

  // Resolve which template to use
  const configRow = siteConfigRow as
    (TenantSiteConfig & { site_templates?: { slug: string } }) | null;
  const templateSlug = configRow?.site_templates?.slug ?? "modern";
  const template = getTemplate(templateSlug);

  // Merge tenant section overrides onto template defaults
  const tenantOverrides: SectionConfig[] =
    configRow?.active_sections_json ?? [];
  const sections = resolveSections(
    template.default_layout_json,
    tenantOverrides,
  );

  return { tenant, sections, siteConfig: configRow };
}

// ---------------------------------------------------------------------------
// SEO helpers
// ---------------------------------------------------------------------------

function buildCanonicalUrl(tenant: ResolvedTenant): string {
  if (tenant.domain) {
    return `https://${tenant.domain}`;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rankedceo.com";
  return `${appUrl}/sites/${tenant.slug}`;
}

function buildMetaDescription(tenant: ResolvedTenant): string {
  const brand = tenant.brand_config as BrandConfig & { tagline?: string };
  const name = brand.business_name ?? tenant.slug;
  const trade =
    tenant.primary_trade ?? tenant.target_industry ?? "local service";
  const loc = tenant.target_location ?? "";
  const tagline = brand.tagline ?? tenant.usp ?? null;

  if (tagline) return `${name} — ${tagline}`;

  const tradeLabel =
    trade.charAt(0).toUpperCase() + trade.slice(1).toLowerCase();
  const locSuffix = loc ? ` in ${loc}` : "";
  return `${name} — Professional ${tradeLabel} services${locSuffix}. Book online today.`;
}

function buildStructuredData(
  tenant: ResolvedTenant,
  canonicalUrl: string,
  sections: SectionConfig[],
): object {
  const brand = tenant.brand_config as BrandConfig & {
    contact?: {
      phone?: string;
      email?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    social?: {
      google?: string;
      facebook?: string;
      instagram?: string;
      yelp?: string;
    };
    logo_url?: string;
    hero_image_url?: string;
    business_license_numbers?: Array<
      | string
      | {
          number?: string;
          licenseNumber?: string;
          authority?: string;
          authorityName?: string;
          url?: string;
          authorityUrl?: string;
          region?: string;
          issuingRegion?: string;
          validThrough?: string;
        }
    >;
    license_numbers?: Array<
      | string
      | {
          number?: string;
          licenseNumber?: string;
          authority?: string;
          authorityName?: string;
          url?: string;
          authorityUrl?: string;
          region?: string;
          issuingRegion?: string;
          validThrough?: string;
        }
    >;
    operating_hours?: Array<{
      dayOfWeek?: string | string[];
      opens?: string;
      closes?: string;
      validFrom?: string;
      validThrough?: string;
    }>;
    hours?: Array<{
      dayOfWeek?: string | string[];
      opens?: string;
      closes?: string;
      validFrom?: string;
      validThrough?: string;
    }>;
    geo?: {
      latitude?: number | string;
      longitude?: number | string;
      elevation?: number | string;
    };
    coordinates?: {
      latitude?: number | string;
      longitude?: number | string;
      elevation?: number | string;
    };
    service_areas?: string[];
  };

  const name = brand.business_name ?? tenant.slug;
  const contact = brand.contact ?? {};
  const trade =
    tenant.primary_trade ?? tenant.target_industry ?? "Local Service";

  const sameAs = [
    brand.social?.google,
    brand.social?.facebook,
    brand.social?.instagram,
    brand.social?.yelp,
  ].filter(
    (url): url is string => typeof url === "string" && url.trim().length > 0,
  );

  const rawServices = sections
    .filter(
      (section) =>
        section.enabled &&
        (section.section === "services" ||
          section.section === "bento-emergency"),
    )
    .flatMap((section) => {
      const content = section.content as
        { items?: Array<{ title?: string; description?: string }> } | undefined;
      return Array.isArray(content?.items) ? content.items : [];
    });

  const serviceMap = new Map<string, { name: string; description?: string }>();
  for (const item of rawServices) {
    if (!item?.title || !item.title.trim()) continue;
    const key = item.title.trim().toLowerCase();
    if (!serviceMap.has(key)) {
      serviceMap.set(key, {
        name: item.title.trim(),
        description: item.description?.trim() || undefined,
      });
    }
  }

  const services =
    serviceMap.size > 0
      ? Array.from(serviceMap.values()).map((service) => ({
          name: service.name,
          description: service.description,
          serviceType: trade,
          category: trade,
        }))
      : [
          {
            name: `${trade} Service`,
            description: `${name} provides reliable ${trade.toLowerCase()} support for local customers.`,
            serviceType: trade,
            category: trade,
          },
        ];

  const licenseSource =
    brand.business_license_numbers ?? brand.license_numbers ?? [];
  const licenses = Array.isArray(licenseSource)
    ? licenseSource
        .map((entry) => {
          if (typeof entry === "string") {
            const number = entry.trim();
            if (!number) return null;
            return { licenseNumber: number };
          }

          if (!entry || typeof entry !== "object") return null;
          const number = (entry.licenseNumber ?? entry.number ?? "").trim();
          if (!number) return null;

          return {
            licenseNumber: number,
            authorityName:
              (entry.authorityName ?? entry.authority)?.trim() || undefined,
            authorityUrl:
              (entry.authorityUrl ?? entry.url)?.trim() || undefined,
            issuingRegion:
              (entry.issuingRegion ?? entry.region)?.trim() || undefined,
            validThrough: entry.validThrough?.trim() || undefined,
          };
        })
        .filter(
          (
            value,
          ): value is {
            licenseNumber: string;
            authorityName?: string;
            authorityUrl?: string;
            issuingRegion?: string;
            validThrough?: string;
          } => Boolean(value),
        )
    : [];

  const dayNames = new Set<DayOfWeek>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);

  const isDayOfWeek = (value: string): value is DayOfWeek => dayNames.has(value as DayOfWeek);

  const hoursSource = brand.operating_hours ?? brand.hours ?? [];
  const operatingHours = Array.isArray(hoursSource)
    ? hoursSource
        .map((hour) => {
          const dayRaw = hour.dayOfWeek;
          const dayOfWeek = Array.isArray(dayRaw)
            ? dayRaw
                .filter((d): d is string => typeof d === "string")
                .map((d) => d.trim())
            : typeof dayRaw === "string"
              ? [dayRaw.trim()]
              : [];

          const validDays = dayOfWeek.filter(isDayOfWeek);
          if (!hour.opens || !hour.closes || validDays.length === 0)
            return null;

          return {
            dayOfWeek: validDays.length === 1 ? validDays[0] : validDays,
            opens: hour.opens,
            closes: hour.closes,
            validFrom: hour.validFrom,
            validThrough: hour.validThrough,
          };
        })
        .filter(
          (
            value,
          ): value is {
            dayOfWeek: DayOfWeek | DayOfWeek[];
            opens: string;
            closes: string;
            validFrom: string | undefined;
            validThrough: string | undefined;
          } => Boolean(value),
        )
    : [];

  const geoSource = brand.geo ?? brand.coordinates;
  const latitude =
    typeof geoSource?.latitude === "string"
      ? Number(geoSource.latitude)
      : geoSource?.latitude;
  const longitude =
    typeof geoSource?.longitude === "string"
      ? Number(geoSource.longitude)
      : geoSource?.longitude;
  const elevation =
    typeof geoSource?.elevation === "string"
      ? Number(geoSource.elevation)
      : geoSource?.elevation;

  const geo =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
      ? {
          latitude,
          longitude,
          elevation:
            typeof elevation === "number" && Number.isFinite(elevation)
              ? elevation
              : undefined,
        }
      : undefined;

  const serviceAreas = [
    ...(Array.isArray(brand.service_areas) ? brand.service_areas : []),
    ...(tenant.target_location ? [tenant.target_location] : []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);

  return buildLocalBusinessServiceJsonLdV2({
    canonicalUrl,
    businessType: "LocalBusiness",
    name,
    description: brand.tagline ?? tenant.usp ?? undefined,
    image: [brand.hero_image_url, brand.logo_url].filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    ),
    logo: brand.logo_url ?? undefined,
    telephone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    sameAs,
    address: {
      streetAddress: contact.address ?? undefined,
      addressLocality: contact.city ?? undefined,
      addressRegion: contact.state ?? undefined,
      postalCode: contact.zip ?? undefined,
      addressCountry: "US",
    },
    geo,
    licenses,
    operatingHours,
    serviceAreas,
    services,
  });
}

// ---------------------------------------------------------------------------
// generateMetadata — per-tenant dynamic SEO (Phase 8.5)
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: { site: string };
}): Promise<Metadata> {
  const result = await getTenantPage(params.site);

  if (!result) {
    return {
      title: "Not Found",
      description: "This page could not be found.",
    };
  }

  const { tenant } = result;
  const brand = tenant.brand_config as BrandConfig & {
    tagline?: string;
    logo_url?: string;
    favicon_url?: string;
    hero_image_url?: string;
  };
  const name = brand.business_name ?? tenant.slug;
  const description = buildMetaDescription(tenant);
  const canonical = buildCanonicalUrl(tenant);

  // OG image — use hero image if available, fallback to logo, then default
  const ogImage = brand.hero_image_url ?? brand.logo_url ?? null;

  return {
    title: name,
    description,
    metadataBase: new URL(canonical),
    alternates: {
      canonical: "/",
    },
    icons: brand.favicon_url
      ? { icon: brand.favicon_url, shortcut: brand.favicon_url }
      : undefined,
    openGraph: {
      type: "website",
      url: canonical,
      title: name,
      description,
      siteName: name,
      ...(ogImage
        ? {
            images: [{ url: ogImage, width: 1200, height: 630, alt: name }],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function SitePage({
  params,
}: {
  params: { site: string };
}) {
  const result = await getTenantPage(params.site);
  if (!result) notFound();

  const { tenant, sections, siteConfig } = result;
  const canonical = buildCanonicalUrl(tenant);
  const structuredData = buildStructuredData(tenant, canonical, sections);

  return (
    <>
      {/* JSON-LD structured data for local business */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toSafeJsonLdString(structuredData),
        }}
      />
      <SectionRenderer
        tenant={tenant}
        sections={sections}
        siteConfig={siteConfig}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ISR: Revalidate every 60 seconds so brand config changes propagate quickly
// ---------------------------------------------------------------------------

export const revalidate = 60;
