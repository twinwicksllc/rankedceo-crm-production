'use server'

// =============================================================================
// AdvantagePoint - Admin Server Actions
// Protected actions for Tom & Darrick's Command Center
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { WaasTenant, WaasDomainRequest } from '@/lib/waas/types'
import { ALL_TEMPLATES } from '@/lib/waas/templates/registry'
import { recommendTemplates, type TemplateRecommendation } from '@/lib/waas/services/template-recommender'

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

// ---------------------------------------------------------------------------
// Get all pending + active tenants for the dashboard table
// ---------------------------------------------------------------------------

export async function getAdminTenants(): Promise<ActionResult<WaasTenant[]>> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .in('status', ['pending_review', 'onboarding', 'active'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as WaasTenant[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Get a single tenant with domain requests and audit data
// ---------------------------------------------------------------------------

export interface TenantDetailData {
  tenant:         WaasTenant
  domainRequests: WaasDomainRequest[]
  audit:          Record<string, unknown> | null
}

export async function getTenantDetail(tenantId: string): Promise<ActionResult<TenantDetailData>> {
  try {
    const supabase = getAdminClient()

    // Fetch tenant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()
    if (tErr) return { success: false, error: tErr.message }

    // Fetch domain requests
    const { data: domains } = await supabase
      .from('domain_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('priority', { ascending: true })

    // Fetch linked audit if present
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

    return {
      success: true,
      data: {
        tenant:         tenantRow,
        domainRequests: (domains ?? []) as WaasDomainRequest[],
        audit,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Deploy Site: Toggle tenant status to 'active'
// This is the action Tom/Darrick trigger to go live
// ---------------------------------------------------------------------------

export async function deploySite(tenantId: string): Promise<ActionResult> {
  try {
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('tenants')
      .update({
        status:     'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/dashboard')
    revalidatePath(`/admin/dashboard/${tenantId}`)
    return { success: true }
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

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}