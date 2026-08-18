// =============================================================================
// app/_sites/[site]/robots.txt/route.ts
// Phase 8.5 — Per-tenant robots.txt
//
// Returns a tenant-specific robots.txt so each published WaaS site
// properly signals to search engines:
//   - Allow all crawling for active tenants
//   - Disallow all for non-active or missing tenants (safety net)
//   - Sitemap URL pointing to the canonical site root
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // refresh every hour

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ site: string }> },
) {
  const { site: slug } = await params;

  // Look up tenant to confirm it's active and get domain/subdomain
  let isActive = false;
  let siteUrl = "";

  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL!,
      process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data } = await client
      .from("tenants")
      .select("status, domain, subdomain")
      .eq("slug", slug)
      .single();

    if (data) {
      const row = data as {
        status: string;
        domain: string | null;
        subdomain: string | null;
      };
      isActive = row.status === "active";
      if (row.domain) {
        siteUrl = `https://${row.domain}`;
      } else if (row.subdomain) {
        const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://rankedceo.com";
        siteUrl = `${base}/sites/${slug}`;
      }
    }
  } catch {
    // DB error — default to disallow to be safe
    isActive = false;
  }

  const content = isActive
    ? [
        "User-agent: *",
        "Allow: /",
        "",
        ...(siteUrl ? [`Sitemap: ${siteUrl}/sitemap.xml`] : []),
      ].join("\n")
    : ["User-agent: *", "Disallow: /"].join("\n");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
