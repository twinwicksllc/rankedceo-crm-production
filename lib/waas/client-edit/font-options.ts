// =============================================================================
// lib/waas/client-edit/font-options.ts
//
// Curated list of Google Fonts suitable for trades / home-service businesses.
// Each entry has:
//   - slug:         stored in brand_config.fonts.heading / .body
//   - label:        shown in the picker UI
//   - googleFamily: exact Google Fonts family name (used to build the <link> URL)
//   - category:     'sans-serif' | 'serif' | 'display' — used to group options
//
// The `slug` is intentionally the same as `googleFamily` (URL-safe) so the
// ThemeProvider can construct the Google Fonts URL without a lookup table.
//
// Phase 7.1
// =============================================================================

export interface FontOption {
  slug:         string   // e.g. 'Inter'
  label:        string   // e.g. 'Inter'
  googleFamily: string   // e.g. 'Inter' (exact Google Fonts name)
  category:     'sans-serif' | 'serif' | 'display'
  weights:      string   // e.g. '400;600;700' — requested weights
}

export const FONT_OPTIONS: FontOption[] = [
  // ── Sans-serif (clean, modern — best for most trades) ──────────────────────
  {
    slug:         'Inter',
    label:        'Inter',
    googleFamily: 'Inter',
    category:     'sans-serif',
    weights:      '400;500;600;700',
  },
  {
    slug:         'Poppins',
    label:        'Poppins',
    googleFamily: 'Poppins',
    category:     'sans-serif',
    weights:      '400;500;600;700',
  },
  {
    slug:         'Montserrat',
    label:        'Montserrat',
    googleFamily: 'Montserrat',
    category:     'sans-serif',
    weights:      '400;600;700;800',
  },
  {
    slug:         'Nunito',
    label:        'Nunito',
    googleFamily: 'Nunito',
    category:     'sans-serif',
    weights:      '400;600;700',
  },
  {
    slug:         'Lato',
    label:        'Lato',
    googleFamily: 'Lato',
    category:     'sans-serif',
    weights:      '400;700',
  },
  {
    slug:         'Open Sans',
    label:        'Open Sans',
    googleFamily: 'Open+Sans',
    category:     'sans-serif',
    weights:      '400;600;700',
  },
  {
    slug:         'Roboto',
    label:        'Roboto',
    googleFamily: 'Roboto',
    category:     'sans-serif',
    weights:      '400;500;700',
  },
  {
    slug:         'Source Sans 3',
    label:        'Source Sans 3',
    googleFamily: 'Source+Sans+3',
    category:     'sans-serif',
    weights:      '400;600;700',
  },
  // ── Display / Impactful (great for bold headings) ───────────────────────────
  {
    slug:         'Oswald',
    label:        'Oswald',
    googleFamily: 'Oswald',
    category:     'display',
    weights:      '400;500;600;700',
  },
  {
    slug:         'Raleway',
    label:        'Raleway',
    googleFamily: 'Raleway',
    category:     'display',
    weights:      '400;600;700;800',
  },
  // ── Serif (premium / trust-building) ────────────────────────────────────────
  {
    slug:         'Playfair Display',
    label:        'Playfair Display',
    googleFamily: 'Playfair+Display',
    category:     'serif',
    weights:      '400;600;700',
  },
  {
    slug:         'Merriweather',
    label:        'Merriweather',
    googleFamily: 'Merriweather',
    category:     'serif',
    weights:      '400;700',
  },
]

// Default slugs (fallback when brand_config.fonts is not set)
export const DEFAULT_HEADING_FONT = 'Inter'
export const DEFAULT_BODY_FONT    = 'Inter'

// Lookup helpers
export function getFontOption(slug: string): FontOption | undefined {
  return FONT_OPTIONS.find((f) => f.slug === slug)
}

// Build a Google Fonts stylesheet URL for a set of family slugs.
// e.g. buildGoogleFontsUrl(['Inter', 'Poppins'])
//   → 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap'
export function buildGoogleFontsUrl(slugs: string[]): string | null {
  const unique = [...new Set(slugs.filter(Boolean))]
  if (unique.length === 0) return null

  const families = unique
    .map((slug) => {
      const opt = getFontOption(slug)
      if (!opt) return null
      return `family=${opt.googleFamily}:wght@${opt.weights}`
    })
    .filter((x): x is string => x !== null)

  if (families.length === 0) return null

  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}
