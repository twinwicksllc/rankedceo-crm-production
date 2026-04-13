// =============================================================================
// WaaS Phase 4: Theme Utility
// Maps brand_config colors to CSS variables
// =============================================================================

import type { BrandConfig, BrandColors, CSSVariables } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Default fallback colors (used when brand_config is missing values)
// ---------------------------------------------------------------------------

const DEFAULT_COLORS: BrandColors = {
  primary:    '#2563EB',
  secondary:  '#1E40AF',
  accent:     '#DBEAFE',
  background: '#FFFFFF',
  text:       '#111827',
}

const DEFAULT_FONTS = {
  heading: 'Inter, sans-serif',
  body:    'Inter, sans-serif',
}

// ---------------------------------------------------------------------------
// Hex to RGB components (for Tailwind opacity utilities)
// e.g. '#2563EB' → '37 99 235'
// ---------------------------------------------------------------------------

export function hexToRgbComponents(hex: string): string {
  const clean = hex.replace('#', '')
  const full  = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '37 99 235'
  return `${r} ${g} ${b}`
}

// ---------------------------------------------------------------------------
// Build CSS variable map from brand_config
// ---------------------------------------------------------------------------

export function buildCSSVariables(brandConfig: BrandConfig): CSSVariables {
  const colors = {
    ...DEFAULT_COLORS,
    ...(brandConfig.colors ?? {}),
  }
  const fonts = {
    ...DEFAULT_FONTS,
    ...(brandConfig.fonts
      ? {
          heading: `${brandConfig.fonts.heading}, sans-serif`,
          body:    `${brandConfig.fonts.body}, sans-serif`,
        }
      : {}),
  }

  return {
    '--brand-primary':          colors.primary,
    '--brand-primary-rgb':      hexToRgbComponents(colors.primary),
    '--brand-secondary':        colors.secondary,
    '--brand-secondary-rgb':    hexToRgbComponents(colors.secondary),
    '--brand-accent':           colors.accent,
    '--brand-accent-rgb':       hexToRgbComponents(colors.accent),
    '--brand-background':       colors.background,
    '--brand-background-rgb':   hexToRgbComponents(colors.background),
    '--brand-text':             colors.text,
    '--brand-text-rgb':         hexToRgbComponents(colors.text),
    '--brand-font-heading':     fonts.heading,
    '--brand-font-body':        fonts.body,
  }
}

// ---------------------------------------------------------------------------
// Serialize CSS variables to a <style> tag string
// ---------------------------------------------------------------------------

export function serializeCSSVariables(vars: CSSVariables): string {
  const declarations = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  return `:root {\n${declarations}\n}`
}

// ---------------------------------------------------------------------------
// Build complete inline style string for use in Server Components
// Combines CSS variables + optional custom CSS
// ---------------------------------------------------------------------------

export function buildThemeStyleSheet(
  brandConfig: BrandConfig,
  customCss?: string | null
): string {
  const vars   = buildCSSVariables(brandConfig)
  const root   = serializeCSSVariables(vars)
  const custom = customCss ? `\n\n/* Tenant Custom CSS */\n${customCss}` : ''
  return `${root}${custom}`
}

// ---------------------------------------------------------------------------
// Get a single CSS variable value (for inline style props)
// ---------------------------------------------------------------------------

export function getBrandColor(
  brandConfig: BrandConfig,
  key: keyof BrandColors
): string {
  return brandConfig.colors?.[key] ?? DEFAULT_COLORS[key]
}