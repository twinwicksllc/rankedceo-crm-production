import type { WaasTenant } from "@/lib/waas/types";
import type { InitialSiteBuildResult } from "./types";
import {
  resolveTemplate,
  buildTier1Variant,
  persistTier1Variant,
} from "./tier1";
import { runGeminiEnhancement } from "./tier2";
import { buildProfile } from "./profile";
import { getAdminClient } from "./_shared";
import { sendTenantNotification } from "@/lib/waas/services/notifications";

export type { InitialSiteBuildResult } from "./types";

export async function generateInitialSiteFromTemplate(
  tenantId: string,
  tenant: WaasTenant,
): Promise<InitialSiteBuildResult> {
  let templateSlug = "modern";

  try {
    // ── Resolve template ────────────────────────────────────────────────────
    const template = await resolveTemplate(tenantId, tenant);
    templateSlug = template.slug;

    // ── Tier 1: deterministic build ─────────────────────────────────────────
    const tier1 = buildTier1Variant(tenant, template);
    await persistTier1Variant(tenantId, tier1);

    // FIX #2 & #5: Record Tier 1 completion and set Tier 2 status before dispatching
    const supabase = getAdminClient();
    const tier2Dispatched = Boolean(process.env.GEMINI_API_KEY);
    await supabase.from("tenant_site_config").upsert(
      {
        tenant_id: tenantId,
        initial_build_completed_at: new Date().toISOString(),
        ai_enhancement_status: tier2Dispatched ? "in_progress" : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

    // ── Tier 2: Gemini enhancement — tracked promise chain (was fire-and-forget) ──
    const profile = buildProfile(tenant);
    if (tier2Dispatched) {
      runGeminiEnhancement(tenantId, tier1, profile, template)
        .then(async () => {
          const { data: configRow, error: statusError } = await supabase
            .from("tenant_site_config")
            .select("ai_enhancement_status")
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (
            statusError ||
            (configRow as { ai_enhancement_status?: string } | null)
              ?.ai_enhancement_status !== "completed"
          ) {
            console.warn(
              `[WaaS] Tier 2 did not complete for tenant ${tenantId} — skipping notification`,
            );
            return;
          }

          // Initiative 7 (docs/waas/AUDIT_TO_WEBSITE_FLOW_RECOMMENDATIONS.md):
          // the enhancement pass was previously fire-and-forget with no
          // client-visible completion signal. Notify now that Tier 2 is done
          // so the client knows to go look again instead of reviewing a
          // stale Tier 1 variant. Best-effort — never blocks the DB write.
          try {
            const { data: configRow } = await supabase
              .from("tenant_site_config")
              .select("client_review_token")
              .eq("tenant_id", tenantId)
              .maybeSingle();

            const reviewToken = (configRow as { client_review_token?: string } | null)
              ?.client_review_token;

            if (reviewToken) {
              const appUrl =
                process.env.NEXT_PUBLIC_APP_URL_PROD ??
                process.env.NEXT_PUBLIC_APP_URL ??
                "https://crm.rankedceo.com";

              await sendTenantNotification({
                type: "ai_enhancement_ready",
                tenantId,
                data: {
                  businessName: tenant.brand_config?.business_name ?? tenant.legal_name ?? undefined,
                  reviewUrl: `${appUrl}/edit/${reviewToken}?tab=overview`,
                },
                dedupKey: `ai_enhancement_ready:${tenantId}`,
                dedupWindowHours: 24,
              });
            } else {
              console.warn(
                `[WaaS] Tier 2 complete for tenant ${tenantId} but no review token found — skipping notification`,
              );
            }
          } catch (notifyErr) {
            console.error(
              `[WaaS] ai_enhancement_ready notification failed for tenant ${tenantId}:`,
              notifyErr,
            );
          }
        })
        .catch(async (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Unknown Gemini error";
          console.error(
            `[WaaS] Tier 2 Gemini enhancement failed for tenant ${tenantId}:`,
            message,
          );
          await supabase.from("tenant_site_config").upsert(
            {
              tenant_id: tenantId,
              ai_enhancement_status: "failed",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id" },
          );
        });
    }

    return {
      tier1Success: true,
      tier2Dispatched,
      templateSlug,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // FIX #5: Record Tier 1 failure to DB so the admin dashboard can surface it
    try {
      const supabase = getAdminClient();
      await supabase.from("tenant_site_config").upsert(
        {
          tenant_id: tenantId,
          ai_enhancement_status: "failed",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );
    } catch {
      // Best-effort — don't mask the original Tier 1 error
    }

    return {
      tier1Success: false,
      tier2Dispatched: false,
      templateSlug,
      message,
    };
  }
}
