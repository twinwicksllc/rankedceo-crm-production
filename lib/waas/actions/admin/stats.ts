"use server";
import { ALL_TEMPLATES } from "@/lib/waas/templates/registry";
import {
  recommendTemplates,
  type TemplateRecommendation,
} from "@/lib/waas/services/template-recommender";
import {
  getAdminClient,
  parseMissingTenantColumn,
  isPendingReviewEnumError,
} from "./_shared";
import type { ActionResult } from "./_shared";

export interface AdminStats {
  pendingCount: number;
  activeCount: number;
  totalLeads: number;
}

export interface WaasRevenueStats {
  mrr: number;
  arr: number;
  activePaidCount: number;
  planBreakdown: Record<string, number>;
  recentSubscriptions: Array<{
    tenantId: string;
    businessName: string;
    packageTier: string;
    planInterval: string | null;
    createdAt: string;
  }>;
}

export async function generateTemplateRecommendations(
  tenantId: string,
): Promise<ActionResult<TemplateRecommendation[]>> {
  try {
    const supabase = getAdminClient();
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select(
        "brand_config, target_industry, target_location, usp, calendly_url, financing_enabled",
      )
      .eq("id", tenantId)
      .single();
    if (error || !tenant)
      return { success: false, error: error?.message ?? "Tenant not found" };
    const brandConfig =
      (tenant as { brand_config?: Record<string, unknown> }).brand_config ?? {};
    const recommendations = await recommendTemplates(
      {
        businessName:
          typeof brandConfig.business_name === "string"
            ? brandConfig.business_name
            : "Business",
        industry:
          (tenant as { target_industry?: string | null }).target_industry ??
          null,
        location:
          (tenant as { target_location?: string | null }).target_location ??
          null,
        usp: (tenant as { usp?: string | null }).usp ?? null,
        financingEnabled: Boolean(
          (tenant as { financing_enabled?: boolean | null }).financing_enabled,
        ),
        hasBooking: Boolean(
          (tenant as { calendly_url?: string | null }).calendly_url,
        ),
        tone: typeof brandConfig.tone === "string" ? brandConfig.tone : null,
      },
      ALL_TEMPLATES,
    );
    return { success: true, data: recommendations };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function getAdminStats(): Promise<ActionResult<AdminStats>> {
  try {
    const supabase = getAdminClient();
    const countTenants = async (statuses: string[]) => {
      let queryStatuses = [...statuses];
      let result = await supabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .in("status", queryStatuses)
        .is("deleted_at", null);
      if (result.error && isPendingReviewEnumError(result.error.message)) {
        queryStatuses = queryStatuses.filter((s) => s !== "pending_review");
        result = await supabase
          .from("tenants")
          .select("id", { count: "exact", head: true })
          .in("status", queryStatuses)
          .is("deleted_at", null);
      }
      if (
        result.error &&
        parseMissingTenantColumn(result.error.message) === "deleted_at"
      ) {
        result = await supabase
          .from("tenants")
          .select("id", { count: "exact", head: true })
          .in("status", queryStatuses);
        if (result.error && isPendingReviewEnumError(result.error.message)) {
          queryStatuses = queryStatuses.filter((s) => s !== "pending_review");
          result = await supabase
            .from("tenants")
            .select("id", { count: "exact", head: true })
            .in("status", queryStatuses);
        }
      }
      if (result.error) throw new Error(result.error.message);
      return result.count ?? 0;
    };
    const [pendingCount, activeCount, leadsRes] = await Promise.all([
      countTenants(["pending_review", "onboarding"]),
      countTenants(["active"]),
      supabase.from("leads").select("id", { count: "exact", head: true }),
    ]);
    if (leadsRes.error) throw new Error(leadsRes.error.message);
    return {
      success: true,
      data: { pendingCount, activeCount, totalLeads: leadsRes.count ?? 0 },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function getWaasRevenueStats(): Promise<
  ActionResult<WaasRevenueStats>
> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "id, brand_config, package_tier, plan_interval, stripe_subscription_id, created_at",
      )
      .not("stripe_subscription_id", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      brand_config: Record<string, unknown> | null;
      package_tier: string | null;
      plan_interval: string | null;
      stripe_subscription_id: string;
      created_at: string;
    }>;
    const MONTHLY_VALUE: Record<string, number> = {
      hosting_only: Math.round(199 / 12),
      standard: 39,
      premium: 49,
    };
    const YEARLY_VALUE: Record<string, number> = {
      hosting_only: 199,
      standard: 399,
      premium: 499,
    };
    let mrr = 0,
      arr = 0;
    const planBreakdown: Record<string, number> = {};
    for (const row of rows) {
      const tier = row.package_tier ?? "hosting";
      const interval = row.plan_interval;
      planBreakdown[tier] = (planBreakdown[tier] ?? 0) + 1;
      if (interval === "month") {
        mrr += MONTHLY_VALUE[tier] ?? 0;
        arr += (MONTHLY_VALUE[tier] ?? 0) * 12;
      } else if (interval === "year") {
        const y = YEARLY_VALUE[tier] ?? 0;
        mrr += Math.round(y / 12);
        arr += y;
      }
    }
    const recentSubscriptions = rows.slice(0, 10).map((row) => {
      const bc = row.brand_config as { business_name?: string } | null;
      return {
        tenantId: row.id,
        businessName: bc?.business_name ?? row.id.slice(0, 8),
        packageTier: row.package_tier ?? "hosting",
        planInterval: row.plan_interval,
        createdAt: row.created_at,
      };
    });
    return {
      success: true,
      data: {
        mrr,
        arr,
        activePaidCount: rows.length,
        planBreakdown,
        recentSubscriptions,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load revenue stats",
    };
  }
}
