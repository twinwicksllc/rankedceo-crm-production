export interface InitialSiteBuildResult {
  /** true when Tier 1 deterministic build succeeded and was persisted */
  tier1Success: boolean
  /** true when Gemini enhancement has been dispatched (will complete async) */
  tier2Dispatched: boolean
  /** The template slug that was used */
  templateSlug: string
  /** Any non-fatal message for diagnostics */
  message?: string
}

// ---------------------------------------------------------------------------
// Internal generation profile (same shape as generate-site-content)
// ---------------------------------------------------------------------------

export interface GenerationProfile {
  businessName:      string
  trade:             string
  industry:          string
  location:          string
  usp:               string
  tagline:           string
  primaryCta:        string
  aboutNarrative:    string
  valuePropositions: string[]
  keyPhrases:        string[]
  targetAudience:    string
  tone:              string
  serviceArea:       string
  /**
   * Services list — populated from intake data when available,
   * otherwise falls back to the industry content pack defaults.
   */
  services:          string[]
  /**
   * Resolved display name for this trade from the content pack
   * (e.g. "Plumbing Services"). Used in section headlines.
   */
  tradeDisplayName:  string
  /**
   * Trust signals from the content pack — short strings shown in
   * the trust / stats bar section.
   */
  trustSignals:      string[]
}
