'use server'

// =============================================================================
// AdvantagePoint - Onboarding Server Actions
// Uses Next.js 14 Server Actions for form submission + Supabase uploads
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type {
  OnboardingStep1Data,
  OnboardingStep2Data,
  OnboardingStep4Data,
  WaasPackageTier,
  DomainWishlistItem,
} from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// Raw client helper (bypasses ExactMatch type system)
// ---------------------------------------------------------------------------

function getRawClient() {
  const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key  = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Action Result type
// ---------------------------------------------------------------------------

export interface ActionResult<T = null> {
  success: boolean
  data?:   T
  error?:  string
}

// ---------------------------------------------------------------------------
// Step 1: Save Business Identity
// ---------------------------------------------------------------------------

export async function saveOnboardingStep1(
  tenantId: string | null,
  data: OnboardingStep1Data,
  auditId?: string | null,
  email?: string | null,
): Promise<ActionResult<{ tenantId: string }>> {
  try {
    const supabase = getRawClient()

    // Generate a slug from the legal name
    const slug = data.legal_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) + '-' + Math.random().toString(36).substring(2, 7)

    const locationLabel = `${data.city}, ${data.state}`

    const payload = {
      legal_name:       data.legal_name,
      physical_address: data.physical_address,
      primary_trade:    data.primary_trade,
      target_industry:  data.primary_trade,
      target_location:  locationLabel,
      source_audit_id:  auditId ?? null,
      submitted_by_email: email ?? null,
      status:           'onboarding',
      onboarding_step:  2,
      updated_at:       new Date().toISOString(),
      brand_config: {
        business_name: data.legal_name,
        tagline: data.tagline || null,
        colors: {
          primary:    '#2563EB',
          secondary:  '#1E40AF',
          accent:     '#DBEAFE',
          background: '#FFFFFF',
          text:       '#111827',
        },
        contact: {
          email: email ?? null,
          phone: data.phone || null,
          address: data.physical_address,
          city: data.city,
          state: data.state,
          zip: data.zip,
        },
        intake_profile: {
          business_type: data.business_type || null,
          services_offered: data.services_offered || null,
          business_hours: data.business_hours || null,
          target_audience: data.target_audience || null,
          primary_trade: data.primary_trade,
        },
      },
    }

    if (tenantId) {
      // Update existing tenant
      const { error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', tenantId)
      if (error) return { success: false, error: error.message }
      return { success: true, data: { tenantId } }
    } else {
      // Create new tenant
      const { data: inserted, error } = await supabase
        .from('tenants')
        .insert({ ...payload, slug, package_tier: 'standard' })
        .select('id')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: { tenantId: (inserted as { id: string }).id } }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Step 2: Save Domain Wishlist
// ---------------------------------------------------------------------------

export async function saveOnboardingStep2(
  tenantId: string,
  data: OnboardingStep2Data,
): Promise<ActionResult> {
  try {
    const supabase = getRawClient()

    // Delete existing domain requests for this tenant (in case of re-submission)
    await supabase.from('domain_requests').delete().eq('tenant_id', tenantId)

    // Insert new domain requests
    const requests = data.domains.map((d: DomainWishlistItem) => ({
      tenant_id:   tenantId,
      domain_name: d.domain_name,
      extension:   d.extension,
      priority:    d.priority,
      status:      'requested',
    }))

    if (requests.length > 0) {
      const { error } = await supabase.from('domain_requests').insert(requests)
      if (error) return { success: false, error: error.message }
    }

    // Advance onboarding step
    await supabase
      .from('tenants')
      .update({ onboarding_step: 3, updated_at: new Date().toISOString() })
      .eq('id', tenantId)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Step 3: Save Brand Identity (colors + logo URL after client-side upload)
// ---------------------------------------------------------------------------

export async function saveOnboardingStep3(
  tenantId: string,
  primaryColor: string,
  secondaryColor: string,
  logoUrl: string | null,
  businessName: string,
): Promise<ActionResult> {
  try {
    const supabase = getRawClient()

    // Fetch existing brand_config to merge
    const { data: tenant } = await supabase
      .from('tenants')
      .select('brand_config')
      .eq('id', tenantId)
      .single()

    const existingConfig = (tenant as { brand_config: Record<string, unknown> } | null)?.brand_config ?? {}

    const updatedBrandConfig = {
      ...existingConfig,
      business_name: businessName,
      logo_url:      logoUrl,
      colors: {
        primary:    primaryColor,
        secondary:  secondaryColor,
        accent:     primaryColor + '33',  // 20% opacity version of primary
        background: '#FFFFFF',
        text:       '#111827',
      },
    }

    const { error } = await supabase
      .from('tenants')
      .update({
        brand_config:    updatedBrandConfig,
        onboarding_step: 4,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Step 4: Save Integrations + Submit (final step)
// ---------------------------------------------------------------------------

export async function saveOnboardingStep4(
  tenantId: string,
  data: OnboardingStep4Data,
  packageTier: WaasPackageTier = 'standard',
): Promise<ActionResult> {
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

    const { error } = await supabase
      .from('tenants')
      .update({
        calendly_url:            data.calendly_url || null,
        financing_enabled:       data.financing_enabled,
        usp:                     data.usp || null,
        brand_config:            updatedBrandConfig,
        package_tier:            packageTier,
        status:                  'pending_review',
        onboarding_step:         5,
        onboarding_completed:    true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at:              new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/dashboard')
    return { success: true }
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
    const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
    if (!url) throw new Error('NEXT_PUBLIC_WAAS_SUPABASE_URL not set')

    const ext         = fileName.split('.').pop() ?? 'png'
    const uploadPath  = `${tenantId}/logo.${ext}`
    const publicUrl   = `${url}/storage/v1/object/public/logos/${uploadPath}`

    return { success: true, data: { uploadPath, publicUrl } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}