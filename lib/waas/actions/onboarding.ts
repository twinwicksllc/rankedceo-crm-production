'use server'

// =============================================================================
// RankedCEO Website Builder - Onboarding Server Actions
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

import { generateAndStoreSiteVariants, ensureClientReviewToken } from '@/lib/waas/actions/admin'
import type { AuditReportData } from '@/lib/waas/types'

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
// Tenant write helpers (schema-cache safe)
// ---------------------------------------------------------------------------

function parseMissingTenantColumn(errorMessage: string): string | null {
  const match = errorMessage.match(/Could not find the '([^']+)' column of 'tenants' in the schema cache/i)
  return match?.[1] ?? null
}

function isPendingReviewEnumError(errorMessage: string): boolean {
  return /invalid input value for enum .*pending_review/i.test(errorMessage)
}

function isMissingSchemaTable(errorMessage: string, tableName: string): boolean {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`Could not find the table 'public\\.${escaped}' in the schema cache`, 'i')
  return re.test(errorMessage)
}

function isMissingBucketError(errorMessage: string, bucketName: string): boolean {
  const escaped = bucketName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`bucket.*${escaped}.*(not found|does not exist)|not found`, 'i')
  return re.test(errorMessage)
}

async function ensureLogosBucket(supabase: ReturnType<typeof getRawClient>): Promise<{ error: { message: string } | null }> {
  const { data, error } = await supabase.storage.getBucket('logos')
  if (!error && data) {
    return { error: null }
  }

  if (error && !isMissingBucketError(error.message, 'logos')) {
    return { error: { message: error.message } }
  }

  const { error: createError } = await supabase.storage.createBucket('logos', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  })

  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    return { error: { message: createError.message } }
  }

  return { error: null }
}

async function updateTenantWithFallback(
  supabase: ReturnType<typeof getRawClient>,
  tenantId: string,
  payload: Record<string, unknown>
): Promise<{ error: { message: string } | null }> {
  const mutablePayload: Record<string, unknown> = { ...payload }

  // Retry after removing unknown columns reported by schema cache.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabase
      .from('tenants')
      .update(mutablePayload)
      .eq('id', tenantId)

    if (!error) return { error: null }

    const missingColumn = parseMissingTenantColumn(error.message)
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn]
      continue
    }

    if (isPendingReviewEnumError(error.message) && mutablePayload.status === 'pending_review') {
      mutablePayload.status = 'onboarding'
      continue
    }

    return { error: { message: error.message } }
  }

  return { error: { message: 'Tenant update failed after schema fallback retries.' } }
}

async function insertTenantWithFallback(
  supabase: ReturnType<typeof getRawClient>,
  payload: Record<string, unknown>
): Promise<{ id?: string; error: { message: string } | null }> {
  const mutablePayload: Record<string, unknown> = { ...payload }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data: inserted, error } = await supabase
      .from('tenants')
      .insert(mutablePayload)
      .select('id')
      .single()

    if (!error) {
      return { id: (inserted as { id: string }).id, error: null }
    }

    const missingColumn = parseMissingTenantColumn(error.message)
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn]
      continue
    }

    if (isPendingReviewEnumError(error.message) && mutablePayload.status === 'pending_review') {
      mutablePayload.status = 'onboarding'
      continue
    }

    return { error: { message: error.message } }
  }

  return { error: { message: 'Tenant insert failed after schema fallback retries.' } }
}

// ---------------------------------------------------------------------------
// Audit Data Extraction Helper
// Fetches audit and pre-fills brand_config with keywords, competitors, etc.
// ---------------------------------------------------------------------------

async function extractAuditDataForPreFill(
  auditId: string | null | undefined,
): Promise<{ audit_enhancements: Record<string, unknown> | null }> {
  if (!auditId) return { audit_enhancements: null }

  try {
    const supabase = getRawClient()
    const { data: audit } = await supabase
      .from('audits')
      .select('report_data')
      .eq('id', auditId)
      .single()

    if (!audit) return { audit_enhancements: null }

    const report = (audit as { report_data: unknown } | null)?.report_data as AuditReportData | null
    if (!report) return { audit_enhancements: null }

    const enhancements: Record<string, unknown> = {}

    // Extract keywords from rankings
    if (report.rankings && Array.isArray(report.rankings) && report.rankings.length > 0) {
      const keywords = report.rankings.slice(0, 5).map((r) => r.keyword)
      enhancements.keywords_from_audit = keywords
    }

    // Extract location and industry from provider_meta
    if (report.provider_meta) {
      if (report.provider_meta.keyword_detected_location) {
        enhancements.detected_location = report.provider_meta.keyword_detected_location
      }
      if (report.provider_meta.keyword_detected_industry) {
        enhancements.detected_industry = report.provider_meta.keyword_detected_industry
      }
    }

    // Extract competitors for "interesting sites" reference
    if (report.competitors && Array.isArray(report.competitors) && report.competitors.length > 0) {
      const competitors_data = report.competitors.map((c) => ({
        url: c.url,
        domain_authority: c.domain_authority,
        keywords_ranking: c.keywords_ranking,
        top_keywords: c.top_keywords || [],
      }))
      enhancements.competitors_from_audit = competitors_data
    }

    // Store page speed metrics for builder recommendations
    if (report.page_speed) {
      enhancements.page_speed_from_audit = report.page_speed
    }

    // Store audit scores for reference
    if (report.summary) {
      enhancements.audit_scores = {
        overall: report.summary.overall_score,
        performance: report.summary.performance_score,
        seo: report.summary.seo_score,
        mobile: report.summary.mobile_score,
        accessibility: report.summary.accessibility_score,
      }
    }

    return { audit_enhancements: Object.keys(enhancements).length > 0 ? enhancements : null }
  } catch (err) {
    console.error('Error extracting audit data:', err)
    return { audit_enhancements: null }
  }
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

    // Extract audit data to pre-fill builder fields
    const { audit_enhancements } = await extractAuditDataForPreFill(auditId)

    const baseBrandConfig = {
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
    }

    // Merge audit enhancements if available
    const brand_config = audit_enhancements
      ? { ...baseBrandConfig, ...audit_enhancements }
      : baseBrandConfig

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
      brand_config,
    }

    if (tenantId) {
      // Update existing tenant
      const { error } = await updateTenantWithFallback(supabase, tenantId, payload)
      if (error) return { success: false, error: error.message }
      return { success: true, data: { tenantId } }
    } else {
      // Create new tenant
      const { id, error } = await insertTenantWithFallback(supabase, {
        ...payload,
        slug,
        package_tier: 'standard',
      })
      if (error || !id) return { success: false, error: error?.message ?? 'Tenant insert failed' }
      return { success: true, data: { tenantId: id } }
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

    // Always persist wishlist in tenant config so onboarding works even when
    // optional domain_requests migration has not been applied in an environment.
    const { data: tenantSnapshot } = await supabase
      .from('tenants')
      .select('brand_config')
      .eq('id', tenantId)
      .single()

    const existingBrandConfig = (tenantSnapshot as { brand_config: Record<string, unknown> } | null)?.brand_config ?? {}
    const normalizedWishlist = data.domains.map((d: DomainWishlistItem) => ({
      domain_name: d.domain_name,
      extension: d.extension,
      priority: d.priority,
      full_domain: `${d.domain_name}${d.extension}`,
      status: 'requested',
    }))

    const { error: wishlistPersistError } = await updateTenantWithFallback(supabase, tenantId, {
      brand_config: {
        ...existingBrandConfig,
        domain_wishlist: normalizedWishlist,
      },
      updated_at: new Date().toISOString(),
    })

    if (wishlistPersistError) {
      return { success: false, error: wishlistPersistError.message }
    }

    // Delete existing domain requests for this tenant (in case of re-submission)
    const { error: deleteError } = await supabase.from('domain_requests').delete().eq('tenant_id', tenantId)
    if (deleteError && !isMissingSchemaTable(deleteError.message, 'domain_requests')) {
      return { success: false, error: deleteError.message }
    }

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
      if (error && !isMissingSchemaTable(error.message, 'domain_requests')) {
        return { success: false, error: error.message }
      }
    }

    // Advance onboarding step
    const { error: tenantUpdateError } = await updateTenantWithFallback(supabase, tenantId, {
      onboarding_step: 3,
      updated_at: new Date().toISOString(),
    })

    if (tenantUpdateError) {
      return { success: false, error: tenantUpdateError.message }
    }

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

    const { error } = await updateTenantWithFallback(supabase, tenantId, {
      brand_config:    updatedBrandConfig,
      onboarding_step: 4,
      updated_at:      new Date().toISOString(),
    })

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

    if (error) return { success: false, error: error.message }

    // Generate and ensure review token for immediate builder access
    const tokenResult = await ensureClientReviewToken(tenantId)
    const reviewToken = tokenResult.success && tokenResult.data ? tokenResult.data : tenantId

    // Fire-and-forget to avoid blocking onboarding completion on AI latency.
    void generateAndStoreSiteVariants(tenantId)

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
    const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
    if (!url) throw new Error('NEXT_PUBLIC_WAAS_SUPABASE_URL not set')

    const supabase = getRawClient()
    const { error: bucketError } = await ensureLogosBucket(supabase)
    if (bucketError) {
      return { success: false, error: bucketError.message }
    }

    const ext         = fileName.split('.').pop() ?? 'png'
    const uploadPath  = `${tenantId}/logo.${ext}`
    const publicUrl   = `${url}/storage/v1/object/public/logos/${uploadPath}`

    return { success: true, data: { uploadPath, publicUrl } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}