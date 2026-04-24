'use server'

// =============================================================================
// AdvantagePoint - Admin Server Actions
// Protected actions for Tom & Darrick's Command Center
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { WaasTenant, WaasDomainRequest } from '@/lib/waas/types'
import { ALL_TEMPLATES, getTemplate } from '@/lib/waas/templates/registry'
import { recommendTemplates, type TemplateRecommendation } from '@/lib/waas/services/template-recommender'
import type { TenantSiteConfig, SectionConfig, SectionId } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Raw service-role client
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase admin env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface ActionResult<T = null> {
  success: boolean
  data?:   T
  error?:  string
}

export interface AdminTenantListItem extends WaasTenant {
  client_selected_template_slug?: string | null
  client_selected_at?: string | null
  client_review_token?: string | null
}

export interface TenantSiteVersion {
  id: string
  change_source: string
  summary: string | null
  template_slug: string | null
  created_at: string
}

export interface TenantDetailData {
  tenant:         WaasTenant
  domainRequests: WaasDomainRequest[]
  audit:          Record<string, unknown> | null
  siteConfig:     (TenantSiteConfig & { site_templates?: { slug: string } | null }) | null
  versions:       TenantSiteVersion[]
}

export interface DeployReadinessCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface DeployPackageSummary {
  selectedTemplateSlug: string | null
  enabledSections: string[]
  sectionCount: number
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  contactHooks: {
    hasCalendly: boolean
    hasPhone: boolean
    hasEmail: boolean
  }
  clientSelection: {
    templateSlug: string | null
    selectedAt: string | null
    feedbackSubmittedAt: string | null
    mixSubmittedAt: string | null
  }
}

export interface DeployReadinessReport {
  ready: boolean
  checks: DeployReadinessCheck[]
  blockers: string[]
  packageSummary: DeployPackageSummary
}

// ---------------------------------------------------------------------------
// Get all pending + active tenants for the dashboard table
// ---------------------------------------------------------------------------

export async function getAdminTenants(): Promise<ActionResult<AdminTenantListItem[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .in('status', ['pending_review', 'onboarding', 'active'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    const tenants = (data ?? []) as WaasTenant[]
    if (tenants.length === 0) {
      return { success: true, data: [] }
    }

    const tenantIds = tenants.map(item => item.id)
    const { data: siteConfigRows } = await supabase
      .from('tenant_site_config')
      .select('tenant_id, client_review_token, client_selected_template_slug, client_selected_at')
      .in('tenant_id', tenantIds)

    const siteConfigMap = new Map<string, {
      client_review_token?: string | null
      client_selected_template_slug?: string | null
      client_selected_at?: string | null
    }>()

    for (const row of (siteConfigRows ?? []) as Array<Record<string, unknown>>) {
      const tenantId = row.tenant_id as string | undefined
      if (!tenantId) continue
      siteConfigMap.set(tenantId, {
        client_review_token: (row.client_review_token as string | null | undefined) ?? null,
        client_selected_template_slug: (row.client_selected_template_slug as string | null | undefined) ?? null,
        client_selected_at: (row.client_selected_at as string | null | undefined) ?? null,
      })
    }

    const enriched = tenants.map((tenant) => ({
      ...tenant,
      ...siteConfigMap.get(tenant.id),
    }))

    return { success: true, data: enriched }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Get a single tenant with domain requests and audit data
// ---------------------------------------------------------------------------

export async function getTenantDetail(tenantId: string): Promise<ActionResult<TenantDetailData>> {
  try {
    const supabase = getAdminClient()

    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()
    if (tErr) return { success: false, error: tErr.message }

    const { data: domains } = await supabase
      .from('domain_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('priority', { ascending: true })

    const tenantRow = tenant as WaasTenant
    let audit: Record<string, unknown> | null = null
    if (tenantRow.source_audit_id) {
      const { data: auditData } = await supabase
        .from('audits')
        .select('id, status, report_data, target_url, competitor_urls, completed_at')
        .eq('id', tenantRow.source_audit_id)
        .single()
      audit = auditData as Record<string, unknown> | null
    }

    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('*, site_templates(slug)')
      .eq('tenant_id', tenantId)
      .single()

    const { data: versionsRows } = await supabase
      .from('tenant_site_versions')
      .select('id, change_source, summary, template_slug, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      success: true,
      data: {
        tenant:         tenantRow,
        domainRequests: (domains ?? []) as WaasDomainRequest[],
        audit,
        siteConfig: (siteConfig as (TenantSiteConfig & { site_templates?: { slug: string } | null }) | null) ?? null,
        versions: (versionsRows ?? []) as TenantSiteVersion[],
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

function toSectionConfigList(value: unknown): SectionConfig[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SectionConfig => {
    if (!item || typeof item !== 'object') return false
    const row = item as Record<string, unknown>
    return typeof row.section === 'string' && typeof row.enabled === 'boolean' && typeof row.order === 'number' && typeof row.config === 'object' && row.config !== null
  })
}

function getCoreSectionFailures(enabledSections: string[]): string[] {
  const required = ['hero', 'services', 'booking']
  return required.filter((section) => !enabledSections.includes(section))
}

export async function getDeployReadiness(tenantId: string): Promise<ActionResult<DeployReadinessReport>> {
  try {
    const supabase = getAdminClient()

    const [{ data: tenant, error: tenantError }, { data: siteConfig, error: configError }] = await Promise.all([
      supabase
        .from('tenants')
        .select('id, slug, domain, subdomain, calendly_url, submitted_by_email, brand_config')
        .eq('id', tenantId)
        .single(),
      supabase
        .from('tenant_site_config')
        .select('meta_title, meta_description, og_image_url, custom_css, active_sections_json, template_id, client_selected_template_slug, client_selected_at, client_feedback_submitted_at, client_mix_submitted_at, site_templates(slug, default_layout_json)')
        .eq('tenant_id', tenantId)
        .single(),
    ])

    if (tenantError || !tenant) {
      return { success: false, error: tenantError?.message ?? 'Tenant not found' }
    }

    if (configError || !siteConfig) {
      return { success: false, error: configError?.message ?? 'Tenant site configuration not found' }
    }

    const tenantRow = tenant as Record<string, unknown>
    const configRow = siteConfig as Record<string, unknown>
    const siteTemplate = (configRow.site_templates as Record<string, unknown> | null | undefined) ?? null

    const templateDefaultSections = toSectionConfigList(siteTemplate?.default_layout_json)
    const activeSections = toSectionConfigList(configRow.active_sections_json)
    const resolvedSections = activeSections.length > 0 ? activeSections : templateDefaultSections
    const enabledSections = resolvedSections.filter((section) => section.enabled).map((section) => section.section)

    const metaTitle = typeof configRow.meta_title === 'string' ? configRow.meta_title.trim() : ''
    const metaDescription = typeof configRow.meta_description === 'string' ? configRow.meta_description.trim() : ''
    const ogImageUrl = typeof configRow.og_image_url === 'string' ? configRow.og_image_url.trim() : ''
    const customCss = typeof configRow.custom_css === 'string' ? configRow.custom_css : ''

    const brandConfig = (tenantRow.brand_config as Record<string, unknown> | null | undefined) ?? null
    const brandContact = (brandConfig?.contact as Record<string, unknown> | null | undefined) ?? null
    const phone = typeof brandContact?.phone === 'string' ? brandContact.phone.trim() : ''
    const email = typeof brandContact?.email === 'string' ? brandContact.email.trim() : ''
    const calendly = typeof tenantRow.calendly_url === 'string' ? tenantRow.calendly_url.trim() : ''
    const submittedByEmail = typeof tenantRow.submitted_by_email === 'string' ? tenantRow.submitted_by_email.trim() : ''

    const coreSectionFailures = getCoreSectionFailures(enabledSections)

    const checks: DeployReadinessCheck[] = [
      {
        id: 'template_selected',
        label: 'Template linked',
        status: configRow.template_id ? 'pass' : 'fail',
        detail: configRow.template_id ? 'Template and site config are linked.' : 'No template is linked to tenant site config.',
      },
      {
        id: 'meta_title',
        label: 'Meta title present',
        status: metaTitle.length >= 20 ? 'pass' : 'fail',
        detail: metaTitle.length >= 20
          ? `Meta title length looks good (${metaTitle.length} chars).`
          : 'Meta title must be at least 20 characters before deploy.',
      },
      {
        id: 'meta_description',
        label: 'Meta description present',
        status: metaDescription.length >= 70 ? 'pass' : 'fail',
        detail: metaDescription.length >= 70
          ? `Meta description length looks good (${metaDescription.length} chars).`
          : 'Meta description must be at least 70 characters before deploy.',
      },
      {
        id: 'core_sections',
        label: 'Core sections enabled',
        status: coreSectionFailures.length === 0 ? 'pass' : 'fail',
        detail: coreSectionFailures.length === 0
          ? 'Hero, services, and booking sections are enabled.'
          : `Missing required enabled sections: ${coreSectionFailures.join(', ')}.`,
      },
      {
        id: 'performance_css_budget',
        label: 'Custom CSS budget',
        status: customCss.length <= 12000 ? 'pass' : 'fail',
        detail: customCss.length <= 12000
          ? `Custom CSS size is within budget (${customCss.length} chars).`
          : `Custom CSS exceeds budget (${customCss.length} chars > 12000).`,
      },
      {
        id: 'performance_section_count',
        label: 'Section count guard',
        status: enabledSections.length <= 6 ? 'pass' : 'warn',
        detail: enabledSections.length <= 6
          ? `Enabled sections count is ${enabledSections.length}.`
          : `Enabled sections count is high (${enabledSections.length}); consider simplifying for performance.`,
      },
      {
        id: 'og_image',
        label: 'Open Graph image',
        status: ogImageUrl ? 'pass' : 'warn',
        detail: ogImageUrl
          ? 'Open Graph image is set.'
          : 'Open Graph image is missing; social previews may be weaker.',
      },
      {
        id: 'contact_hooks',
        label: 'Contact hook present',
        status: calendly || phone || email || submittedByEmail ? 'pass' : 'fail',
        detail: calendly || phone || email || submittedByEmail
          ? 'At least one contact hook is configured.'
          : 'No Calendly, phone, or email contact hook found.',
      },
    ]

    const blockers = checks.filter((check) => check.status === 'fail').map((check) => `${check.label}: ${check.detail}`)

    const packageSummary: DeployPackageSummary = {
      selectedTemplateSlug: (siteTemplate?.slug as string | undefined) ?? null,
      enabledSections,
      sectionCount: enabledSections.length,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      ogImageUrl: ogImageUrl || null,
      contactHooks: {
        hasCalendly: Boolean(calendly),
        hasPhone: Boolean(phone),
        hasEmail: Boolean(email || submittedByEmail),
      },
      clientSelection: {
        templateSlug: (configRow.client_selected_template_slug as string | null | undefined) ?? null,
        selectedAt: (configRow.client_selected_at as string | null | undefined) ?? null,
        feedbackSubmittedAt: (configRow.client_feedback_submitted_at as string | null | undefined) ?? null,
        mixSubmittedAt: (configRow.client_mix_submitted_at as string | null | undefined) ?? null,
      },
    }

    return {
      success: true,
      data: {
        ready: blockers.length === 0,
        checks,
        blockers,
        packageSummary,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function deploySite(tenantId: string, deployedBy = 'admin_console'): Promise<ActionResult<{ deploymentId: string | null }>> {
  try {
    const supabase = getAdminClient()

    const readiness = await getDeployReadiness(tenantId)
    if (!readiness.success || !readiness.data) {
      return { success: false, error: readiness.error ?? 'Unable to validate deploy readiness' }
    }

    if (!readiness.data.ready) {
      return {
        success: false,
        error: `Deploy blocked. Resolve required checks first: ${readiness.data.blockers.join(' | ')}`,
      }
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug, domain, subdomain')
      .eq('id', tenantId)
      .single()

    const tenantRow = (tenant ?? {}) as Record<string, unknown>
    const domain = typeof tenantRow.domain === 'string' ? tenantRow.domain.trim() : ''
    const subdomain = typeof tenantRow.subdomain === 'string' ? tenantRow.subdomain.trim() : ''
    const slug = typeof tenantRow.slug === 'string' ? tenantRow.slug.trim() : ''

    const deploymentUrl = domain
      ? `https://${domain}`
      : subdomain
        ? `https://${subdomain}`
        : slug
          ? `https://${slug}`
          : null

    const deployedAt = new Date().toISOString()
    const [{ error: tenantUpdateError }, { error: configUpdateError }] = await Promise.all([
      supabase
        .from('tenants')
        .update({
          status: 'active',
          updated_at: deployedAt,
        })
        .eq('id', tenantId),
      supabase
        .from('tenant_site_config')
        .update({
          deployment_url: deploymentUrl,
          deployed_at: deployedAt,
          updated_at: deployedAt,
        })
        .eq('tenant_id', tenantId),
    ])

    if (tenantUpdateError) return { success: false, error: tenantUpdateError.message }
    if (configUpdateError) return { success: false, error: configUpdateError.message }

    const deployedVersionId = await saveTenantSiteVersion(
      tenantId,
      'site_deployed',
      `Deployment completed by ${deployedBy}`,
    )

    let deploymentId: string | null = null
    try {
      const { data: deploymentRow } = await supabase
        .from('tenant_site_deployments')
        .insert({
          tenant_id: tenantId,
          deployed_by: deployedBy,
          source_version_id: deployedVersionId,
          deployment_payload_json: readiness.data.packageSummary,
          created_at: deployedAt,
        })
        .select('id')
        .single()

      deploymentId = (deploymentRow as { id?: string } | null)?.id ?? null
    } catch {
      // Backward-safe: if migration is not applied yet, deployment still succeeds.
    }

    revalidatePath('/admin/dashboard')
    revalidatePath(`/admin/dashboard/${tenantId}`)
    return { success: true, data: { deploymentId } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Update domain request status
// ---------------------------------------------------------------------------

export async function updateDomainStatus(
  requestId: string,
  status: WaasDomainRequest['status'],
  notes?: string,
): Promise<ActionResult> {
  try {
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('domain_requests')
      .update({
        status,
        notes:       notes ?? null,
        actioned_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('id', requestId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Admin stats for dashboard header cards
// ---------------------------------------------------------------------------

export interface AdminStats {
  pendingCount: number
  activeCount:  number
  totalLeads:   number
}

export async function generateTemplateRecommendations(
  tenantId: string
): Promise<ActionResult<TemplateRecommendation[]>> {
  try {
    const supabase = getAdminClient()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('brand_config, target_industry, target_location, usp, calendly_url, financing_enabled')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      return { success: false, error: error?.message ?? 'Tenant not found' }
    }

    const brandConfig = (tenant as { brand_config?: Record<string, unknown> }).brand_config ?? {}

    const recommendations = await recommendTemplates(
      {
        businessName: typeof brandConfig.business_name === 'string' ? brandConfig.business_name : 'Business',
        industry: (tenant as { target_industry?: string | null }).target_industry ?? null,
        location: (tenant as { target_location?: string | null }).target_location ?? null,
        usp: (tenant as { usp?: string | null }).usp ?? null,
        financingEnabled: Boolean((tenant as { financing_enabled?: boolean | null }).financing_enabled),
        hasBooking: Boolean((tenant as { calendly_url?: string | null }).calendly_url),
        tone: typeof brandConfig.tone === 'string' ? brandConfig.tone : null,
      },
      ALL_TEMPLATES,
    )

    return { success: true, data: recommendations }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function getAdminStats(): Promise<ActionResult<AdminStats>> {
  try {
    const supabase = getAdminClient()

    const [pendingRes, activeRes, leadsRes] = await Promise.all([
      supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
    ])

    return {
      success: true,
      data: {
        pendingCount: pendingRes.count ?? 0,
        activeCount:  activeRes.count  ?? 0,
        totalLeads:   leadsRes.count   ?? 0,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Apply template to tenant site config
// Creates or updates tenant_site_config with the selected template
// ---------------------------------------------------------------------------

export async function applyTemplate(
  tenantId:     string,
  templateSlug: string
): Promise<ActionResult<void>> {
  'use server'
  try {
    const supabase = getAdminClient()

    // Look up template id from site_templates table
    const { data: template, error: tplError } = await supabase
      .from('site_templates')
      .select('id, default_layout_json')
      .eq('slug', templateSlug)
      .single()

    if (tplError || !template) {
      // Fallback: use slug as id (registry-only mode without DB templates)
      const { error: upsertError } = await supabase
        .from('tenant_site_config')
        .upsert(
          {
            tenant_id:            tenantId,
            template_id:          null,
            active_sections_json: [],
            updated_at:           new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
      if (upsertError) throw new Error(upsertError.message)
    } else {
      const { error: upsertError } = await supabase
        .from('tenant_site_config')
        .upsert(
          {
            tenant_id:            tenantId,
            template_id:          template.id,
            active_sections_json: [],   // empty = use template defaults
            updated_at:           new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
      if (upsertError) throw new Error(upsertError.message)
    }

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath('/_sites', 'layout')
    await saveTenantSiteVersion(tenantId, 'template_applied', `Applied template ${templateSlug}`)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

function generateReviewToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

async function saveTenantSiteVersion(
  tenantId: string,
  source: string,
  summary?: string,
): Promise<string | null> {
  try {
    const supabase = getAdminClient()
    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('template_id, active_sections_json, custom_css, meta_title, meta_description, og_image_url, client_selected_template_slug, client_selected_at, client_feedback_tone, client_feedback_cta_intensity, client_feedback_layout_preference, client_feedback_notes, client_feedback_submitted_at, client_mix_source_templates, client_mix_submitted_at, deployment_url, deployed_at, last_preview_at, site_templates(slug)')
      .eq('tenant_id', tenantId)
      .single()

    if (!siteConfig) return null

    const row = siteConfig as Record<string, unknown>
    const templateSlug = (row.site_templates as { slug?: string } | null | undefined)?.slug ?? null

    const snapshot = {
      template_id: row.template_id ?? null,
      active_sections_json: row.active_sections_json ?? [],
      custom_css: row.custom_css ?? null,
      meta_title: row.meta_title ?? null,
      meta_description: row.meta_description ?? null,
      og_image_url: row.og_image_url ?? null,
      client_selected_template_slug: row.client_selected_template_slug ?? null,
      client_selected_at: row.client_selected_at ?? null,
      client_feedback_tone: row.client_feedback_tone ?? null,
      client_feedback_cta_intensity: row.client_feedback_cta_intensity ?? null,
      client_feedback_layout_preference: row.client_feedback_layout_preference ?? null,
      client_feedback_notes: row.client_feedback_notes ?? null,
      client_feedback_submitted_at: row.client_feedback_submitted_at ?? null,
      client_mix_source_templates: row.client_mix_source_templates ?? [],
      client_mix_submitted_at: row.client_mix_submitted_at ?? null,
      deployment_url: row.deployment_url ?? null,
      deployed_at: row.deployed_at ?? null,
      last_preview_at: row.last_preview_at ?? null,
    }

    const { data: inserted } = await supabase
      .from('tenant_site_versions')
      .insert({
        tenant_id: tenantId,
        change_source: source,
        summary: summary ?? null,
        template_slug: templateSlug,
        snapshot_json: snapshot,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    return (inserted as { id?: string } | null)?.id ?? null
  } catch {
    // Backward-safe: if migration not applied, skip version write.
    return null
  }
}

export async function ensureClientReviewToken(tenantId: string): Promise<ActionResult<string>> {
  try {
    const supabase = getAdminClient()
    const { data: existing } = await supabase
      .from('tenant_site_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    const existingToken = (existing as { client_review_token?: string | null } | null)?.client_review_token
    if (existingToken && typeof existingToken === 'string') {
      return { success: true, data: existingToken }
    }

    const newToken = generateReviewToken()

    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      active_sections_json: (existing as { active_sections_json?: unknown } | null)?.active_sections_json ?? [],
      updated_at: new Date().toISOString(),
      client_review_token: newToken,
    }

    const { error } = await supabase
      .from('tenant_site_config')
      .upsert(payload, { onConflict: 'tenant_id' })

    if (error) {
      // Backward-safe fallback until migration 010 is applied.
      return { success: true, data: tenantId }
    }

    return { success: true, data: newToken }
  } catch {
    return { success: true, data: tenantId }
  }
}

export interface ClientReviewSession {
  tenantId: string
  slug: string
  businessName: string
  selectedTemplateSlug: string | null
  reviewToken: string
  feedback: ClientVariantFeedback
  mix: ClientVariantMix
  versions: ClientReviewVersion[]
}

export interface ClientVariantFeedback {
  tone: string | null
  ctaIntensity: string | null
  layoutPreference: string | null
  notes: string | null
  submittedAt: string | null
}

export interface ClientVariantMix {
  sourceTemplates: string[]
  submittedAt: string | null
}

export interface ClientReviewVersion {
  id: string
  changeSource: string
  summary: string | null
  templateSlug: string | null
  createdAt: string
}

export async function getClientReviewSession(reviewKey: string): Promise<ActionResult<ClientReviewSession>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id, client_selected_template_slug, client_review_token')
      .eq('client_review_token', reviewKey)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      // Legacy fallback: allow direct tenant ID URLs.
      const { data: byTenantId } = await supabase
        .from('tenant_site_config')
        .select('tenant_id, client_selected_template_slug, client_review_token')
        .eq('tenant_id', reviewKey)
        .single()
      if (byTenantId) {
        tenantId = (byTenantId as { tenant_id: string }).tenant_id
      }
    }

    if (!tenantId) {
      // Last-resort fallback: treat review key as tenant ID and proceed.
      tenantId = reviewKey
    }

    const tokenResult = await ensureClientReviewToken(tenantId)
    const safeToken = tokenResult.data ?? reviewKey

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, brand_config')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return { success: false, error: tenantError?.message ?? 'Tenant not found' }
    }

    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('client_selected_template_slug, client_feedback_tone, client_feedback_cta_intensity, client_feedback_layout_preference, client_feedback_notes, client_feedback_submitted_at, client_mix_source_templates, client_mix_submitted_at')
      .eq('tenant_id', tenantId)
      .single()

    const { data: versionsRows } = await supabase
      .from('tenant_site_versions')
      .select('id, change_source, summary, template_slug, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(12)

    const brandConfig = (tenant as { brand_config?: Record<string, unknown> }).brand_config ?? {}
    const businessName = typeof brandConfig.business_name === 'string'
      ? brandConfig.business_name
      : 'Your Business'

    return {
      success: true,
      data: {
        tenantId,
        slug: (tenant as { slug: string }).slug,
        businessName,
        selectedTemplateSlug: (siteConfig as { client_selected_template_slug?: string | null } | null)?.client_selected_template_slug ?? null,
        reviewToken: safeToken,
        feedback: {
          tone: (siteConfig as { client_feedback_tone?: string | null } | null)?.client_feedback_tone ?? null,
          ctaIntensity: (siteConfig as { client_feedback_cta_intensity?: string | null } | null)?.client_feedback_cta_intensity ?? null,
          layoutPreference: (siteConfig as { client_feedback_layout_preference?: string | null } | null)?.client_feedback_layout_preference ?? null,
          notes: (siteConfig as { client_feedback_notes?: string | null } | null)?.client_feedback_notes ?? null,
          submittedAt: (siteConfig as { client_feedback_submitted_at?: string | null } | null)?.client_feedback_submitted_at ?? null,
        },
        mix: {
          sourceTemplates: (siteConfig as { client_mix_source_templates?: string[] | null } | null)?.client_mix_source_templates ?? [],
          submittedAt: (siteConfig as { client_mix_submitted_at?: string | null } | null)?.client_mix_submitted_at ?? null,
        },
        versions: ((versionsRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id ?? ''),
          changeSource: String(row.change_source ?? 'unknown_change'),
          summary: (row.summary as string | null | undefined) ?? null,
          templateSlug: (row.template_slug as string | null | undefined) ?? null,
          createdAt: String(row.created_at ?? new Date().toISOString()),
        })),
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export async function selectClientVariantByReviewToken(
  reviewToken: string,
  templateSlug: string,
  feedback?: {
    tone?: string | null
    ctaIntensity?: string | null
    layoutPreference?: string | null
    notes?: string | null
  }
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id')
      .eq('client_review_token', reviewToken)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      // Legacy fallback for pre-token links.
      tenantId = reviewToken
    }

    const apply = await applyTemplate(tenantId, templateSlug)
    if (!apply.success) {
      return { success: false, error: apply.error ?? 'Failed to apply template' }
    }

    const metadataUpdate: Record<string, unknown> = {
      client_selected_template_slug: templateSlug,
      client_selected_at: new Date().toISOString(),
      client_feedback_tone: feedback?.tone ?? null,
      client_feedback_cta_intensity: feedback?.ctaIntensity ?? null,
      client_feedback_layout_preference: feedback?.layoutPreference ?? null,
      client_feedback_notes: feedback?.notes?.trim() ? feedback.notes.trim().slice(0, 3000) : null,
      client_feedback_submitted_at: new Date().toISOString(),
      client_mix_source_templates: null,
      client_mix_submitted_at: null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('tenant_site_config')
      .update(metadataUpdate)
      .eq('tenant_id', tenantId)

    if (error) {
      // Keep backward compatibility if migration 010 has not yet been applied.
      revalidatePath(`/admin/dashboard/${tenantId}`)
      revalidatePath(`/review/${reviewToken}`)
      return { success: true }
    }

    await saveTenantSiteVersion(
      tenantId,
      'client_selected_variant',
      `Client selected ${templateSlug} with feedback preferences`,
    )

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function mixClientVariantsByReviewToken(
  reviewToken: string,
  primaryTemplateSlug: string,
  mixSourceTemplates: string[],
  feedback?: {
    tone?: string | null
    ctaIntensity?: string | null
    layoutPreference?: string | null
    notes?: string | null
  }
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id')
      .eq('client_review_token', reviewToken)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      tenantId = reviewToken
    }

    const apply = await applyTemplate(tenantId, primaryTemplateSlug)
    if (!apply.success) {
      return { success: false, error: apply.error ?? 'Failed to apply mixed template direction' }
    }

    const normalizedMix = Array.from(new Set(mixSourceTemplates.filter(Boolean))).slice(0, 3)

    const metadataUpdate: Record<string, unknown> = {
      client_selected_template_slug: primaryTemplateSlug,
      client_selected_at: new Date().toISOString(),
      client_feedback_tone: feedback?.tone ?? null,
      client_feedback_cta_intensity: feedback?.ctaIntensity ?? null,
      client_feedback_layout_preference: feedback?.layoutPreference ?? null,
      client_feedback_notes: feedback?.notes?.trim() ? feedback.notes.trim().slice(0, 3000) : null,
      client_feedback_submitted_at: new Date().toISOString(),
      client_mix_source_templates: normalizedMix,
      client_mix_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('tenant_site_config')
      .update(metadataUpdate)
      .eq('tenant_id', tenantId)

    if (error) {
      revalidatePath(`/admin/dashboard/${tenantId}`)
      revalidatePath(`/review/${reviewToken}`)
      return { success: true }
    }

    const mixSummary = normalizedMix.length
      ? `Client selected ${primaryTemplateSlug} mixed with ${normalizedMix.join(', ')}`
      : `Client selected ${primaryTemplateSlug} as mixed direction`

    await saveTenantSiteVersion(tenantId, 'client_mixed_variant', mixSummary)

    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

function setSectionConfig(
  sections: SectionConfig[],
  sectionId: SectionId,
  changes: Partial<SectionConfig>,
): SectionConfig[] {
  return sections.map((section) => {
    if (section.section !== sectionId) return section
    return {
      ...section,
      ...changes,
      config: {
        ...section.config,
        ...(changes.config ?? {}),
      },
    }
  })
}

function normalizeSectionOrder(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index + 1 }))
}

export async function regenerateSelectedVariantByReviewToken(
  reviewToken: string,
  preferredTemplateSlug?: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()

    let tenantId: string | null = null
    const { data: byToken } = await supabase
      .from('tenant_site_config')
      .select('tenant_id')
      .eq('client_review_token', reviewToken)
      .single()

    if (byToken) {
      tenantId = (byToken as { tenant_id: string }).tenant_id
    } else {
      tenantId = reviewToken
    }

    const { data: siteConfig } = await supabase
      .from('tenant_site_config')
      .select('template_id, client_selected_template_slug, client_feedback_tone, client_feedback_cta_intensity, client_feedback_layout_preference, client_mix_source_templates, site_templates(slug)')
      .eq('tenant_id', tenantId)
      .single()

    const row = (siteConfig ?? {}) as Record<string, unknown>
    const linkedTemplateSlug = (row.site_templates as { slug?: string } | null | undefined)?.slug ?? null
    const selectedTemplateSlug = (row.client_selected_template_slug as string | null | undefined) ?? null
    const baseTemplateSlug = preferredTemplateSlug?.trim() || selectedTemplateSlug || linkedTemplateSlug || 'modern'

    const tone = (row.client_feedback_tone as string | null | undefined) ?? null
    const ctaIntensity = (row.client_feedback_cta_intensity as string | null | undefined) ?? null
    const layoutPreference = (row.client_feedback_layout_preference as string | null | undefined) ?? null
    const mixSourceTemplates = (row.client_mix_source_templates as string[] | null | undefined) ?? []

    let regeneratedSections = getTemplate(baseTemplateSlug).default_layout_json.map((section) => ({
      ...section,
      config: { ...section.config },
    }))

    // Tone adjustments
    if (tone === 'professional' || tone === 'premium') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'trust', {
        enabled: true,
        config: { variant: 'full-width' },
      })
    }
    if (tone === 'friendly') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'centered' },
      })
    }
    if (tone === 'direct') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'split' },
      })
    }

    // CTA intensity adjustments
    if (ctaIntensity === 'soft') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'booking', {
        config: { variant: 'inline' },
      })
      regeneratedSections = setSectionConfig(regeneratedSections, 'financing', {
        enabled: false,
      })
    }
    if (ctaIntensity === 'strong') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'booking', {
        config: { variant: 'modal-trigger' },
      })
      regeneratedSections = setSectionConfig(regeneratedSections, 'financing', {
        enabled: true,
      })
    }

    // Layout preference adjustments
    if (layoutPreference === 'compact') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'services', {
        config: { columns: 2 },
      })
    }
    if (layoutPreference === 'spacious') {
      regeneratedSections = setSectionConfig(regeneratedSections, 'services', {
        config: { columns: 3 },
      })
    }

    // Mix influence adjustments
    if (mixSourceTemplates.includes('bold')) {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'split' },
      })
      regeneratedSections = setSectionConfig(regeneratedSections, 'financing', {
        enabled: true,
      })
    }
    if (mixSourceTemplates.includes('trust-first')) {
      regeneratedSections = setSectionConfig(regeneratedSections, 'reviews', {
        enabled: true,
        order: 2,
      })
    }
    if (mixSourceTemplates.includes('modern')) {
      regeneratedSections = setSectionConfig(regeneratedSections, 'hero', {
        config: { variant: 'centered' },
      })
    }

    regeneratedSections = normalizeSectionOrder(regeneratedSections)

    const { error: updateError } = await supabase
      .from('tenant_site_config')
      .update({
        active_sections_json: regeneratedSections,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await saveTenantSiteVersion(
      tenantId,
      'client_regenerated_variant',
      `Regenerated ${baseTemplateSlug} using saved feedback${mixSourceTemplates.length ? ` and mix (${mixSourceTemplates.join(', ')})` : ''}`,
    )

    revalidatePath('/admin/dashboard')
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath(`/review/${reviewToken}`)
    revalidatePath('/_sites', 'layout')
    revalidatePath(`/_preview/${tenantId}`)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function rollbackTenantSiteVersion(
  tenantId: string,
  versionId: string,
): Promise<ActionResult<void>> {
  try {
    const supabase = getAdminClient()
    const { data: versionRow, error: versionError } = await supabase
      .from('tenant_site_versions')
      .select('snapshot_json, template_slug')
      .eq('id', versionId)
      .eq('tenant_id', tenantId)
      .single()

    if (versionError || !versionRow) {
      return { success: false, error: versionError?.message ?? 'Version snapshot not found' }
    }

    const row = versionRow as { snapshot_json?: Record<string, unknown> | null; template_slug?: string | null }
    const snapshot = row.snapshot_json ?? {}

    let templateId = (snapshot.template_id as string | null | undefined) ?? null
    if (!templateId && row.template_slug) {
      const { data: template } = await supabase
        .from('site_templates')
        .select('id')
        .eq('slug', row.template_slug)
        .single()
      templateId = (template as { id?: string } | null)?.id ?? null
    }

    const payload: Record<string, unknown> = {
      template_id: templateId,
      active_sections_json: snapshot.active_sections_json ?? [],
      custom_css: snapshot.custom_css ?? null,
      meta_title: snapshot.meta_title ?? null,
      meta_description: snapshot.meta_description ?? null,
      og_image_url: snapshot.og_image_url ?? null,
      client_selected_template_slug: snapshot.client_selected_template_slug ?? null,
      client_selected_at: snapshot.client_selected_at ?? null,
      client_feedback_tone: snapshot.client_feedback_tone ?? null,
      client_feedback_cta_intensity: snapshot.client_feedback_cta_intensity ?? null,
      client_feedback_layout_preference: snapshot.client_feedback_layout_preference ?? null,
      client_feedback_notes: snapshot.client_feedback_notes ?? null,
      client_feedback_submitted_at: snapshot.client_feedback_submitted_at ?? null,
      client_mix_source_templates: snapshot.client_mix_source_templates ?? [],
      client_mix_submitted_at: snapshot.client_mix_submitted_at ?? null,
      deployment_url: snapshot.deployment_url ?? null,
      deployed_at: snapshot.deployed_at ?? null,
      last_preview_at: snapshot.last_preview_at ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('tenant_site_config')
      .update(payload)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await saveTenantSiteVersion(tenantId, 'rollback_applied', 'Rolled back to a previous site configuration version')

    revalidatePath('/admin/dashboard')
    revalidatePath(`/admin/dashboard/${tenantId}`)
    revalidatePath('/_sites', 'layout')
    revalidatePath(`/_preview/${tenantId}`)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}