"use server";

import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import { getAdminClient } from "./_shared";
import type { ActionResult, EditType } from "./_shared";
import {
  getClientDeployReadiness,
  type DeployReadinessReport,
} from "@/lib/waas/actions/admin/deploy";

export type { DeployReadinessReport };

// =============================================================================
// 11. getTenantPortalData
//     Returns the aggregated data needed for the tenant portal home (Phase 6.1).
//     Includes: site status, domain info, recent edits, AI rewrite usage count,
//     and deployment info.
//     Called server-side from the /edit/[reviewToken] page.tsx.
// =============================================================================

export interface TenantPortalSiteStatus {
  tenantStatus: string; // 'onboarding' | 'pending_review' | 'active' etc.
  variantLabel: string | null; // e.g. "Design A"
  templateSlug: string | null;
  liveSubdomain: string | null; // e.g. "myclient" -> myclient.rankedceo.com
  liveDomain: string | null; // custom domain if set
  approvalAt: string | null; // ISO timestamp
  approvalLocked: boolean;
  lastClientEdit: string | null; // ISO timestamp of last client-initiated edit
  // --- Site-build lifecycle fields (migration 022) ---
  initialBuildCompletedAt: string | null; // Tier 1 completed
  aiEnhancementStatus: "in_progress" | "completed" | "failed" | null; // Tier 2 state
  templateSlugDisplay: string | null; // slug for human display
  tenantCreatedAt: string | null; // when tenant record was created
}

export interface TenantPortalRecentEdit {
  id: string;
  fieldPath: string;
  editType: EditType;
  newValue: string | null;
  createdAt: string;
}

export interface TenantPortalData {
  siteStatus: TenantPortalSiteStatus;
  recentEdits: TenantPortalRecentEdit[]; // last 5, most-recent first
  aiRewriteCount: number; // total AI rewrites this session
  editCount: number; // total edits this session (all types)
  billingStatus: TenantPortalBillingStatus | null; // Phase 7.4
  brandConfig: Record<string, unknown> | null; // For Task 2: complete profile card
  // Initiative 8 (docs/waas/AUDIT_TO_WEBSITE_FLOW_RECOMMENDATIONS.md) — same
  // readiness checklist admin sees, surfaced to the client. null when the
  // tenant's site config doesn't exist yet (e.g. still mid-onboarding).
  deployReadiness: DeployReadinessReport | null;
}

// Lightweight billing snapshot embedded in portal data
export interface TenantPortalBillingStatus {
  packageTier: string; // 'hosting' | 'standard' | 'premium'
  planInterval: "month" | "year" | null;
  hasActiveSubscription: boolean;
}

export async function getTenantPortalData(
  reviewToken: string,
): Promise<ActionResult<TenantPortalData>> {
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const {
    tenantId,
    selectedVariantIndex,
    selectedTemplateSlug,
    approvalAt,
    approvalLocked,
  } = sessionResult.session;

  try {
    const supabase = getAdminClient();

    // 1. Tenant domain/status + billing fields (Phase 7.4) — fetched
    // alongside deploy readiness (Initiative 8) since both only need tenantId.
    const [{ data: tenantRow }, deployReadinessResult] = await Promise.all([
      supabase
        .from("tenants")
        .select(
          "status, subdomain, domain, package_tier, plan_interval, stripe_subscription_id, brand_config, created_at",
        )
        .eq("id", tenantId)
        .single(),
      getClientDeployReadiness(tenantId),
    ]);
    const deployReadiness = deployReadinessResult.success
      ? deployReadinessResult.data ?? null
      : null;

    const tenant = tenantRow as {
      status: string;
      subdomain: string | null;
      domain: string | null;
      package_tier: string | null;
      plan_interval: string | null;
      stripe_subscription_id: string | null;
      brand_config: Record<string, unknown> | null;
      created_at: string | null;
    } | null;

    // 1b. tenant_site_config build-lifecycle columns (migration 022; schema-gap resilient)
    let initialBuildCompletedAt: string | null = null;
    let rawAiStatus: string | null = null;
    let clientSelectedSlug: string | null = null;

    const { data: configRow } = await supabase
      .from("tenant_site_config")
      .select(
        "initial_build_completed_at, ai_enhancement_status, client_selected_template_slug",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle(); // returns null (not error) if row absent

    if (configRow) {
      const cfg = configRow as {
        initial_build_completed_at: string | null;
        ai_enhancement_status: string | null;
        client_selected_template_slug: string | null;
      };
      initialBuildCompletedAt = cfg.initial_build_completed_at;
      rawAiStatus = cfg.ai_enhancement_status;
      clientSelectedSlug = cfg.client_selected_template_slug;
    }

    // Coerce ai_enhancement_status to the union type (unknown values → null)
    const VALID_AI_STATUSES = ["in_progress", "completed", "failed"] as const;
    type AiStatus = (typeof VALID_AI_STATUSES)[number];
    const aiEnhancementStatus: AiStatus | null = VALID_AI_STATUSES.includes(
      rawAiStatus as AiStatus,
    )
      ? (rawAiStatus as AiStatus)
      : null;

    // 2. Selected variant label
    let variantLabel: string | null = null;
    let lastClientEdit: string | null = null;
    if (selectedVariantIndex != null) {
      const { data: variantRow } = await supabase
        .from("tenant_site_variants")
        .select("variant_label, client_last_edited_at")
        .eq("tenant_id", tenantId)
        .eq("variant_index", selectedVariantIndex)
        .single();

      if (variantRow) {
        const vr = variantRow as {
          variant_label: string;
          client_last_edited_at: string | null;
        };
        variantLabel = vr.variant_label;
        lastClientEdit = vr.client_last_edited_at;
      }
    }

    // 3. Recent edits (last 5 for this tenant's selected variant)
    let recentEdits: TenantPortalRecentEdit[] = [];
    if (selectedVariantIndex != null) {
      const { data: editsRows } = await supabase
        .from("client_variant_edit_events")
        .select("id, field_path, edit_type, new_value, created_at, ai_intent")
        .eq("tenant_id", tenantId)
        .eq("variant_index", selectedVariantIndex)
        .order("created_at", { ascending: false })
        .limit(5);

      if (editsRows) {
        recentEdits = (
          editsRows as Array<{
            id: string;
            field_path: string;
            edit_type: string;
            new_value: string | null;
            created_at: string;
            ai_intent: string | null;
          }>
        )
          .filter((e) => !e.ai_intent?.startsWith("undo:"))
          .slice(0, 5)
          .map((e) => ({
            id: e.id,
            fieldPath: e.field_path,
            editType: e.edit_type as EditType,
            newValue: e.new_value,
            createdAt: e.created_at,
          }));
      }
    }

    // 4. AI rewrite + total edit counts (this variant)
    let aiRewriteCount = 0;
    let editCount = 0;
    if (selectedVariantIndex != null) {
      const { data: countRows } = await supabase
        .from("client_variant_edit_events")
        .select("edit_type, ai_intent")
        .eq("tenant_id", tenantId)
        .eq("variant_index", selectedVariantIndex);

      if (countRows) {
        const rows = countRows as Array<{
          edit_type: string;
          ai_intent: string | null;
        }>;
        const real = rows.filter((r) => !r.ai_intent?.startsWith("undo:"));
        editCount = real.length;
        aiRewriteCount = real.filter(
          (r) => r.edit_type === "ai_rewrite",
        ).length;
      }
    }

    // Billing status snapshot (Phase 7.4)
    const tier = (tenant?.package_tier ?? "hosting") as string;
    const interval = (tenant?.plan_interval ?? null) as "month" | "year" | null;
    const billingStatus: TenantPortalBillingStatus = {
      packageTier: tier,
      planInterval: interval,
      hasActiveSubscription:
        !!tenant?.stripe_subscription_id && tier !== "hosting",
    };

    return {
      success: true,
      data: {
        siteStatus: {
          tenantStatus: tenant?.status ?? "onboarding",
          variantLabel,
          templateSlug: selectedTemplateSlug,
          liveSubdomain: tenant?.subdomain ?? null,
          liveDomain: tenant?.domain ?? null,
          approvalAt,
          approvalLocked,
          lastClientEdit,
          // Site-build lifecycle (migration 022)
          initialBuildCompletedAt,
          aiEnhancementStatus,
          templateSlugDisplay: clientSelectedSlug ?? selectedTemplateSlug,
          tenantCreatedAt: tenant?.created_at ?? null,
        },
        recentEdits,
        aiRewriteCount,
        editCount,
        billingStatus,
        brandConfig: tenant?.brand_config ?? null,
        deployReadiness,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load portal data",
    };
  }
}
