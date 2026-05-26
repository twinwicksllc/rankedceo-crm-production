import type { WaasTenant } from '@/lib/waas/types'
import type { InitialSiteBuildResult } from './types'
import { resolveTemplate, buildTier1Variant, persistTier1Variant } from './tier1'
import { runGeminiEnhancement } from './tier2'
import { buildProfile } from './profile'
import { getAdminClient } from './_shared'

export type { InitialSiteBuildResult } from './types'

export async function generateInitialSiteFromTemplate(
  tenantId: string,
  tenant: WaasTenant,
): Promise<InitialSiteBuildResult> {
  let templateSlug = 'modern'

  try {
    // ── Resolve template ────────────────────────────────────────────────────
    const template = await resolveTemplate(tenantId, tenant)
    templateSlug = template.slug

    // ── Tier 1: deterministic build ─────────────────────────────────────────
    const tier1 = buildTier1Variant(tenant, template)
    await persistTier1Variant(tenantId, tier1)

    // FIX #2 & #5: Record Tier 1 completion and set Tier 2 status before dispatching
    const supabase = getAdminClient()
    const tier2Dispatched = Boolean(process.env.GEMINI_API_KEY)
    await supabase
      .from('tenant_site_config')
      .upsert(
        {
          tenant_id: tenantId,
          initial_build_completed_at: new Date().toISOString(),
          ai_enhancement_status: tier2Dispatched ? 'in_progress' : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      )

    // ── Tier 2: Gemini enhancement — tracked promise chain (was fire-and-forget) ──
    const profile = buildProfile(tenant)
    if (tier2Dispatched) {
      runGeminiEnhancement(tenantId, tier1, profile, template)
        .then(async () => {
          await supabase
            .from('tenant_site_config')
            .upsert(
              {
                tenant_id: tenantId,
                ai_enhancement_status: 'completed',
                ai_enhancement_completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'tenant_id' },
            )
        })
        .catch(async (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unknown Gemini error'
          console.error(
            `[WaaS] Tier 2 Gemini enhancement failed for tenant ${tenantId}:`,
            message,
          )
          await supabase
            .from('tenant_site_config')
            .upsert(
              {
                tenant_id: tenantId,
                ai_enhancement_status: 'failed',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'tenant_id' },
            )
        })
    }

    return {
      tier1Success: true,
      tier2Dispatched,
      templateSlug,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    // FIX #5: Record Tier 1 failure to DB so the admin dashboard can surface it
    try {
      const supabase = getAdminClient()
      await supabase
        .from('tenant_site_config')
        .upsert(
          {
            tenant_id: tenantId,
            ai_enhancement_status: 'failed',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' },
        )
    } catch {
      // Best-effort — don't mask the original Tier 1 error
    }

    return {
      tier1Success: false,
      tier2Dispatched: false,
      templateSlug,
      message,
    }
  }
}
