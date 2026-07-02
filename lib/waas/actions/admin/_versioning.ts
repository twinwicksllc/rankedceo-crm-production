// RankedCEO WaaS — Site version & lifecycle helpers (no 'use server')
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { TenantSiteConfig } from "@/lib/waas/templates/types";
import { getAdminClient } from "./_shared";

export type VariantLifecycleReasonCategory =
  | "workflow_transition"
  | "content_revision"
  | "client_request"
  | "compliance_update"
  | "quality_issue"
  | "other";

interface VariantLifecycleEventMeta {
  reasonCategory: VariantLifecycleReasonCategory;
  reasonText: string | null;
  actorType: "admin_user" | "authenticated_user" | "public_client" | "system";
  operatorId: string | null;
  operatorEmail: string | null;
  operatorRole: string | null;
}

interface SaveTenantSiteVersionOptions {
  lifecycleMeta?: {
    reasonCategory?: VariantLifecycleReasonCategory | null;
    reasonText?: string | null;
  };
}

export const LIFECYCLE_REASON_CATEGORY_SET =
  new Set<VariantLifecycleReasonCategory>([
    "workflow_transition",
    "content_revision",
    "client_request",
    "compliance_update",
    "quality_issue",
    "other",
  ]);

export const VARIANT_LIFECYCLE_SOURCES = [
  "site_variants_sent_to_review",
  "site_variants_unlocked_for_editing",
  "site_variants_review_reopened",
  "client_selected_variant",
  "client_mixed_variant",
  "client_regenerated_variant",
] as const;

export function normalizeLifecycleReason(
  reason: string | null | undefined,
): string | null {
  if (typeof reason !== "string") return null;
  const normalized = reason.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.slice(0, 500);
}

export function isVariantLifecycleSource(source: string): boolean {
  return VARIANT_LIFECYCLE_SOURCES.includes(
    source as (typeof VARIANT_LIFECYCLE_SOURCES)[number],
  );
}

export function getDefaultReasonCategoryForSource(
  source: string,
): VariantLifecycleReasonCategory {
  if (source === "site_variants_review_reopened") return "content_revision";
  if (source === "site_variants_unlocked_for_editing")
    return "workflow_transition";
  if (source === "site_variants_sent_to_review") return "workflow_transition";
  if (source.startsWith("client_")) return "client_request";
  return "other";
}

export function normalizeReasonCategory(
  value: VariantLifecycleReasonCategory | string | null | undefined,
  fallback: VariantLifecycleReasonCategory,
): VariantLifecycleReasonCategory {
  if (typeof value !== "string") return fallback;
  return LIFECYCLE_REASON_CATEGORY_SET.has(
    value as VariantLifecycleReasonCategory,
  )
    ? (value as VariantLifecycleReasonCategory)
    : fallback;
}

export async function resolveLifecycleOperatorIdentity(
  source: string,
): Promise<{
  actorType: "admin_user" | "authenticated_user" | "public_client" | "system";
  operatorId: string | null;
  operatorEmail: string | null;
  operatorRole: string | null;
}> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        actorType: source.startsWith("client_") ? "public_client" : "system",
        operatorId: null,
        operatorEmail: null,
        operatorRole: null,
      };
    }
    const operatorRole =
      typeof user.app_metadata?.role === "string"
        ? user.app_metadata.role
        : typeof user.user_metadata?.role === "string"
          ? user.user_metadata.role
          : null;
    const isAdmin =
      operatorRole === "waas_admin" ||
      user.app_metadata?.waas_admin === true ||
      user.app_metadata?.waas_admin === "true";
    return {
      actorType: isAdmin ? "admin_user" : "authenticated_user",
      operatorId: user.id,
      operatorEmail: typeof user.email === "string" ? user.email : null,
      operatorRole,
    };
  } catch {
    return {
      actorType: source.startsWith("client_") ? "public_client" : "system",
      operatorId: null,
      operatorEmail: null,
      operatorRole: null,
    };
  }
}

export async function saveTenantSiteVersion(
  tenantId: string,
  source: string,
  summary?: string,
  options?: SaveTenantSiteVersionOptions,
): Promise<string | null> {
  try {
    const supabase = getAdminClient();
    const { data: siteConfig } = await supabase
      .from("tenant_site_config")
      .select(
        "template_id, active_sections_json, custom_css, meta_title, meta_description, og_image_url, seo_keywords, seo_keywords_provider, seo_last_generated_at, client_selected_template_slug, client_selected_at, client_feedback_tone, client_feedback_cta_intensity, client_feedback_layout_preference, client_feedback_notes, client_feedback_submitted_at, client_mix_source_templates, client_mix_submitted_at, deployment_url, deployed_at, last_preview_at, site_templates(slug)",
      )
      .eq("tenant_id", tenantId)
      .single();
    if (!siteConfig) return null;
    const row = siteConfig as Record<string, unknown>;
    const templateSlug =
      (row.site_templates as { slug?: string } | null | undefined)?.slug ??
      null;
    const snapshot = {
      template_id: row.template_id ?? null,
      active_sections_json: row.active_sections_json ?? [],
      custom_css: row.custom_css ?? null,
      meta_title: row.meta_title ?? null,
      meta_description: row.meta_description ?? null,
      og_image_url: row.og_image_url ?? null,
      seo_keywords: row.seo_keywords ?? null,
      seo_keywords_provider: row.seo_keywords_provider ?? null,
      seo_last_generated_at: row.seo_last_generated_at ?? null,
      client_selected_template_slug: row.client_selected_template_slug ?? null,
      client_selected_at: row.client_selected_at ?? null,
      client_feedback_tone: row.client_feedback_tone ?? null,
      client_feedback_cta_intensity: row.client_feedback_cta_intensity ?? null,
      client_feedback_layout_preference:
        row.client_feedback_layout_preference ?? null,
      client_feedback_notes: row.client_feedback_notes ?? null,
      client_feedback_submitted_at: row.client_feedback_submitted_at ?? null,
      client_mix_source_templates: row.client_mix_source_templates ?? [],
      client_mix_submitted_at: row.client_mix_submitted_at ?? null,
      deployment_url: row.deployment_url ?? null,
      deployed_at: row.deployed_at ?? null,
      last_preview_at: row.last_preview_at ?? null,
    };
    let lifecycleEventMeta: VariantLifecycleEventMeta | null = null;
    if (isVariantLifecycleSource(source)) {
      const operator = await resolveLifecycleOperatorIdentity(source);
      const fallbackCategory = getDefaultReasonCategoryForSource(source);
      lifecycleEventMeta = {
        reasonCategory: normalizeReasonCategory(
          options?.lifecycleMeta?.reasonCategory,
          fallbackCategory,
        ),
        reasonText: normalizeLifecycleReason(
          options?.lifecycleMeta?.reasonText,
        ),
        actorType: operator.actorType,
        operatorId: operator.operatorId,
        operatorEmail: operator.operatorEmail,
        operatorRole: operator.operatorRole,
      };
    }
    const { data: inserted } = await supabase
      .from("tenant_site_versions")
      .insert({
        tenant_id: tenantId,
        change_source: source,
        summary: summary ?? null,
        template_slug: templateSlug,
        snapshot_json: lifecycleEventMeta
          ? { ...snapshot, lifecycle_event_meta: lifecycleEventMeta }
          : snapshot,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    return (inserted as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

export function generateReviewToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
