// =============================================================================
// IndustryContentPack — per-trade content data
//
// Each content pack provides trade-specific copy that is used by
// generateInitialSiteFromTemplate() to pre-fill services, FAQs, hero copy
// patterns, and SEO keyword clusters when the tenant's own intake data is
// sparse or absent.
//
// Philosophy:
//   • Content packs are fallback / enrichment data, not overrides.
//   • Tenant-supplied data (from brand_config.intake_profile) always wins.
//   • Packs guarantee a fully-populated Tier 1 build even before Tier 2 AI.
// =============================================================================

// ---------------------------------------------------------------------------
// ServiceItem — one offering displayed in the Services section
// ---------------------------------------------------------------------------

export interface ServiceItem {
  /** Short label shown as the card/tile title */
  title: string;
  /** One-sentence description (personalised by the generator at build time) */
  description: string;
  /** Optional emoji icon (displayed in card if template supports it) */
  icon?: string;
}

// ---------------------------------------------------------------------------
// FaqItem — one Q&A pair
// ---------------------------------------------------------------------------

export interface FaqItem {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// HeroCopyPattern — strategy-keyed hero copy snippets
//
// The generation service picks the variant matching the template's
// seo_strategy: 'emergency' | 'consultative' | 'portfolio' | 'informational'
// | 'conversion' | 'standard'.
// ---------------------------------------------------------------------------

export type SeoStrategy =
  | "emergency"
  | "consultative"
  | "portfolio"
  | "informational"
  | "conversion"
  | "standard";

export interface HeroCopyVariant {
  /** Short badge above the headline, e.g. "24/7 Emergency Plumber" */
  eyebrow: string;
  /** 4–8 word USP-style headline */
  headline: string;
  /** Supporting sub-headline (1–2 sentences) */
  subheadline: string;
  /** Primary CTA button label */
  ctaLabel: string;
}

export type HeroCopyPatterns = Partial<Record<SeoStrategy, HeroCopyVariant>>;

// ---------------------------------------------------------------------------
// SeoKeywordCluster — keyword sets used for meta, alt text, and Tier 2 prompt
// ---------------------------------------------------------------------------

export interface SeoKeywordCluster {
  /** 3–5 broad head terms, e.g. ["plumber", "plumbing services"] */
  headTerms: string[];
  /**
   * 4–8 mid-tail phrases, e.g. ["emergency plumber near me",
   * "licensed plumber for hire"]
   */
  midTail: string[];
  /**
   * 4–8 long-tail/conversion phrases, e.g.
   * ["burst pipe repair same day", "water heater replacement cost"]
   */
  longTail: string[];
  /**
   * Local-intent modifiers appended to head terms during Tier 2 prompt
   * construction, e.g. ["near me", "in [city]", "local"]
   */
  localModifiers: string[];
}

// ---------------------------------------------------------------------------
// IndustryContentPack — the full data shape for one trade
// ---------------------------------------------------------------------------

export interface IndustryContentPack {
  /** Canonical trade identifier matching WaasTenant.primary_trade */
  trade: string;

  /**
   * Human-readable display label used in UI, e.g. "Plumbing Services".
   * Also used as the Services section headline when no custom headline exists.
   */
  displayName: string;

  /**
   * Default services list (6–10 items).
   * Used when tenant.brand_config.intake_profile.services_offered is empty.
   * The generator may trim to the first 6.
   */
  defaultServices: ServiceItem[];

  /**
   * Default FAQ items (4–6 items).
   * Merged with the generated FAQ — pack items are appended after
   * strategy-specific items, deduplicated by question text.
   */
  defaultFaqs: FaqItem[];

  /** Strategy-keyed hero copy patterns */
  heroCopyPatterns: HeroCopyPatterns;

  /** SEO keyword clusters for meta enrichment and Tier 2 prompting */
  seoKeywords: SeoKeywordCluster;

  /**
   * Short trust-bar copy snippets (2–4 items) shown in the trust/stats section.
   * E.g. ["Licensed & Insured", "Same-Day Service", "5-Star Rated"]
   */
  trustSignals: string[];

  /**
   * Suggested Unsplash search queries for hero background images.
   * Used by the future hero-image feature and Tier 2 image search prompts.
   */
  heroImageQueries: string[];
}
