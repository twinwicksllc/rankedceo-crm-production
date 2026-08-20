"use server";
import { revalidatePath } from "next/cache";
import { generateIndustryKeywordPlan } from "@/lib/waas/services/keyword-generator";
import { getAdminClient, isMissingSchemaTable } from "./_shared";
import type { ActionResult } from "./_shared";
import { saveTenantSiteVersion } from "./_versioning";
import {
  computeDeployReadiness,
  type DeployReadinessCheck,
  type DeployPackageSummary,
  type DeployReadinessReport,
} from "./compute-deploy-readiness";

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

// ---------------------------------------------------------------------------
// getDeployReadiness — admin entry point. Fetches tenant + tenant_site_config
// itself, then delegates to the pure computeDeployReadiness() above.
// ---------------------------------------------------------------------------
export async function getDeployReadiness(
  tenantId: string,
): Promise<ActionResult<DeployReadinessReport>> {
  try {
    const supabase = getAdminClient();
    const [
      { data: tenant, error: tenantError },
      { data: siteConfig, error: configError },
    ] = await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id, slug, domain, subdomain, calendly_url, submitted_by_email, brand_config",
        )
        .eq("id", tenantId)
        .single(),
      supabase
        .from("tenant_site_config")
        .select(
          "meta_title, meta_description, og_image_url, custom_css, active_sections_json, template_id, client_selected_template_slug, client_selected_at, client_feedback_submitted_at, client_mix_submitted_at, site_templates(slug, default_layout_json)",
        )
        .eq("tenant_id", tenantId)
        .single(),
    ]);
    if (tenantError || !tenant)
      return {
        success: false,
        error: tenantError?.message ?? "Tenant not found",
      };
    if (configError || !siteConfig)
      return {
        success: false,
        error: configError?.message ?? "Tenant site configuration not found",
      };
    const data = computeDeployReadiness(
      tenant as Record<string, unknown>,
      siteConfig as Record<string, unknown>,
    );
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function deploySite(
  tenantId: string,
  deployedBy = "admin_console",
): Promise<ActionResult<{ deploymentId: string | null }>> {
  try {
    const supabase = getAdminClient();
    const readiness = await getDeployReadiness(tenantId);
    if (!readiness.success || !readiness.data)
      return {
        success: false,
        error: readiness.error ?? "Unable to validate deploy readiness",
      };
    if (!readiness.data.ready)
      return {
        success: false,
        error: `Deploy blocked. Resolve required checks first: ${readiness.data.blockers.join(" | ")}`,
      };
    const { data: tenant } = await supabase
      .from("tenants")
      .select("slug, domain, subdomain")
      .eq("id", tenantId)
      .single();
    const tenantRow = (tenant ?? {}) as Record<string, unknown>;
    const domain =
      typeof tenantRow.domain === "string" ? tenantRow.domain.trim() : "";
    const subdomain =
      typeof tenantRow.subdomain === "string" ? tenantRow.subdomain.trim() : "";
    const slug =
      typeof tenantRow.slug === "string" ? tenantRow.slug.trim() : "";
    const deploymentUrl = domain
      ? `https://${domain}`
      : subdomain
        ? `https://${subdomain}`
        : slug
          ? `https://${slug}`
          : null;
    const deployedAt = new Date().toISOString();
    let selectedVariantSections: SectionConfig[] | null = null;
    const { data: selectedVariant, error: variantError } = await supabase
      .from("tenant_site_variants")
      .select("sections_json")
      .eq("tenant_id", tenantId)
      .eq("status", "selected")
      .order("variant_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (
      !variantError &&
      selectedVariant &&
      Array.isArray(
        (selectedVariant as { sections_json?: unknown[] }).sections_json,
      )
    ) {
      selectedVariantSections = (
        selectedVariant as { sections_json: SectionConfig[] }
      ).sections_json;
    }
    const [{ error: tenantUpdateError }, { error: configUpdateError }] =
      await Promise.all([
        supabase
          .from("tenants")
          .update({ status: "active", updated_at: deployedAt })
          .eq("id", tenantId),
        supabase
          .from("tenant_site_config")
          .update({
            deployment_url: deploymentUrl,
            deployed_at: deployedAt,
            ...(selectedVariantSections
              ? { active_sections_json: selectedVariantSections }
              : {}),
            updated_at: deployedAt,
          })
          .eq("tenant_id", tenantId),
      ]);
    if (tenantUpdateError)
      return { success: false, error: tenantUpdateError.message };
    if (configUpdateError)
      return { success: false, error: configUpdateError.message };
    const deployedVersionId = await saveTenantSiteVersion(
      tenantId,
      "site_deployed",
      `Deployment completed by ${deployedBy}`,
    );
    let deploymentId: string | null = null;
    try {
      const { data: deploymentRow } = await supabase
        .from("tenant_site_deployments")
        .insert({
          tenant_id: tenantId,
          deployed_by: deployedBy,
          source_version_id: deployedVersionId,
          deployment_payload_json: readiness.data.packageSummary,
          created_at: deployedAt,
        })
        .select("id")
        .single();
      deploymentId = (deploymentRow as { id?: string } | null)?.id ?? null;
    } catch {
      /* backward-safe: migration may not be applied yet */
    }
    // ── Auto-generate SEO keywords on first deploy ────────────────────────────
    try {
      const { data: siteConfigForSeo } = await supabase
        .from("tenant_site_config")
        .select("seo_keywords")
        .eq("tenant_id", tenantId)
        .single();
      const existingKw = (
        siteConfigForSeo as { seo_keywords?: string[] | null } | null
      )?.seo_keywords;
      if (!Array.isArray(existingKw) || existingKw.length === 0) {
        const { data: tenantForSeo } = await supabase
          .from("tenants")
          .select(
            "slug, domain, subdomain, primary_trade, target_industry, target_location",
          )
          .eq("id", tenantId)
          .single();
        if (tenantForSeo) {
          const t = tenantForSeo as {
            slug: string;
            domain: string | null;
            subdomain: string | null;
            primary_trade: string | null;
            target_industry: string | null;
            target_location: string | null;
          };
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL ?? "https://rankedceo.com";
          const targetUrl = t.domain
            ? `https://${t.domain}`
            : t.subdomain
              ? `https://${t.subdomain}.rankedceo.com`
              : `${appUrl}/sites/${t.slug}`;
          const kwResult = await generateIndustryKeywordPlan(
            targetUrl,
            t.primary_trade ?? t.target_industry ?? null,
            t.target_location ?? null,
            15,
          );
          if (kwResult.keywords.length > 0) {
            await supabase
              .from("tenant_site_config")
              .update({
                seo_keywords: kwResult.keywords,
                seo_keywords_provider: kwResult.provider,
                seo_last_generated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("tenant_id", tenantId);
          }
        }
      }
    } catch {
      /* non-blocking */
    }
    revalidatePath("/admin/dashboard");
    revalidatePath(`/admin/dashboard/${tenantId}`);
    return { success: true, data: { deploymentId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
