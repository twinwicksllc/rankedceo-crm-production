import type { ResolvedTenant, BrandConfig } from "@/lib/waas/templates/types";

// =============================================================================
// SiteComingSoon
// Rendered for tenants that exist but are not yet `status === "active"`.
// Replaces the previous bare 404 that any pre-launch shared link would hit —
// see docs/waas/AUDIT_TO_WEBSITE_FLOW_RECOMMENDATIONS.md (Initiative 5).
// =============================================================================

export function SiteComingSoon({ tenant }: { tenant: ResolvedTenant }) {
  const brand = tenant.brand_config as BrandConfig;
  const name = brand.business_name || tenant.legal_name || "This site";
  const primary = brand.colors?.primary ?? "#2563EB";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center">
      {brand?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo_url} alt={name} className="mb-6 h-12 w-auto" />
      ) : (
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
          style={{ backgroundColor: primary }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
        {name} is getting a new website
      </h1>
      <p className="mt-3 max-w-md text-base text-slate-600">
        We&apos;re putting the finishing touches on this site. Check back
        soon — it&apos;ll be live shortly.
      </p>
      <div
        className="mt-8 h-1.5 w-40 overflow-hidden rounded-full"
        style={{ backgroundColor: "rgb(var(--brand-primary-rgb) / 0.13)" }}
      >
        <div
          className="h-full w-1/3 animate-pulse rounded-full"
          style={{ backgroundColor: primary }}
        />
      </div>
      <p className="mt-10 text-xs font-medium uppercase tracking-wide text-slate-400">
        Powered by RankedCEO
      </p>
    </main>
  );
}
