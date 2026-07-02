// =============================================================================
// app/_sites/[site]/sitemap.xml/route.ts
// PR #103 — WaaS SEO: Per-tenant dynamic sitemap.xml
//
// Generates a minimal XML sitemap for each published WaaS tenant site.
// Robots.txt (Phase 8.5) already references this URL; this route fulfils it.
//
// Sitemap includes:
//   - Homepage (priority 1.0, daily changefreq)
//   - Services anchor page (#services, priority 0.8)
//   - About anchor page   (#about,    priority 0.7)
//   - FAQ anchor page     (#faq,      priority 0.6)
//   - Contact anchor page (#booking,  priority 0.7)
//
// If the tenant is inactive or not found, returns a 404 response.
// Cacheable for 1 hour (CDN + ISR). Force-dynamic to read DB each time.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // refresh every hour

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq:
    "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string; // "0.0" – "1.0" as string to avoid float imprecision
}

function buildSitemap(urls: SitemapUrl[]): string {
  const urlTags = urls
    .map((u) =>
      [
        "  <url>",
        `    <loc>${xmlEscape(u.loc)}</loc>`,
        u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>` : "",
        `    <changefreq>${u.changefreq}</changefreq>`,
        `    <priority>${u.priority}</priority>`,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlTags,
    "</urlset>",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: { site: string } },
) {
  const slug = params.site;

  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL!,
      process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Fetch tenant + site config in a single query
    const { data: tenantRow, error } = await client
      .from("tenants")
      .select("id, status, domain, subdomain, updated_at")
      .eq("slug", slug)
      .single();

    if (error || !tenantRow) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const row = tenantRow as {
      id: string;
      status: string;
      domain: string | null;
      subdomain: string | null;
      updated_at: string | null;
    };

    // Only publish sitemaps for active tenants
    if (row.status !== "active") {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Build the canonical root URL for this tenant
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rankedceo.com";
    const baseUrl = row.domain
      ? `https://${row.domain}`
      : row.subdomain
        ? `https://${row.subdomain}.rankedceo.com`
        : `${appUrl}/sites/${slug}`;

    // Fetch site config to determine which sections are enabled
    const { data: siteConfigRow } = await client
      .from("tenant_site_config")
      .select("active_sections_json, updated_at")
      .eq("tenant_id", row.id)
      .maybeSingle();

    const configUpdatedAt = (siteConfigRow as { updated_at?: string } | null)
      ?.updated_at;
    const lastmod = configUpdatedAt
      ? new Date(configUpdatedAt).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Determine which anchor sections are enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeSections: Array<{ section: string; enabled: boolean }> =
      Array.isArray((siteConfigRow as any)?.active_sections_json)
        ? (siteConfigRow as any).active_sections_json
        : [];

    const isSectionEnabled = (id: string): boolean => {
      const found = activeSections.find((s) => s.section === id);
      // If no override found, default to enabled (template default)
      return found ? found.enabled : true;
    };

    // Build URL list
    const urls: SitemapUrl[] = [];

    // Homepage — always included
    urls.push({
      loc: baseUrl,
      lastmod,
      changefreq: "daily",
      priority: "1.0",
    });

    // Services section anchor
    if (isSectionEnabled("services")) {
      urls.push({
        loc: `${baseUrl}/#services`,
        lastmod,
        changefreq: "weekly",
        priority: "0.8",
      });
    }

    // About section anchor
    if (isSectionEnabled("about")) {
      urls.push({
        loc: `${baseUrl}/#about`,
        lastmod,
        changefreq: "monthly",
        priority: "0.7",
      });
    }

    // Booking/Contact section anchor
    if (isSectionEnabled("booking")) {
      urls.push({
        loc: `${baseUrl}/#booking`,
        lastmod,
        changefreq: "weekly",
        priority: "0.7",
      });
    }

    // FAQ section anchor
    if (isSectionEnabled("faq")) {
      urls.push({
        loc: `${baseUrl}/#faq`,
        lastmod,
        changefreq: "monthly",
        priority: "0.6",
      });
    }

    // Gallery section anchor
    if (isSectionEnabled("gallery")) {
      urls.push({
        loc: `${baseUrl}/#gallery`,
        lastmod,
        changefreq: "weekly",
        priority: "0.6",
      });
    }

    const xml = buildSitemap(urls);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    // DB error — return empty sitemap to avoid crawler errors
    const fallbackXml = buildSitemap([]);
    return new NextResponse(fallbackXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}
