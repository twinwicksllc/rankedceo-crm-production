"use server";
import { revalidatePath } from "next/cache";
import type { SectionConfig } from "@/lib/waas/templates/types";
import { generateIndustryKeywordPlan } from "@/lib/waas/services/keyword-generator";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";
import { saveTenantSiteVersion } from "./_versioning";
import {
  computeDeployReadiness,
  type DeployReadinessReport,
} from "./compute-deploy-readiness";

// Type-only re-export is safe in a "use server" file (erased at runtime).
// computeDeployReadiness itself is NOT re-exported here — a "use server"
// file's exports must all be async functions, so callers that need the
// pure sync function import it directly from ./compute-deploy-readiness.
export type { DeployReadinessReport };

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
