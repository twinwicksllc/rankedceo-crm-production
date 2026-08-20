// Pure computation for deploy readiness — no I/O, no "use server" needed.
// Separated from deploy.ts to allow deploy.ts to have "use server" at file level.

import type { SectionConfig } from "@/lib/waas/templates/types";
import { toSectionConfigList, getCoreSectionFailures } from "./_validation";

export interface DeployReadinessCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface DeployPackageSummary {
  selectedTemplateSlug: string | null;
  enabledSections: string[];
  sectionCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  contactHooks: { hasCalendly: boolean; hasPhone: boolean; hasEmail: boolean };
  clientSelection: {
    templateSlug: string | null;
    selectedAt: string | null;
    feedbackSubmittedAt: string | null;
    mixSubmittedAt: string | null;
  };
}

export interface DeployReadinessReport {
  ready: boolean;
  checks: DeployReadinessCheck[];
  blockers: string[];
  packageSummary: DeployPackageSummary;
}

// Pure readiness computation — no I/O. Split out (Initiative 8 review fix)
// so callers that already have the tenant/tenant_site_config rows in hand
// (e.g. the client portal, which needs overlapping-but-not-identical
// columns from both tables for its own purposes) can compute readiness
// without a second round-trip to Supabase for data they already fetched.
//
// Required columns on tenantRow: id, slug, domain, subdomain, calendly_url,
// submitted_by_email, brand_config.
// Required columns on configRow: meta_title, meta_description, og_image_url,
// custom_css, active_sections_json, template_id, client_selected_template_slug,
// client_selected_at, client_feedback_submitted_at, client_mix_submitted_at,
// site_templates(slug, default_layout_json).
export function computeDeployReadiness(
  tenantRow: Record<string, unknown>,
  configRow: Record<string, unknown>,
): DeployReadinessReport {
  const siteTemplate =
    (configRow.site_templates as
      Record<string, unknown> | null | undefined) ?? null;
  const templateDefaultSections = toSectionConfigList(
    siteTemplate?.default_layout_json,
  );
  const activeSections = toSectionConfigList(configRow.active_sections_json);
  const resolvedSections =
    activeSections.length > 0 ? activeSections : templateDefaultSections;
  const enabledSections = resolvedSections
    .filter((s) => s.enabled)
    .map((s) => s.section);

  const metaTitle = (configRow.meta_title as string | null) ?? null;
  const metaDescription =
    (configRow.meta_description as string | null) ?? null;
  const ogImageUrl = (configRow.og_image_url as string | null) ?? null;

  const brandConfig =
    (tenantRow.brand_config as Record<string, unknown> | null | undefined) ??
    {};
  const contact =
    (brandConfig.contact as Record<string, unknown> | null | undefined) ?? {};
  const hasCalendly = Boolean(tenantRow.calendly_url);
  const hasPhone = Boolean((contact.phone as string | null));
  const hasEmail = Boolean((contact.email as string | null));

  const selectedTemplateSlug =
    (configRow.client_selected_template_slug as string | null) ?? null;

  const coreFailures = getCoreSectionFailures(
    resolvedSections as SectionConfig[],
  );

  const checks: DeployReadinessCheck[] = [
    {
      id: "template_selected",
      label: "Template Selected",
      status: selectedTemplateSlug ? "pass" : "fail",
      detail: selectedTemplateSlug
        ? `Using ${selectedTemplateSlug} template`
        : "No template selected",
    },
    {
      id: "meta_title",
      label: "Meta Title",
      status: metaTitle && metaTitle.length > 0 ? "pass" : "warn",
      detail: metaTitle
        ? `"${metaTitle}"`
        : "Missing — defaults will be used",
    },
    {
      id: "meta_description",
      label: "Meta Description",
      status: metaDescription && metaDescription.length > 8 ? "pass" : "warn",
      detail: metaDescription
        ? `${metaDescription.length} chars`
        : "Missing — defaults will be used",
    },
    {
      id: "og_image",
      label: "Social Image",
      status: ogImageUrl ? "pass" : "warn",
      detail: ogImageUrl ? "Configured" : "Missing — defaults will be used",
    },
    {
      id: "contact_methods",
      label: "Contact Methods",
      status:
        hasCalendly || hasPhone || hasEmail
          ? "pass"
          : tenantRow.status === "live"
            ? "warn"
            : "fail",
      detail: [
        hasCalendly && "Calendly",
        hasPhone && "Phone",
        hasEmail && "Email",
      ]
        .filter(Boolean)
        .join(", ") || "None configured",
    },
    ...coreFailures.map(
      (f): DeployReadinessCheck => ({
        id: f.sectionId,
        label: f.label,
        status: f.status,
        detail: f.reason,
      }),
    ),
  ];

  const blockers = checks
    .filter((c) => c.status === "fail")
    .map((c) => `${c.label}: ${c.detail}`);

  const ready =
    checks.every((c) => c.status !== "fail") &&
    selectedTemplateSlug &&
    (metaTitle?.length ?? 0) > 0;

  return {
    ready,
    checks,
    blockers,
    packageSummary: {
      selectedTemplateSlug,
      enabledSections,
      sectionCount: resolvedSections.length,
      metaTitle,
      metaDescription,
      ogImageUrl,
      contactHooks: { hasCalendly, hasPhone, hasEmail },
      clientSelection: {
        templateSlug: selectedTemplateSlug,
        selectedAt:
          (configRow.client_selected_at as string | null) ?? null,
        feedbackSubmittedAt:
          (configRow.client_feedback_submitted_at as string | null) ?? null,
        mixSubmittedAt:
          (configRow.client_mix_submitted_at as string | null) ?? null,
      },
    },
  };
}
