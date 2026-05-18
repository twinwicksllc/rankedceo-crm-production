// =============================================================================
// WaaS Template Engine Types
// PR #92 — Extended with template metadata for industry-aware selection,
// SEO hints, and aesthetic categorisation for the self-service builder.
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
  | 'about'
  | 'faq'
  | 'how-it-works'
  | 'gallery'        // Phase 7.3

export interface HeroSectionContent {
  eyebrow?: string
  headline?: string
  subheadline?: string
  primaryCtaLabel?: string
  secondaryCtaLabel?: string
  locationBadge?: string
}

export interface ServiceItemContent {
  title: string
  description?: string
  icon?: string
}

export interface ServicesSectionContent {
  eyebrow?: string
  headline?: string
  subheadline?: string
  items?: ServiceItemContent[]
  bottomCtaText?: string
}

export interface TrustBadgeContent {
  icon?: string
  label: string
  sub?: string
}

export interface TrustSectionContent {
  headline?: string
  subheadline?: string
  badges?: TrustBadgeContent[]
}

export interface AboutSectionContent {
  eyebrow?: string
  headline?: string
  body?: string
  highlights?: string[]
}

export interface FAQItemContent {
  question: string
  answer: string
}

export interface FAQSectionContent {
  eyebrow?: string
  headline?: string
  intro?: string
  items?: FAQItemContent[]
}

export interface ProcessStepContent {
  title: string
  description: string
}

export interface HowItWorksSectionContent {
  eyebrow?: string
  headline?: string
  intro?: string
  steps?: ProcessStepContent[]
}

export interface BookingSectionContent {
  eyebrow?: string
  headline?: string
  subheadline?: string
  primaryCtaLabel?: string
}

export interface ReviewsSectionContent {
  eyebrow?: string
  headline?: string
  subheadline?: string
}

// Phase 7.3: Gallery section
export interface GalleryItemContent {
  image_url: string
  caption?:  string | null
  alt?:      string | null
}

export interface GallerySectionContent {
  eyebrow?:  string
  headline?: string
  items?:    GalleryItemContent[]
}

export type SectionContent =
  | HeroSectionContent
  | ServicesSectionContent
  | TrustSectionContent
  | AboutSectionContent
  | FAQSectionContent
  | HowItWorksSectionContent
  | BookingSectionContent
  | ReviewsSectionContent
  | GallerySectionContent

// ---------------------------------------------------------------------------
// Section configuration (per-section render options)
// ---------------------------------------------------------------------------

export interface SectionConfig {
  section:  SectionId
  enabled:  boolean
  order:    number
  config:   Record<string, unknown>
  content?: SectionContent
}

// ---------------------------------------------------------------------------
// Template aesthetic categories
// Used for filtering in the template picker UI.
// ---------------------------------------------------------------------------

export type TemplateAesthetic =
  | 'clean'       // minimal whitespace-forward
  | 'bold'        // high-contrast, aggressive
  | 'trust'       // credentials/reviews-heavy
  | 'local'       // neighbourhood, friendly
  | 'premium'     // editorial, refined
  | 'urgent'      // emergency/fast-response
  | 'visual'      // image/gallery-led
  | 'process'     // education, how-it-works
  | 'community'   // warm, story-driven
  | 'conversion'  // booking/CTA-first

// ---------------------------------------------------------------------------
// SEO strategy hint — tells the AI generator how to weight keyword placement
// ---------------------------------------------------------------------------

export type SeoStrategy =
  | 'local-service'    // "[City] [Trade]" keyword clusters, NAP prominence
  | 'trust-authority'  // credentials, certifications, reviews for E-E-A-T
  | 'visual-portfolio' // alt-text on gallery, project schema
  | 'emergency'        // urgency keywords, 24/7 phrases, fast-response schema
  | 'consultative'     // FAQ schema, how-to content, long-form
  | 'conversion'       // booking schema, CTA density, offer keywords

// ---------------------------------------------------------------------------
// Site template (master template definition)
// Extended in PR #92 with aesthetic metadata, industry fit, and SEO hints.
// ---------------------------------------------------------------------------

export interface SiteTemplate {
  id:                  string
  name:                string
  slug:                string
  description:         string | null

  // --- PR #92 additions ---

  /** Short marketing tagline shown on the template card */
  tagline:             string

  /** One-word aesthetic category for UI filtering */
  aesthetic:           TemplateAesthetic

  /** Mood/feel shown as a subtitle on the template card (2–4 words) */
  mood:                string

  /**
   * Ordered list of primary_trade values this template is BEST suited for.
   * Used to determine the "Recommended for you" 3-card shortlist.
   * Empty array = universal (no specific industry bias).
   */
  industry_fit:        string[]

  /**
   * Secondary trades where this template also works well.
   * Used to populate the "View all" expanded library with relevance sorting.
   */
  industry_also_good:  string[]

  /**
   * SEO strategy this template is optimised for.
   * Passed to the AI generator to weight keyword placement, schema type,
   * and meta description patterns accordingly.
   */
  seo_strategy:        SeoStrategy

  /**
   * Comma-separated list of schema.org types to emit for this template.
   * e.g. "LocalBusiness,Plumber" or "HomeAndConstructionBusiness,RoofingContractor"
   */
  schema_types:        string[]

  /**
   * Key feature highlights shown on the template card (max 4 bullet points).
   */
  feature_highlights:  string[]

  /**
   * Hex colour suggestions for the preview swatch — NOT the user's brand colours,
   * just a representative palette so the card looks good before the user picks theirs.
   */
  preview_palette: {
    primary:    string
    secondary:  string
    accent:     string
    background: string
  }

  // --- existing fields ---

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

  // -------------------------------------------------------------------------
  // PR #103 — WaaS SEO: keyword injection
  // AI-generated keyword clusters stored per-tenant for <meta> injection and
  // structured data enrichment.
  // -------------------------------------------------------------------------
  /** Ordered keyword phrases (max 20). Injected into <meta name="keywords">. */
  seo_keywords:              string[] | null
  /** Provider that produced seo_keywords: 'gemini' | 'perplexity' | 'fallback' */
  seo_keywords_provider:     string | null
  /** When seo_keywords were last generated. null = never generated. */
  seo_last_generated_at:     string | null

  client_review_token:  string | null
  client_selected_template_slug: string | null
  client_selected_at:   string | null
  client_feedback_tone: string | null
  client_feedback_cta_intensity: string | null
  client_feedback_layout_preference: string | null
  client_feedback_notes: string | null
  client_feedback_submitted_at: string | null
  client_mix_source_templates: string[] | null
  client_mix_submitted_at: string | null
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
  hero_image_url?: string | null   // Phase 7.2 — full-bleed hero background photo
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
// Theme names — updated to include all 10 templates
// ---------------------------------------------------------------------------

export type ThemeName =
  | 'modern'
  | 'bold'
  | 'trust-first'
  | 'local-pro'
  | 'premium'
  | 'emergency'
  | 'showcase'
  | 'consultative'
  | 'community'
  | 'conversion'
