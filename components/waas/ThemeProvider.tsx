// =============================================================================
// WaaS Phase 4: ThemeProvider
// Server Component — injects CSS variables + custom CSS into the page <head>
// Used in app/_sites/[site]/layout.tsx
// Phase 7.1: Also injects Google Fonts <link> tags for brand_config.fonts
// =============================================================================

import type { BrandConfig } from '@/lib/waas/templates/types'
import { buildThemeStyleSheet } from '@/lib/waas/utils/theme'
import { buildGoogleFontsUrl } from '@/lib/waas/client-edit/font-options'

interface ThemeProviderProps {
  brandConfig: BrandConfig
  customCss?:  string | null
}

// ---------------------------------------------------------------------------
// ThemeProvider — renders a <style> tag with CSS variable declarations
// + Google Fonts <link> tags for the heading/body fonts in brand_config
// This is a Server Component so no 'use client' needed
// ---------------------------------------------------------------------------

export function ThemeProvider({ brandConfig, customCss }: ThemeProviderProps) {
  const styleSheet = buildThemeStyleSheet(brandConfig, customCss)

  // Build Google Fonts URL for the brand's chosen fonts (Phase 7.1)
  const headingFont = brandConfig.fonts?.heading
  const bodyFont    = brandConfig.fonts?.body
  const fontSlugs   = [...new Set([headingFont, bodyFont].filter((s): s is string => Boolean(s)))]
  const gfUrl       = fontSlugs.length > 0 ? buildGoogleFontsUrl(fontSlugs) : null

  return (
    <>
      {gfUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={gfUrl} />
        </>
      )}
      <style
        id="waas-theme"
        dangerouslySetInnerHTML={{ __html: styleSheet }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// ThemeScript — lightweight client-side variant for dynamic theme switching
// Used in admin preview panel for real-time theme toggles
// Phase 7.1: Also injects Google Fonts link tag for brand fonts
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

  // Phase 7.1: also inject Google Fonts for the brand's fonts
  const headingFont = brandConfig.fonts?.heading
  const bodyFont    = brandConfig.fonts?.body
  const fontSlugs   = [...new Set([headingFont, bodyFont].filter((s): s is string => Boolean(s)))]
  const gfUrl       = fontSlugs.length > 0 ? buildGoogleFontsUrl(fontSlugs) : null

  const fontScript = gfUrl
    ? `
    (function() {
      var gfUrl = ${JSON.stringify(gfUrl)};
      if (!document.querySelector('link[data-waas-gf]')) {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = gfUrl;
        l.setAttribute('data-waas-gf', '1');
        document.head.appendChild(l);
      }
    })();
    `
    : ''

  return (
    <>
      <script
        id="waas-theme-script"
        dangerouslySetInnerHTML={{ __html: script }}
      />
      {fontScript && (
        <script
          id="waas-font-script"
          dangerouslySetInnerHTML={{ __html: fontScript }}
        />
      )}
    </>
  )
}