// =============================================================================
// RankedCEO WaaS - TypeScript Types
// Mirrors the Supabase schema defined in migrations/waas/001 & 002
// =============================================================================

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export type WaasPackageTier = 'hosting' | 'standard' | 'premium'

export type WaasTenantStatus = 'onboarding' | 'pending_review' | 'active' | 'suspended' | 'cancelled'

export type WaasAuditStatus = 'pending' | 'running' | 'completed' | 'failed' | 'expired'

export type WaasAuditType = 'prospect' | 'tenant' | 'competitor'

// ---------------------------------------------------------------------------
// BRAND CONFIG
// ---------------------------------------------------------------------------

export interface WaasBrandColors {
  primary:    string  // hex e.g. '#2563EB'
  secondary:  string
  accent:     string
  background: string
  text:       string
}

export interface WaasBrandFonts {
  heading: string   // e.g. 'Inter'
  body:    string
}

export interface WaasBrandContact {
  phone?:   string | null
  email?:   string | null
  address?: string | null
  city?:    string | null
  state?:   string | null
  zip?:     string | null
}

export interface WaasBrandSocial {
  facebook?:  string | null
  instagram?: string | null
  google?:    string | null
  yelp?:      string | null
}

export interface WaasBrandConfig {
  business_name: string
  tagline?:      string | null
  logo_url?:     string | null
  favicon_url?:  string | null
  colors?:       Partial<WaasBrandColors>
  fonts?:        Partial<WaasBrandFonts>
  contact?:      WaasBrandContact
  social?:       WaasBrandSocial
}

// ---------------------------------------------------------------------------
// TENANT
// ---------------------------------------------------------------------------

export interface WaasTenant {
  id:                       string        // UUID
  domain:                   string | null // custom domain e.g. 'client-a.com'
  subdomain:                string | null // e.g. 'client-a' (-> client-a.rankedceo.com)
  slug:                     string        // internal identifier, URL-safe
  brand_config:             WaasBrandConfig
  package_tier:             WaasPackageTier
  status:                   WaasTenantStatus
  crm_account_id:           string | null // soft ref to CRM account
  vercel_project_id:        string | null
  domain_verified:          boolean
  domain_verified_at:       string | null // ISO timestamp
  target_industry:          string | null // e.g. 'plumbing'
  target_location:          string | null // e.g. 'Chicago, IL'
  // Onboarding fields (migration 005)
  legal_name:               string | null
  physical_address:         string | null
  city:                     string | null
  state:                    string | null
  zip:                      string | null
  primary_trade:            string | null
  source_audit_id:          string | null
  calendly_url:             string | null
  financing_enabled:        boolean
  usp:                      string | null
  onboarding_step:          number
  onboarding_completed:     boolean
  onboarding_completed_at:  string | null
  submitted_by_email:       string | null
  created_at:               string
  updated_at:               string
  deleted_at:               string | null
}

// Lightweight version returned by middleware tenant resolution (RPC)
export interface WaasTenantResolved {
  id:              string
  slug:            string
  domain:          string | null
  subdomain:       string | null
  brand_config:    WaasBrandConfig
  package_tier:    WaasPackageTier
  status:          WaasTenantStatus
  target_industry: string | null
  target_location: string | null
}

// ---------------------------------------------------------------------------
// DOMAIN REQUESTS
// ---------------------------------------------------------------------------

export type WaasDomainStatus = 'requested' | 'checking' | 'available' | 'taken' | 'registered' | 'connected'

export interface WaasDomainRequest {
  id:          string
  tenant_id:   string
  domain_name: string
  extension:   string
  full_domain: string
  status:      WaasDomainStatus
  priority:    number
  notes:       string | null
  actioned_at: string | null
  actioned_by: string | null
  created_at:  string
  updated_at:  string
}

export interface DomainWishlistItem {
  domain_name: string
  extension:   '.com' | '.net' | '.biz' | '.org' | '.co' | '.io'
  priority:    1 | 2 | 3
}

// ---------------------------------------------------------------------------
// ONBOARDING
// ---------------------------------------------------------------------------

export interface OnboardingStep1Data {
  legal_name:      string
  physical_address: string
  city:            string
  state:           string
  zip:             string
  primary_trade:   string
}

export interface OnboardingStep2Data {
  domains: DomainWishlistItem[]
}

export interface OnboardingStep3Data {
  logo_file?:      File | null
  logo_url?:       string | null
  primary_color:   string
  secondary_color: string
  business_name:   string  // used for SVG auto-generation
}

export interface OnboardingStep4Data {
  calendly_url:        string
  financing_enabled:   boolean
  usp:                 string
}

export interface OnboardingFormData {
  step1: OnboardingStep1Data
  step2: OnboardingStep2Data
  step3: OnboardingStep3Data
  step4: OnboardingStep4Data
  audit_id?:     string | null
  package_tier?: WaasPackageTier
  email?:        string
}

// For creating a new tenant
export interface CreateWaasTenantInput {
  slug:            string
  domain?:         string | null
  subdomain?:      string | null
  brand_config:    WaasBrandConfig
  package_tier?:   WaasPackageTier
  target_industry?: string | null
  target_location?: string | null
  crm_account_id?: string | null
}

// For updating a tenant
export type UpdateWaasTenantInput = Partial<Omit<CreateWaasTenantInput, 'slug'>> & {
  status?: WaasTenantStatus
}

// ---------------------------------------------------------------------------
// AUDIT REPORT DATA
// ---------------------------------------------------------------------------

export interface AuditSummary {
  overall_score:       number  // 0-100
  performance_score:   number
  seo_score:           number
  mobile_score:        number
  accessibility_score: number
}

export interface AuditRanking {
  keyword:        string
  position:       number
  url:            string
  search_volume:  number
}

export interface AuditCompetitor {
  url:               string
  domain?:           string
  domain_authority:  number
  keywords_ranking:  number
  estimated_traffic: number
  top_keywords:      string[]
}

export type AuditIssueSeverity = 'critical' | 'warning' | 'info'

export interface AuditTechnicalIssue {
  severity:    AuditIssueSeverity
  type:        string
  description: string
  url:         string
}

export interface AuditPageSpeedMetrics {
  lcp:  number   // Largest Contentful Paint (ms)
  fid:  number   // First Input Delay (ms)
  cls:  number   // Cumulative Layout Shift
  ttfb: number   // Time to First Byte (ms)
}

export interface AuditPageSpeed {
  mobile:  AuditPageSpeedMetrics
  desktop: AuditPageSpeedMetrics
}

export interface AuditBacklinks {
  total:              number
  referring_domains:  number
  domain_authority:   number
}

export type AuditOpportunityImpact = 'high' | 'medium' | 'low'

export interface AuditOpportunity {
  type:             string
  description:      string
  estimated_impact: AuditOpportunityImpact
}

export type AuditSeoProvider = 'serper' | 'dataforseo' | 'mock'

export interface AuditProviderMeta {
  provider:   AuditSeoProvider
  fetched_at: string   // ISO timestamp
  request_id: string
}

export interface AuditReportData {
  summary?:           AuditSummary
  rankings?:          AuditRanking[]
  competitors?:       AuditCompetitor[]
  technical_issues?:  AuditTechnicalIssue[]
  page_speed?:        AuditPageSpeed
  backlinks?:         AuditBacklinks
  opportunities?:     AuditOpportunity[]
  provider_meta?:     AuditProviderMeta
}

// ---------------------------------------------------------------------------
// AUDIT
// ---------------------------------------------------------------------------

export interface WaasAudit {
  id:                string
  tenant_id:         string | null
  audit_type:        WaasAuditType
  status:            WaasAuditStatus
  target_url:        string
  competitor_urls:   string[]
  report_data:       AuditReportData | null
  requestor_name:    string | null
  requestor_email:   string | null
  requestor_phone:   string | null
  requestor_company: string | null
  requested_at:      string
  started_at:        string | null
  completed_at:      string | null
  expires_at:        string
  error_message:     string | null
  retry_count:       number
  seo_provider:      AuditSeoProvider | null
  created_at:        string
  updated_at:        string
}

// Input for creating a prospect audit (public audit tool)
export interface CreateProspectAuditInput {
  target_url:         string
  competitor_urls:    string[]   // max 5
  requestor_name?:    string
  requestor_email?:   string
  requestor_phone?:   string
  requestor_company?: string
}

// Lightweight status for polling
export interface AuditStatusResult {
  id:            string
  status:        WaasAuditStatus
  report_data:   AuditReportData | null
  completed_at:  string | null
  expires_at:    string
  error_message: string | null
}

// ---------------------------------------------------------------------------
// MIDDLEWARE / ROUTING CONTEXT
// ---------------------------------------------------------------------------

// Attached to request headers for downstream consumption by tenant pages
export interface WaasRequestContext {
  tenantId:    string
  tenantSlug:  string
  brandConfig: WaasBrandConfig
  packageTier: WaasPackageTier
  industry:    string | null
  location:    string | null
}

// The header keys injected by middleware
export const WAAS_HEADERS = {
  TENANT_ID:    'x-waas-tenant-id',
  TENANT_SLUG:  'x-waas-tenant-slug',
  BRAND_CONFIG: 'x-waas-brand-config',   // JSON-encoded WaasBrandConfig
  PACKAGE_TIER: 'x-waas-package-tier',
  INDUSTRY:     'x-waas-industry',
  LOCATION:     'x-waas-location',
} as const

// ---------------------------------------------------------------------------
// PACKAGE TIER CAPABILITIES
// ---------------------------------------------------------------------------

export const PACKAGE_TIER_FEATURES: Record<WaasPackageTier, {
  label:          string
  auditTool:      boolean
  competitorAudit: boolean
  aiInsights:     boolean
  whiteLabel:     boolean
  customDomain:   boolean
  maxAuditsPerMonth: number
}> = {
  hosting: {
    label:              'Hosting',
    auditTool:          false,
    competitorAudit:    false,
    aiInsights:         false,
    whiteLabel:         false,
    customDomain:       false,
    maxAuditsPerMonth:  0,
  },
  standard: {
    label:              'Standard',
    auditTool:          true,
    competitorAudit:    true,
    aiInsights:         false,
    whiteLabel:         false,
    customDomain:       true,
    maxAuditsPerMonth:  10,
  },
  premium: {
    label:              'Premium',
    auditTool:          true,
    competitorAudit:    true,
    aiInsights:         true,
    whiteLabel:         true,
    customDomain:       true,
    maxAuditsPerMonth:  -1,  // unlimited
  },
}

// Default brand config (fallback when tenant has no config)
export const DEFAULT_BRAND_CONFIG: WaasBrandConfig = {
  business_name: 'RankedCEO',
  tagline:       'AI-Powered Local Business Marketing',
  logo_url:      null,
  favicon_url:   null,
  colors: {
    primary:    '#2563EB',
    secondary:  '#1E40AF',
    accent:     '#DBEAFE',
    background: '#FFFFFF',
    text:       '#111827',
  },
  fonts: {
    heading: 'Inter',
    body:    'Inter',
  },
}