import type { WaasTenant } from '@/lib/waas/types'
import type { InitialSiteBuildResult } from './types'
import { resolveTemplate, buildTier1Variant, persistTier1Variant } from './tier1'
import { runGeminiEnhancement } from './tier2'
import { buildProfile } from './profile'

export type { InitialSiteBuildResult } from './types'

export async function generateInitialSiteFromTemplate(
  tenantId: string,
  tenant:   WaasTenant,
): Promise<InitialSiteBuildResult> {
  let templateSlug = 'modern'

  try {
    // ── Resolve template ────────────────────────────────────────────────────────────────────────
    const template = await resolveTemplate(tenantId, tenant)
    templateSlug   = template.slug

    // ── Tier 1: deterministic build ─────────────────────────────────────────────────────────────────
    const tier1 = buildTier1Variant(tenant, template)
    await persistTier1Variant(tenantId, tier1)

    // ── Tier 2: Gemini enhancement (fire-and-forget) ─────────────────────────────────────────
    const profile = buildProfile(tenant)
    void runGeminiEnhancement(tenantId, tier1, profile, template)

    return {
      tier1Success:    true,
      tier2Dispatched: Boolean(process.env.GEMINI_API_KEY),
      templateSlug,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      tier1Success:    false,
      tier2Dispatched: false,
      templateSlug,
      message,
    }
  }
}
