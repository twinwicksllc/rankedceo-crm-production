'use server'

import { revalidatePath } from 'next/cache'
import type {
  OnboardingStepTemplateData,
  OnboardingStep4Data,
  WaasPackageTier,
  WaasTenant,
} from '@/lib/waas/types'
import { ensureClientReviewToken } from '@/lib/waas/actions/admin'
import { generateInitialSiteFromTemplate } from '@/lib/waas/services/generate-initial-site'
import { generateSeoDefaults } from '@/lib/waas/services/seo-defaults'
import {
  getRawClient,
  updateTenantWithFallback,
  ensureLogosBucket,
} from './_shared'
import type { ActionResult } from './_shared'

// ---------------------------------------------------------------------------
// Step 4 (PR #94): Save Template Selection
// Writes client_selected_template_slug to tenant_site_config.
// Called after Step 3 (Brand Identity) before Step 5 (Integrations).
// ---------------------------------------------------------------------------

export async function saveOnboardingStepTemplate(
  tenantId: string,
  data: OnboardingStepTemplateData,
): Promise<ActionResult> {
  try {
    const supabase = getRawClient()

    // Upsert into tenant_site_config
    const { error: configError } = await supabase
      .from('tenant_site_config')
      .upsert(
        {
          tenant_id: tenantId,
          client_selected_template_slug: data.selected_template_slug,
          client_selected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      )

    if (configError) {
      // Gracefully handle missing table / column — don't block onboarding
      const msg = configError.message ?? ''
      const isSchemaGap =
        /could not find.*column.*client_selected_template_slug/i.test(msg) ||
        /could not find.*table.*tenant_site_config/i.test(msg)

      if (!isSchemaGap) {
        return { success: false, error: msg }
      }
      // Schema gap: column doesn't exist yet (pre-PR #96 migration) — continue silently
    }

    // FIX #1: Advance to step 4 (template selection IS step 4 — was incorrectly set to 5)
    await updateTenantWithFallback(supabase, tenantId, {
      onboarding_step: 4,
      updated_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Step 5: Save Integrations + Submit (final step)
// ---------------------------------------------------------------------------

export async function saveOnboardingStep4(
  tenantId: string,
  data: OnboardingStep4Data,
  packageTier: WaasPackageTier = 'standard',
): Promise<ActionResult<{ reviewToken: string }>> {
  try {
    const supabase = getRawClient()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('brand_config')
      .eq('id', tenantId)
      .single()

    const existingConfig = (tenant as { brand_config: Record<string, unknown> } | null)?.brand_config ?? {}

    const updatedBrandConfig = {
      ...existingConfig,
      tone: data.tone || null,
      fonts: {
        ...(typeof existingConfig.fonts === 'object' && existingConfig.fonts ? existingConfig.fonts as Record<string, unknown> : {}),
        preference: data.font_preference || null,
      },
      seo: {
        target_keywords: data.target_keywords || null,
        service_area: data.service_area || null,
        key_phrases: data.key_phrases || null,
      },
      content: {
        usp: data.usp,
        value_propositions: data.value_propositions || null,
        about_narrative: data.about_narrative || null,
        primary_cta: data.primary_cta || null,
      },
      assets: {
        hero_image_preference: data.hero_image_preference || null,
      },
      inspiration: {
        urls: data.inspiration_urls || null,
      },
      functionality: {
        contact_form: data.functionality_contact_form ?? true,
        booking: data.functionality_booking ?? true,
        gallery: data.functionality_gallery ?? false,
        ecommerce: data.functionality_ecommerce ?? false,
        blog: data.functionality_blog ?? false,
      },
    }

    const { error } = await updateTenantWithFallback(supabase, tenantId, {
      calendly_url: data.calendly_url || null,
      financing_enabled: data.financing_enabled,
      usp: data.usp || null,
      brand_config: updatedBrandConfig,
      package_tier: packageTier,
      status: 'pending_review',
      onboarding_step: 5,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) return { success: false, error: error.message }

    // FIX #6: Hard-fail if review token cannot be generated — never fall back to tenantId
    const tokenResult = await ensureClientReviewToken(tenantId)
    if (!tokenResult.success || !tokenResult.data) {
      return {
        success: false,
        error: `Failed to generate client review token: ${tokenResult.error ?? 'unknown error'}`,
      }
    }
    const reviewToken = tokenResult.data

    // Populate SEO defaults (meta_title, meta_description, og_image_url)
    // Only if they are not already set in tenant_site_config
    const { data: freshTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (freshTenant) {
      const tenantRow = freshTenant as WaasTenant

      // Get current site config to check what's already set
      const { data: siteConfig } = await supabase
        .from('tenant_site_config')
        .select('meta_title, meta_description, og_image_url')
        .eq('tenant_id', tenantId)
        .single()

      const configRow = (siteConfig as Record<string, unknown> | null) ?? {}

      // Generate defaults
      const seoDefaults = generateSeoDefaults(tenantRow)

      // Only upsert if values are not already set (null or empty)
      const metaTitleToSet = typeof configRow.meta_title === 'string' && configRow.meta_title.trim().length > 0
        ? undefined
        : seoDefaults.meta_title
      const metaDescriptionToSet = typeof configRow.meta_description === 'string' && configRow.meta_description.trim().length > 0
        ? undefined
        : seoDefaults.meta_description
      const ogImageUrlToSet = typeof configRow.og_image_url === 'string' && configRow.og_image_url.trim().length > 0
        ? undefined
        : seoDefaults.og_image_url

      // Build upsert payload with only non-undefined values
      const upsertPayload: Record<string, unknown> = {
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      }

      if (metaTitleToSet !== undefined) {
        upsertPayload.meta_title = metaTitleToSet
      }
      if (metaDescriptionToSet !== undefined) {
        upsertPayload.meta_description = metaDescriptionToSet
      }
      if (ogImageUrlToSet !== undefined) {
        upsertPayload.og_image_url = ogImageUrlToSet
      }

      // Only upsert if we have something to set
      if (Object.keys(upsertPayload).length > 2) {
        const { error: upsertError } = await supabase
          .from('tenant_site_config')
          .upsert(upsertPayload, { onConflict: 'tenant_id' })

        if (upsertError) {
          // Gracefully handle missing schema — don't block onboarding
          const msg = upsertError.message ?? ''
          const isSchemaGap =
            /could not find.*column.*meta_title/i.test(msg) ||
            /could not find.*column.*meta_description/i.test(msg) ||
            /could not find.*column.*og_image_url/i.test(msg) ||
            /could not find.*table.*tenant_site_config/i.test(msg)

          if (!isSchemaGap) {
            // Only return error if it's not a schema gap
            console.warn(`Failed to populate SEO defaults: ${msg}`)
          }
          // Schema gap: continue silently
        }
      }
    }

    // Tier 1: run synchronously (instant deterministic build).
    // Tier 2 (Gemini AI enhancement) is dispatched fire-and-forget inside
    // generateInitialSiteFromTemplate and does NOT block the response.
    if (freshTenant) {
      void generateInitialSiteFromTemplate(tenantId, freshTenant as WaasTenant)
    }

    revalidatePath('/admin/dashboard')
    return { success: true, data: { reviewToken } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Get Supabase Storage upload URL (for logo upload from client)
// Returns the public URL after upload
// ---------------------------------------------------------------------------

export async function getLogoUploadPath(
  tenantId: string,
  fileName: string,
): Promise<ActionResult<{ uploadPath: string; publicUrl: string }>> {
  try {
    const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
    if (!url) throw new Error('NEXT_PUBLIC_WAAS_SUPABASE_URL not set')

    const supabase = getRawClient()
    const { error: bucketError } = await ensureLogosBucket(supabase)
    if (bucketError) {
      return { success: false, error: bucketError.message }
    }

    const ext = fileName.split('.').pop() ?? 'png'
    // FIX #4: Add cache-busting timestamp to prevent stale logo caching after re-upload
    const uploadPath = `${tenantId}/logo-${Date.now()}.${ext}`
    const publicUrl = `${url}/storage/v1/object/public/logos/${uploadPath}`

    return { success: true, data: { uploadPath, publicUrl } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}
