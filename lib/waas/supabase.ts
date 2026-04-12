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
  lead_id:             string | null
  admin_notified:      boolean
  admin_notified_at:   string | null
  manual_review:       boolean
  manual_review_note:  string | null
  keywords_used:       string[] | null
  location_detected:   string | null
}

// Update payload type for audits — all columns are optional
export type WaasAuditUpdate = Partial<{
  status:              WaasAuditStatus
  report_data:         AuditReportData | null
  completed_at:        string | null
  started_at:          string | null
  error_message:       string | null
  seo_provider:        AuditSeoProvider | null
  requestor_name:      string | null
  requestor_email:     string | null
  requestor_phone:     string | null
  requestor_company:   string | null
  lead_id:             string | null
  admin_notified:      boolean
  admin_notified_at:   string | null
  manual_review:       boolean
  manual_review_note:  string | null
  keywords_used:       string[] | null
  location_detected:   string | null
  updated_at:          string
}>

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

// ---------------------------------------------------------------------------
// Database type (generated from Supabase schema — extend as needed)
// ---------------------------------------------------------------------------

export interface WaasDatabase {
  public: {
    Tables: {
      tenants: {
        Row:    WaasTenant
        Insert: Omit<WaasTenant, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WaasTenant, 'id' | 'created_at'>>
      }
      audits: {
        Row:    WaasAuditRow
        Insert: Omit<WaasAudit, 'id' | 'created_at' | 'updated_at'>
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
          p_target_url:         string
          p_competitor_urls:    string[]
          p_requestor_name?:    string
          p_requestor_email?:   string
          p_requestor_phone?:   string
          p_requestor_company?: string
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
          p_email:         string
          p_audit_id:      string
          p_name:          string | null
          p_phone:         string | null
          p_company:       string | null
          p_target_url:    string | null
          p_industry:      string | null
          p_location:      string | null
          p_utm_source:    string | null
          p_utm_medium:    string | null
          p_utm_campaign:  string | null
          p_referrer_url:  string | null
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

function getWaasServiceEnvVars() {
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
// CLIENT-SIDE: Anon key client (browser + public API routes)
// ---------------------------------------------------------------------------

let _waasClient: SupabaseClient<WaasDatabase> | null = null

export function getWaasClient(): SupabaseClient<WaasDatabase> {
  if (_waasClient) return _waasClient

  const { url, anon } = getWaasEnvVars()

  _waasClient = createClient<WaasDatabase>(url, anon, {
    auth: {
      persistSession: false,  // WaaS doesn't use Supabase Auth for tenant visitors
      autoRefreshToken: false,
    },
  })

  return _waasClient
}

// Alias for server-side usage (same as getWaasClient but clearer naming for SSR pages)
export const createWaasClient = getWaasClient

// ---------------------------------------------------------------------------
// SERVER-SIDE: Service role client (API routes, admin operations)
// Bypasses RLS — use with extreme caution, server-side only.
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
// Avoids singleton issues in Edge middleware (different runtime context)
// ---------------------------------------------------------------------------

export function createWaasMiddlewareClient(): SupabaseClient<WaasDatabase> {
  const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY

  if (!url || !anon) {
    // In middleware, we can't throw — return null-safe client or skip
    throw new Error('[WaaS Middleware] Missing WAAS Supabase env vars')
  }

  return createClient<WaasDatabase>(url, anon, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
    // Use fetch with no-cache for fresh tenant resolution in edge
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

// ---------------------------------------------------------------------------
// TENANT RESOLUTION: Core lookup used by middleware
// ---------------------------------------------------------------------------

/**
 * Resolve a tenant from a hostname.
 * Calls the `resolve_tenant_by_hostname` Postgres RPC function.
 *
 * @param hostname - The full hostname including port if present (e.g. 'client-a.rankedceo.com:3000')
 * @returns The resolved tenant or null if not found
 */
export async function resolveTenantByHostname(
  hostname: string
): Promise<WaasTenantResolved | null> {
  try {
    const supabase = createWaasMiddlewareClient()

    const { data, error } = await supabase
      .rpc('resolve_tenant_by_hostname', { p_hostname: hostname })

    if (error) {
      console.error('[WaaS] Tenant resolution error:', error.message)
      return null
    }

    if (!data || data.length === 0) return null

    return data[0] as WaasTenantResolved
  } catch (err) {
    console.error('[WaaS] Tenant resolution exception:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// LEAD HELPERS
// ---------------------------------------------------------------------------

/**
 * Capture a lead via the capture_audit_lead RPC.
 * Uses an untyped client internally to avoid Supabase 2.x ExactMatch
 * arg resolution issues with destructured `any` values from req.json().
 */
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
    const { url, serviceRole } = getWaasServiceEnvVars()
    // Use untyped client to bypass Supabase 2.x ExactMatch RPC arg resolution
    const client = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

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
// AUDIT HELPERS
// ---------------------------------------------------------------------------

/**
 * Create a prospect audit (called from public /audit tool)
 */
export async function createProspectAudit(input: {
  target_url:         string
  competitor_urls:    string[]
  requestor_name?:    string
  requestor_email?:   string
  requestor_phone?:   string
  requestor_company?: string
}): Promise<string | null> {
  try {
    const supabase = getWaasClient()

    const { data, error } = await supabase.rpc('create_prospect_audit', {
      p_target_url:         input.target_url,
      p_competitor_urls:    input.competitor_urls,
      p_requestor_name:     input.requestor_name,
      p_requestor_email:    input.requestor_email,
      p_requestor_phone:    input.requestor_phone,
      p_requestor_company:  input.requestor_company,
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

/**
 * Poll for audit status (for client-side polling after submission)
 */
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
    const supabase = getWaasClient()

    const { data, error } = await supabase
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