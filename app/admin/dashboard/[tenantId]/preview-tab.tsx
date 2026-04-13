// =============================================================================
// WaaS Phase 4: Admin Preview Tab
// Live iframe preview of tenant site + theme switcher
// =============================================================================

'use client'

import { useState, useCallback } from 'react'
import type { ThemeName }        from '@/lib/waas/templates/types'
import { ALL_TEMPLATES }         from '@/lib/waas/templates/registry'
import { applyTemplate }         from '@/lib/waas/actions/admin'

interface PreviewTabProps {
  tenantId:    string
  slug:        string
  currentTheme: string | null
}

const THEMES: { name: ThemeName; label: string; description: string; icon: string }[] = [
  {
    name:        'modern',
    label:       'Modern',
    icon:        '✨',
    description: 'Clean & minimal',
  },
  {
    name:        'bold',
    label:       'Bold',
    icon:        '⚡',
    description: 'High-contrast CTAs',
  },
  {
    name:        'trust-first',
    label:       'Trust-First',
    icon:        '🏆',
    description: 'Reviews front & center',
  },
]

export function PreviewTab({ tenantId, slug, currentTheme }: PreviewTabProps) {
  const [activeTheme, setActiveTheme] = useState<string>(currentTheme ?? 'modern')
  const [applying, setApplying]       = useState(false)
  const [applied, setApplied]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [iframeKey, setIframeKey]     = useState(0)

  // Build preview URL — points to tenant subdomain or local _sites route
  const previewUrl = slug
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/_sites/${slug}`
    : null

  const handleThemeSelect = useCallback((theme: string) => {
    setActiveTheme(theme)
    setApplied(false)
    setError(null)
  }, [])

  const handleApplyTheme = useCallback(async () => {
    setApplying(true)
    setError(null)
    try {
      await applyTemplate(tenantId, activeTheme)
      setApplied(true)
      // Reload iframe to reflect new theme
      setIframeKey(k => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply theme')
    } finally {
      setApplying(false)
    }
  }, [tenantId, activeTheme])

  return (
    <div className="flex flex-col gap-6">
      {/* Theme Switcher */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold text-lg mb-1">Theme Selection</h3>
        <p className="text-white/50 text-sm mb-6">
          Choose a template layout. Click &ldquo;Apply Theme&rdquo; to update the live site.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {THEMES.map(theme => (
            <button
              key={theme.name}
              onClick={() => handleThemeSelect(theme.name)}
              className={`
                relative flex flex-col items-start gap-2 p-5 rounded-xl border-2 text-left transition-all
                ${activeTheme === theme.name
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
                }
              `}
            >
              {/* Active indicator */}
              {activeTheme === theme.name && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-indigo-400" />
              )}
              {/* Current indicator */}
              {currentTheme === theme.name && (
                <span className="absolute top-3 right-3 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
                  Live
                </span>
              )}

              <span className="text-3xl">{theme.icon}</span>
              <div>
                <div className="text-white font-semibold">{theme.label}</div>
                <div className="text-white/50 text-xs mt-0.5">{theme.description}</div>
              </div>

              {/* Section preview pills */}
              <div className="flex flex-wrap gap-1 mt-1">
                {ALL_TEMPLATES.find(t => t.slug === theme.name)
                  ?.default_layout_json
                  .filter(s => s.enabled)
                  .map(s => (
                    <span
                      key={s.section}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 capitalize"
                    >
                      {s.section}
                    </span>
                  ))
                }
              </div>
            </button>
          ))}
        </div>

        {/* Apply button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleApplyTheme}
            disabled={applying || activeTheme === currentTheme}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
              ${applying
                ? 'bg-indigo-500/50 text-white/50 cursor-not-allowed'
                : activeTheme === currentTheme
                  ? 'bg-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }
            `}
          >
            {applying ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Applying...
              </>
            ) : (
              <>🎨 Apply Theme</>
            )}
          </button>

          {applied && (
            <span className="text-green-400 text-sm flex items-center gap-1.5">
              <span>✓</span> Theme applied — iframe refreshed
            </span>
          )}
          {error && (
            <span className="text-red-400 text-sm">{error}</span>
          )}
        </div>
      </div>

      {/* Live Preview iframe */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          {previewUrl && (
            <div className="flex-1 bg-white/10 rounded-lg px-3 py-1.5 text-white/50 text-xs font-mono truncate">
              {previewUrl}
            </div>
          )}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white/70 transition-colors text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
            >
              ↗ Open
            </a>
          )}
        </div>

        {/* iframe */}
        {previewUrl ? (
          <div className="relative w-full" style={{ height: '800px' }}>
            <iframe
              key={iframeKey}
              src={previewUrl}
              title={`Preview of tenant site`}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-white/30 gap-3">
            <span className="text-4xl">🌐</span>
            <p className="text-sm">No site URL available — tenant needs a slug or domain</p>
          </div>
        )}
      </div>
    </div>
  )
}