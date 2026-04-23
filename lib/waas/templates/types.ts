// =============================================================================
// WaaS Phase 4: Template Engine Types
// =============================================================================

// ---------------------------------------------------------------------------
// Section identifiers
// ---------------------------------------------------------------------------

export type SectionId =
  | 'hero'
  | 'services'
  | 'trust'
  | 'financing'
  | 'booking'
  | 'reviews'

// ---------------------------------------------------------------------------
// Section configuration (per-section render options)
// ---------------------------------------------------------------------------

export interface SectionConfig {
  section:  SectionId
  enabled:  boolean
  order:    number
  config:   Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Site template (master template definition)
// ---------------------------------------------------------------------------

export interface SiteTemplate {
  id:                  string
  name:                string
  slug:                'modern' | 'bold' | 'trust-first' | string
  description:         string | null
  preview_image_url:   string | null
  default_layout_json: SectionConfig[]
  base_css:            string | null
  is_active:           boolean
  is_default:          boolean
  created_at:          string
  updated_at:          string
}

// ---------------------------------------------------------------------------
// Tenant site config (per-tenant customization)
// ---------------------------------------------------------------------------

export interface TenantSiteConfig {
  id:                   string
  tenant_id:            string
  template_id:          string | null
  active_sections_json: SectionConfig[]
  custom_css:           string | null
  meta_title:           string | null
  meta_description:     string | null
  og_image_url:         string | null
  client_review_token:  string | null
  client_selected_template_slug: string | null
  client_selected_at:   string | null
  deployment_url:       string | null
  deployed_at:          string | null
  last_preview_at:      string | null
  created_at:           string
  updated_at:           string
}

// ---------------------------------------------------------------------------
// Brand config (from tenants.brand_config JSONB)
// ---------------------------------------------------------------------------

export interface BrandColors {
  primary:    string   // hex, e.g. '#2563EB'
  secondary:  string
  accent:     string
  background: string
  text:       string
}

export interface BrandContact {
  phone:   string | null
  email:   string | null
  address: string | null
  city:    string | null
  state:   string | null
  zip:     string | null
}

export interface BrandSocial {
  facebook:  string | null
  instagram: string | null
  google:    string | null
  yelp:      string | null
}

export interface BrandConfig {
  business_name: string
  tagline:       string | null
  logo_url:      string | null
  favicon_url:   string | null
  colors:        BrandColors
  fonts?: {
    heading: string
    body:    string
  }
  contact:       BrandContact
  social?:       BrandSocial
}

// ---------------------------------------------------------------------------
// Resolved tenant data (used by renderer)
// ---------------------------------------------------------------------------

export interface ResolvedTenant {
  id:              string
  slug:            string
  subdomain:       string | null
  domain:          string | null
  brand_config:    BrandConfig
  package_tier:    string
  status:          string
  target_industry: string | null
  target_location: string | null
  // Onboarding fields
  legal_name:          string | null
  primary_trade:       string | null
  usp:                 string | null
  calendly_url:        string | null
  financing_enabled:   boolean
  // Audit linkage
  source_audit_id:     string | null
}

// ---------------------------------------------------------------------------
// CSS variable map (injected into <style> tag)
// ---------------------------------------------------------------------------

export interface CSSVariables {
  '--brand-primary':     string
  '--brand-secondary':   string
  '--brand-accent':      string
  '--brand-background':  string
  '--brand-text':        string
  '--brand-font-heading': string
  '--brand-font-body':   string
  [key: string]: string
}

// ---------------------------------------------------------------------------
// Theme names
// ---------------------------------------------------------------------------

export type ThemeName = 'modern' | 'bold' | 'trust-first'