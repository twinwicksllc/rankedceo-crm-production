// Pure computation for deploy readiness — no I/O, no "use server" needed.
// Separated from deploy.ts so deploy.ts can have "use server" at file level
// (Next.js requires every export in a "use server" file to be async).
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

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------
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
  const metaTitle =
    typeof configRow.meta_title === "string"
      ? configRow.meta_title.trim()
      : "";
  const metaDescription =
    typeof configRow.meta_description === "string"
      ? configRow.meta_description.trim()
      : "";
  const ogImageUrl =
    typeof configRow.og_image_url === "string"
      ? configRow.og_image_url.trim()
      : "";
  const customCss =
    typeof configRow.custom_css === "string" ? configRow.custom_css : "";
  const brandConfig =
    (tenantRow.brand_config as Record<string, unknown> | null | undefined) ??
    null;
  const brandContact =
    (brandConfig?.contact as Record<string, unknown> | null | undefined) ??
    null;
  const phone =
    typeof brandContact?.phone === "string" ? brandContact.phone.trim() : "";
  const email =
    typeof brandContact?.email === "string" ? brandContact.email.trim() : "";
  const calendly =
    typeof tenantRow.calendly_url === "string"
      ? tenantRow.calendly_url.trim()
      : "";
  const submittedByEmail =
    typeof tenantRow.submitted_by_email === "string"
      ? tenantRow.submitted_by_email.trim()
      : "";
  const coreSectionFailures = getCoreSectionFailures(enabledSections);
  const checks: DeployReadinessCheck[] = [
    {
      id: "template_selected",
      label: "Template linked",
      status: configRow.template_id ? "pass" : "fail",
      detail: configRow.template_id
        ? "Template and site config are linked."
        : "No template is linked to tenant site config.",
    },
    {
      id: "meta_title",
      label: "Meta title present",
      status: metaTitle.length >= 20 ? "pass" : "fail",
      detail:
        metaTitle.length >= 20
          ? `Meta title length looks good (${metaTitle.length} chars).`
          : "Meta title must be at least 20 characters before deploy.",
    },
    {
      id: "meta_description",
      label: "Meta description present",
      status: metaDescription.length >= 70 ? "pass" : "fail",
      detail:
        metaDescription.length >= 70
          ? `Meta description length looks good (${metaDescription.length} chars).`
          : "Meta description must be at least 70 characters before deploy.",
    },
    {
      id: "core_sections",
      label: "Core sections enabled",
      status: coreSectionFailures.length === 0 ? "pass" : "fail",
      detail:
        coreSectionFailures.length === 0
          ? "Hero, services, and booking sections are enabled."
          : `Missing required enabled sections: ${coreSectionFailures.join(", ")}.`,
    },
    {
      id: "performance_css_budget",
      label: "Custom CSS budget",
      status: customCss.length <= 12000 ? "pass" : "fail",
      detail:
        customCss.length <= 12000
          ? `Custom CSS size is within budget (${customCss.length} chars).`
          : `Custom CSS exceeds budget (${customCss.length} chars > 12000).`,
    },
    {
      id: "performance_section_count",
      label: "Section count guard",
      status: enabledSections.length <= 6 ? "pass" : "warn",
      detail:
        enabledSections.length <= 6
          ? `Enabled sections count is ${enabledSections.length}.`
          : `Enabled sections count is high (${enabledSections.length}); consider simplifying for performance.`,
    },
    {
      id: "og_image",
      label: "Open Graph image",
      status: ogImageUrl ? "pass" : "warn",
      detail: ogImageUrl
        ? "Open Graph image is set."
        : "Open Graph image is missing; social previews may be weaker.",
    },
    {
      id: "contact_hooks",
      label: "Contact hook present",
      status:
        calendly || phone || email || submittedByEmail ? "pass" : "fail",
      detail:
        calendly || phone || email || submittedByEmail
          ? "At least one contact hook is configured."
          : "No Calendly, phone, or email contact hook found.",
    },
  ];
  const blockers = checks
    .filter((c) => c.status === "fail")
    .map((c) => `${c.label}: ${c.detail}`);
  const packageSummary: DeployPackageSummary = {
    selectedTemplateSlug: (siteTemplate?.slug as string | undefined) ?? null,
    enabledSections,
    sectionCount: enabledSections.length,
    metaTitle: metaTitle || null,
    metaDescription: metaDescription || null,
    ogImageUrl: ogImageUrl || null,
    contactHooks: {
      hasCalendly: Boolean(calendly),
      hasPhone: Boolean(phone),
      hasEmail: Boolean(email || submittedByEmail),
    },
    clientSelection: {
      templateSlug:
        (configRow.client_selected_template_slug as
          string | null | undefined) ?? null,
      selectedAt:
        (configRow.client_selected_at as string | null | undefined) ?? null,
      feedbackSubmittedAt:
        (configRow.client_feedback_submitted_at as
          string | null | undefined) ?? null,
      mixSubmittedAt:
        (configRow.client_mix_submitted_at as string | null | undefined) ??
        null,
    },
  };
  return { ready: blockers.length === 0, checks, blockers, packageSummary };
}
