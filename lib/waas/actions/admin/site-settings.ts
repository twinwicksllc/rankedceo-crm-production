"use server";
import { revalidatePath } from "next/cache";
import type { SectionConfig } from "@/lib/waas/templates/types";
import { ALL_TEMPLATES, getTemplate } from "@/lib/waas/templates/registry";
import { generateIndustryKeywordPlan } from "@/lib/waas/services/keyword-generator";
import { getAdminClient, isMissingSchemaTable } from "./_shared";
import type { ActionResult } from "./_shared";
import { saveTenantSiteVersion } from "./_versioning";

export interface TenantSiteSettingsInput {
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  customCss?: string | null;
  /** PR #103 — SEO keywords (max 20 phrases). Pass undefined to leave unchanged. */
  seoKeywords?: string[] | null;
}

export interface GenerateSeoKeywordsResult {
  keywords: string[];
  provider: "gemini" | "perplexity" | "fallback";
  detectedIndustry: string | null;
  detectedLocation: string | null;
}

export async function applyTemplate(
  tenantId: string,
  templateSlug: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient();
    const { data: template, error: tplError } = await supabase
      .from("site_templates")
      .select("id, default_layout_json")
      .eq("slug", templateSlug)
      .single();
    if (tplError || !template) {
      const { error: upsertError } = await supabase
        .from("tenant_site_config")
        .upsert(
          {
            tenant_id: tenantId,
            template_id: null,
            active_sections_json: [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" },
        );
      if (upsertError) throw new Error(upsertError.message);
    } else {
      const { error: upsertError } = await supabase
        .from("tenant_site_config")
        .upsert(
          {
            tenant_id: tenantId,
            template_id: template.id,
            active_sections_json: [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" },
        );
      if (upsertError) throw new Error(upsertError.message);
    }
    revalidatePath(`/admin/dashboard/${tenantId}`);
    revalidatePath("/_sites", "layout");
    await saveTenantSiteVersion(
      tenantId,
      "template_applied",
      `Applied template ${templateSlug}`,
    );
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateTenantSiteSettings(
  tenantId: string,
  input: TenantSiteSettingsInput,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient();
    const metaTitle = input.metaTitle?.trim() || null;
    const metaDescription = input.metaDescription?.trim() || null;
    const ogImageUrl = input.ogImageUrl?.trim() || null;
    const customCss = input.customCss ?? null;
    if (metaTitle && metaTitle.length > 160)
      return {
        success: false,
        error: "Meta title must be 160 characters or fewer.",
      };
    if (metaDescription && metaDescription.length > 320)
      return {
        success: false,
        error: "Meta description must be 320 characters or fewer.",
      };
    if (customCss && customCss.length > 12000)
      return {
        success: false,
        error: "Custom CSS exceeds 12000 character budget.",
      };
    if (input.seoKeywords !== undefined && input.seoKeywords !== null) {
      if (!Array.isArray(input.seoKeywords))
        return { success: false, error: "seoKeywords must be an array." };
      if (input.seoKeywords.length > 20)
        return {
          success: false,
          error: "seoKeywords must contain 20 phrases or fewer.",
        };
    }
    let activeSections: unknown[] = [];
    const { data: existingConfig } = await supabase
      .from("tenant_site_config")
      .select("active_sections_json")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (
      Array.isArray(
        (existingConfig as { active_sections_json?: unknown[] } | null)
          ?.active_sections_json,
      )
    ) {
      activeSections =
        (existingConfig as { active_sections_json?: unknown[] })
          .active_sections_json ?? [];
    }
    const upsertPayload: Record<string, unknown> = {
      tenant_id: tenantId,
      active_sections_json: activeSections,
      meta_title: metaTitle,
      meta_description: metaDescription,
      og_image_url: ogImageUrl,
      custom_css: customCss,
      updated_at: new Date().toISOString(),
    };
    if (input.seoKeywords !== undefined)
      upsertPayload.seo_keywords = input.seoKeywords;
    const { error } = await supabase
      .from("tenant_site_config")
      .upsert(upsertPayload, { onConflict: "tenant_id" });
    if (error) return { success: false, error: error.message };
    revalidatePath(`/admin/dashboard/${tenantId}`);
    revalidatePath("/_sites", "layout");
    revalidatePath(`/_preview/${tenantId}`);
    await saveTenantSiteVersion(
      tenantId,
      "admin_site_settings_updated",
      "Updated meta and site settings from command center",
    );
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function generateSeoKeywords(
  tenantId: string,
): Promise<ActionResult<GenerateSeoKeywordsResult>> {
  try {
    const supabase = getAdminClient();
    const { data: tenantRow, error: tenantErr } = await supabase
      .from("tenants")
      .select(
        "slug, domain, subdomain, brand_config, primary_trade, target_industry, target_location, usp",
      )
      .eq("id", tenantId)
      .single();
    if (tenantErr || !tenantRow)
      return { success: false, error: "Tenant not found." };
    const row = tenantRow as {
      slug: string;
      domain: string | null;
      subdomain: string | null;
      brand_config: Record<string, unknown>;
      primary_trade: string | null;
      target_industry: string | null;
      target_location: string | null;
      usp: string | null;
    };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rankedceo.com";
    const targetUrl = row.domain
      ? `https://${row.domain}`
      : row.subdomain
        ? `https://${row.subdomain}.rankedceo.com`
        : `${appUrl}/sites/${row.slug}`;
    const industry = row.primary_trade ?? row.target_industry ?? null;
    const location = row.target_location ?? null;
    const result = await generateIndustryKeywordPlan(
      targetUrl,
      industry,
      location,
      15,
    );
    if (!result.keywords.length)
      return {
        success: false,
        error: "Keyword generation returned no results.",
      };
    const { error: upsertErr } = await supabase
      .from("tenant_site_config")
      .upsert(
        {
          tenant_id: tenantId,
          seo_keywords: result.keywords,
          seo_keywords_provider: result.provider,
          seo_last_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );
    if (upsertErr) return { success: false, error: upsertErr.message };
    revalidatePath(`/admin/dashboard/${tenantId}`);
    revalidatePath("/_sites", "layout");
    revalidatePath(`/_sites/${row.slug}`);
    await saveTenantSiteVersion(
      tenantId,
      "seo_keywords_generated",
      `SEO keywords generated via ${result.provider} (${result.keywords.length} phrases)`,
    );
    return {
      success: true,
      data: {
        keywords: result.keywords,
        provider: result.provider,
        detectedIndustry: result.detectedIndustry,
        detectedLocation: result.detectedLocation,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateTenantHeroImage(
  tenantId: string,
  heroImageUrl: string | null,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient();
    const { data: tenantRow, error: fetchErr } = await supabase
      .from("tenants")
      .select("brand_config")
      .eq("id", tenantId)
      .single();
    if (fetchErr || !tenantRow)
      return { success: false, error: "Tenant not found" };
    const currentBrandConfig =
      (tenantRow as { brand_config: Record<string, unknown> }).brand_config ??
      {};
    const updatedBrandConfig = {
      ...currentBrandConfig,
      hero_image_url: heroImageUrl ?? null,
    };
    const { error: updateErr } = await supabase
      .from("tenants")
      .update({ brand_config: updatedBrandConfig })
      .eq("id", tenantId);
    if (updateErr) return { success: false, error: updateErr.message };
    revalidatePath(`/admin/dashboard/${tenantId}`);
    revalidatePath("/_sites", "layout");
    revalidatePath(`/_preview/${tenantId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update hero image",
    };
  }
}

export async function rollbackTenantSiteVersion(
  tenantId: string,
  versionId: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient();
    const { data: versionRow, error: versionError } = await supabase
      .from("tenant_site_versions")
      .select("snapshot_json, template_slug")
      .eq("id", versionId)
      .eq("tenant_id", tenantId)
      .single();
    if (versionError || !versionRow)
      return {
        success: false,
        error: versionError?.message ?? "Version snapshot not found",
      };
    const row = versionRow as {
      snapshot_json?: Record<string, unknown> | null;
      template_slug?: string | null;
    };
    const snapshot = row.snapshot_json ?? {};
    let templateId =
      (snapshot.template_id as string | null | undefined) ?? null;
    if (!templateId && row.template_slug) {
      const { data: template } = await supabase
        .from("site_templates")
        .select("id")
        .eq("slug", row.template_slug)
        .single();
      templateId = (template as { id?: string } | null)?.id ?? null;
    }
    const payload: Record<string, unknown> = {
      template_id: templateId,
      active_sections_json: snapshot.active_sections_json ?? [],
      custom_css: snapshot.custom_css ?? null,
      meta_title: snapshot.meta_title ?? null,
      meta_description: snapshot.meta_description ?? null,
      og_image_url: snapshot.og_image_url ?? null,
      client_selected_template_slug:
        snapshot.client_selected_template_slug ?? null,
      client_selected_at: snapshot.client_selected_at ?? null,
      client_feedback_tone: snapshot.client_feedback_tone ?? null,
      client_feedback_cta_intensity:
        snapshot.client_feedback_cta_intensity ?? null,
      client_feedback_layout_preference:
        snapshot.client_feedback_layout_preference ?? null,
      client_feedback_notes: snapshot.client_feedback_notes ?? null,
      client_feedback_submitted_at:
        snapshot.client_feedback_submitted_at ?? null,
      client_mix_source_templates: snapshot.client_mix_source_templates ?? [],
      client_mix_submitted_at: snapshot.client_mix_submitted_at ?? null,
      deployment_url: snapshot.deployment_url ?? null,
      deployed_at: snapshot.deployed_at ?? null,
      last_preview_at: snapshot.last_preview_at ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from("tenant_site_config")
      .update(payload)
      .eq("tenant_id", tenantId);
    if (updateError) return { success: false, error: updateError.message };
    await saveTenantSiteVersion(
      tenantId,
      "rollback_applied",
      "Rolled back to a previous site configuration version",
    );
    revalidatePath("/admin/dashboard");
    revalidatePath(`/admin/dashboard/${tenantId}`);
    revalidatePath("/_sites", "layout");
    revalidatePath(`/_preview/${tenantId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
