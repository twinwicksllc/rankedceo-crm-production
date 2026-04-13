// =============================================================================
// WaaS Phase 4: ThemeProvider
// Server Component — injects CSS variables + custom CSS into the page <head>
// Used in app/_sites/[site]/layout.tsx
// =============================================================================

import type { BrandConfig } from '@/lib/waas/templates/types'
import { buildThemeStyleSheet } from '@/lib/waas/utils/theme'

interface ThemeProviderProps {
  brandConfig: BrandConfig
  customCss?:  string | null
}

// ---------------------------------------------------------------------------
// ThemeProvider — renders a <style> tag with CSS variable declarations
// This is a Server Component so no 'use client' needed
// ---------------------------------------------------------------------------

export function ThemeProvider({ brandConfig, customCss }: ThemeProviderProps) {
  const styleSheet = buildThemeStyleSheet(brandConfig, customCss)

  return (
    <style
      id="waas-theme"
      dangerouslySetInnerHTML={{ __html: styleSheet }}
    />
  )
}

// ---------------------------------------------------------------------------
// ThemeScript — lightweight client-side variant for dynamic theme switching
// Used in admin preview panel for real-time theme toggles
// ---------------------------------------------------------------------------

interface ThemeScriptProps {
  brandConfig: BrandConfig
  customCss?:  string | null
}

export function ThemeScript({ brandConfig, customCss }: ThemeScriptProps) {
  const styleSheet = buildThemeStyleSheet(brandConfig, customCss)

  // Inject as a script that sets the style tag content immediately
  // This prevents flash of unstyled content
  const script = `
    (function() {
      var existing = document.getElementById('waas-theme');
      if (existing) {
        existing.textContent = ${JSON.stringify(styleSheet)};
      } else {
        var style = document.createElement('style');
        style.id = 'waas-theme';
        style.textContent = ${JSON.stringify(styleSheet)};
        document.head.appendChild(style);
      }
    })();
  `

  return (
    <script
      id="waas-theme-script"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  )
}