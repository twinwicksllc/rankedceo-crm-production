// =============================================================================
// RankedCEO WaaS - Supabase Client
// IMPORTANT: This connects to the SEPARATE WaaS Supabase project,
// NOT the main CRM Supabase project.
//
// CRM:  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// WaaS: NEXT_PUBLIC_WAAS_SUPABASE_URL / NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  WaasTenant,
  WaasTenantResolved,
  WaasAudit,
  WaasAuditStatus,
  AuditSeoProvider,
  AuditReportData,
} from './types'

// ---------------------------------------------------------------------------
// Extended audit row — includes columns added in migrations 003 & 004
// ---------------------------------------------------------------------------

export interface WaasAuditRow extends WaasAudit {
  lead_id:            string | null
  admin_notified:     boolean
  admin_notified_at:  string | null
  manual_review:      boolean
  manual_review_note: string | null
  keywords_used:      string[] | null
  location_detected:  string | null
}

// Typed update payload for audits
export type WaasAuditUpdate = Partial<{
  status:             WaasAuditStatus
  report_data:        AuditReportData | null
  completed_at:       string | null
  started_at:         string | null
  expires_at:         string
  error_message:      string | null
  seo_provider:       AuditSeoProvider | null
  requestor_name:     string | null
  requestor_email:    string | null
  requestor_phone:    string | null
  requestor_company:  string | null
  lead_id:            string | null
  admin_notified:     boolean
  admin_notified_at:  string | null
  manual_review:      boolean
  manual_review_note: string | null
  keywords_used:      string[] | null
  location_detected:  string | null
  updated_at:         string
}>

// Typed insert payload for audits
export type WaasAuditInsert = {
  audit_type:        WaasAudit['audit_type']
  status:            WaasAuditStatus
  target_url:        string
  competitor_urls:   string[]
  tenant_id?:        string | null
  requestor_name?:   string | null
  requestor_email?:  string | null
  requestor_phone?:  string | null
  requestor_company?: string | null
  started_at?:       string | null
  expires_at:        string
  seo_provider?:     AuditSeoProvider | null
  requested_at?:     string
  retry_count?:      number
}

// Lead row — added in migration 003
export interface WaasLead {
  id:           string
  email:        string
  audit_id:     string | null
  name:         string | null
  phone:        string | null
  company:      string | null
  target_url:   string | null
  industry:     string | null
  location:     string | null
  utm_source:   string | null
  utm_medium:   string | null
  utm_campaign: string | null
  referrer_url: string | null
  created_at:   string
  updated_at:   string
}

// Typed update payload for tenants
export type WaasTenantUpdate = Partial<{
  domain:             string | null
  subdomain:          string | null
  brand_config:       WaasTenant['brand_config']
  package_tier:       WaasTenant['package_tier']
  status:             WaasTenant['status']
  target_industry:    string | null
  target_location:    string | null
  crm_account_id:     string | null
  vercel_project_id:  string | null
  domain_verified:    boolean
  domain_verified_at: string | null
  deleted_at:         string | null
  updated_at:         string
}>

// Typed insert payload for tenants
export type WaasTenantInsert = {
  slug:             string
  domain?:          string | null
  subdomain?:       string | null
  brand_config:     WaasTenant['brand_config']
  package_tier?:    WaasTenant['package_tier']
  status?:          WaasTenant['status']
  target_industry?: string | null
  target_location?: string | null
  crm_account_id?:  string | null
  domain_verified?: boolean
}

// ---------------------------------------------------------------------------
// Database type — used to type the Supabase client for READ operations
// ---------------------------------------------------------------------------

export interface WaasDatabase {
  public: {
    Tables: {
      tenants: {
        Row:    WaasTenant
        Insert: WaasTenantInsert
        Update: WaasTenantUpdate
      }
      audits: {
        Row:    WaasAuditRow
        Insert: WaasAuditInsert
        Update: WaasAuditUpdate
      }
      leads: {
        Row:    WaasLead
        Insert: Omit<WaasLead, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WaasLead, 'id' | 'created_at'>>
      }
    }
    Functions: {
      resolve_tenant_by_hostname: {
        Args:    { p_hostname: string }
        Returns: WaasTenantResolved[]
      }
      create_prospect_audit: {
        Args: {
          p_target_url:        string
          p_competitor_urls:   string[]
          p_requestor_name:    string | null
          p_requestor_email:   string | null
          p_requestor_phone:   string | null
          p_requestor_company: string | null
        }
        Returns: string  // UUID
      }
      get_audit_status: {
        Args:    { p_audit_id: string }
        Returns: Array<{
          id:            string
          status:        string
          report_data:   Record<string, unknown> | null
          completed_at:  string | null
          expires_at:    string
          error_message: string | null
        }>
      }
      capture_audit_lead: {
        Args: {
          p_email:        string
          p_audit_id:     string
          p_name:         string | null
          p_phone:        string | null
          p_company:      string | null
          p_target_url:   string | null
          p_industry:     string | null
          p_location:     string | null
          p_utm_source:   string | null
          p_utm_medium:   string | null
          p_utm_campaign: string | null
          p_referrer_url: string | null
        }
        Returns: string  // lead UUID
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Validate required env vars at module load time
// ---------------------------------------------------------------------------

function getWaasEnvVars() {
  const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error(
      '[WaaS] Missing required environment variables:\n' +
      '  NEXT_PUBLIC_WAAS_SUPABASE_URL\n' +
      '  NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY\n' +
      'Add these to your .env.local for the WaaS Supabase project.'
    )
  }

  return { url, anon }
}

export function getWaasServiceEnvVars() {
  const url         = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const serviceRole = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error(
      '[WaaS] Missing required server-only environment variables:\n' +
      '  NEXT_PUBLIC_WAAS_SUPABASE_URL\n' +
      '  WAAS_SUPABASE_SERVICE_ROLE_KEY\n' +
      'These must be set in Vercel environment variables (server-side only).'
    )
  }

  return { url, serviceRole }
}

// ---------------------------------------------------------------------------
// Raw (untyped) admin client — used for DML operations to avoid
// Supabase 2.x ExactMatch type inference issues with complex payloads.
// ---------------------------------------------------------------------------

function getRawAdminClient() {
  const { url, serviceRole } = getWaasServiceEnvVars()
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// CLIENT-SIDE: Anon key client (browser + public API routes)
// ---------------------------------------------------------------------------

let _waasClient: SupabaseClient<WaasDatabase> | null = null

export function getWaasClient(): SupabaseClient<WaasDatabase> {
  if (_waasClient) return _waasClient

  const { url, anon } = getWaasEnvVars()

  _waasClient = createClient<WaasDatabase>(url, anon, {
    auth: {
      persistSession:  false,
      autoRefreshToken: false,
    },
  })

  return _waasClient
}

// Alias for server-side usage
export const createWaasClient = getWaasClient

// ---------------------------------------------------------------------------
// SERVER-SIDE: Typed service role client (for SELECT queries)
// ---------------------------------------------------------------------------

let _waasAdminClient: SupabaseClient<WaasDatabase> | null = null

export function getWaasAdminClient(): SupabaseClient<WaasDatabase> {
  if (_waasAdminClient) return _waasAdminClient

  const { url, serviceRole } = getWaasServiceEnvVars()

  _waasAdminClient = createClient<WaasDatabase>(url, serviceRole, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
  })

  return _waasAdminClient
}

// ---------------------------------------------------------------------------
// MIDDLEWARE: Lightweight anon client for edge runtime tenant resolution
// ---------------------------------------------------------------------------

export function createWaasMiddlewareClient(): SupabaseClient<WaasDatabase> {
  const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('[WaaS Middleware] Missing WAAS Supabase env vars')
  }

  return createClient<WaasDatabase>(url, anon, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

// ---------------------------------------------------------------------------
// TENANT RESOLUTION
// ---------------------------------------------------------------------------

export async function resolveTenantByHostname(
  hostname: string
): Promise<WaasTenantResolved | null> {
  try {
    const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY
    if (!url || !anon) return null

    // Use raw untyped client to bypass Supabase 2.x ExactMatch RPC arg resolution
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    })

    const { data, error } = await client
      .rpc('resolve_tenant_by_hostname', { p_hostname: hostname })

    if (error) {
      console.error('[WaaS] Tenant resolution error:', error.message)
      return null
    }

    if (!data || (data as unknown[]).length === 0) return null
    return (data as unknown[])[0] as WaasTenantResolved
  } catch (err) {
    console.error('[WaaS] Tenant resolution exception:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// AUDIT DML HELPERS
// All write operations use the raw untyped client to avoid Supabase 2.x
// ExactMatch type inference issues. Read operations use the typed client.
// ---------------------------------------------------------------------------

export async function createAuditRecord(insert: WaasAuditInsert): Promise<string | null> {
  try {
    const client = getRawAdminClient()
    const { data, error } = await client
      .from('audits')
      .insert(insert)
      .select('id')
      .single()

    if (error) {
      console.error('[WaaS] createAuditRecord error:', error.message)
      return null
    }
    return (data as { id: string }).id
  } catch (err) {
    console.error('[WaaS] createAuditRecord exception:', err)
    return null
  }
}

export async function updateAuditRecord(
  auditId: string,
  update: WaasAuditUpdate
): Promise<boolean> {
  try {
    const client = getRawAdminClient()
    const { error } = await client
      .from('audits')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', auditId)

    if (error) {
      console.error('[WaaS] updateAuditRecord error:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[WaaS] updateAuditRecord exception:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// TENANT DML HELPERS
// ---------------------------------------------------------------------------

export async function createTenantRecord(insert: WaasTenantInsert): Promise<WaasTenant | null> {
  try {
    const client = getRawAdminClient()
    const { data, error } = await client
      .from('tenants')
      .insert({
        ...insert,
        status:          insert.status          ?? 'onboarding',
        package_tier:    insert.package_tier     ?? 'hosting',
        domain_verified: insert.domain_verified  ?? false,
      })
      .select()
      .single()

    if (error) {
      console.error('[WaaS] createTenantRecord error:', error.message)
      throw error
    }
    return data as WaasTenant
  } catch (err) {
    console.error('[WaaS] createTenantRecord exception:', err)
    throw err
  }
}

export async function updateTenantRecord(
  tenantId: string,
  update: WaasTenantUpdate
): Promise<WaasTenant | null> {
  try {
    const client = getRawAdminClient()
    const { data, error } = await client
      .from('tenants')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('[WaaS] updateTenantRecord error:', error.message)
      throw error
    }
    return data as WaasTenant
  } catch (err) {
    console.error('[WaaS] updateTenantRecord exception:', err)
    throw err
  }
}

export async function softDeleteTenant(tenantId: string): Promise<boolean> {
  try {
    const client = getRawAdminClient()
    const { error } = await client
      .from('tenants')
      .update({
        deleted_at: new Date().toISOString(),
        status:     'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .is('deleted_at', null)

    if (error) {
      console.error('[WaaS] softDeleteTenant error:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[WaaS] softDeleteTenant exception:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// LEAD HELPERS
// ---------------------------------------------------------------------------

export async function captureAuditLead(input: {
  email:        string
  audit_id:     string
  name:         string | null
  phone:        string | null
  company:      string | null
  target_url:   string | null
  industry:     string | null
  location:     string | null
  utm_source:   string | null
  utm_medium:   string | null
  utm_campaign: string | null
  referrer_url: string | null
}): Promise<{ leadId: string | null; error: string | null }> {
  try {
    const client = getRawAdminClient()
    const { data, error } = await client.rpc('capture_audit_lead', {
      p_email:        input.email,
      p_audit_id:     input.audit_id,
      p_name:         input.name,
      p_phone:        input.phone,
      p_company:      input.company,
      p_target_url:   input.target_url,
      p_industry:     input.industry,
      p_location:     input.location,
      p_utm_source:   input.utm_source,
      p_utm_medium:   input.utm_medium,
      p_utm_campaign: input.utm_campaign,
      p_referrer_url: input.referrer_url,
    })

    if (error) return { leadId: null, error: error.message }
    return { leadId: data as string, error: null }
  } catch (err) {
    return { leadId: null, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// AUDIT READ HELPERS
// ---------------------------------------------------------------------------

export async function createProspectAudit(input: {
  target_url:         string
  competitor_urls:    string[]
  requestor_name?:    string
  requestor_email?:   string
  requestor_phone?:   string
  requestor_company?: string
}): Promise<string | null> {
  try {
    const client = getRawAdminClient()
    const { data, error } = await client.rpc('create_prospect_audit', {
      p_target_url:        input.target_url,
      p_competitor_urls:   input.competitor_urls,
      p_requestor_name:    input.requestor_name    ?? null,
      p_requestor_email:   input.requestor_email   ?? null,
      p_requestor_phone:   input.requestor_phone   ?? null,
      p_requestor_company: input.requestor_company ?? null,
    })

    if (error) {
      console.error('[WaaS] Create audit error:', error.message)
      return null
    }

    return data as string
  } catch (err) {
    console.error('[WaaS] Create audit exception:', err)
    return null
  }
}

export interface AuditStatusResult {
  id:            string
  status:        'pending' | 'running' | 'completed' | 'failed' | 'expired'
  report_data:   Record<string, unknown> | null
  completed_at:  string | null
  expires_at:    string
  error_message: string | null
}

export async function getAuditStatus(auditId: string): Promise<AuditStatusResult | null> {
  try {
    const client = getRawAdminClient()
    const { data, error } = await client
      .rpc('get_audit_status', { p_audit_id: auditId })

    if (error) {
      console.error('[WaaS] Get audit status error:', error.message)
      return null
    }

    if (!data || data.length === 0) return null
    return data[0] as AuditStatusResult
  } catch (err) {
    console.error('[WaaS] Get audit status exception:', err)
    return null
  }
}