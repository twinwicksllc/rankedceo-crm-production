'use client'

import { useState, useTransition } from 'react'
import { updateTenantSiteSettings } from '@/lib/waas/actions/admin'

interface SiteSettingsFormProps {
  tenantId: string
  initialMetaTitle: string
  initialMetaDescription: string
  initialOgImageUrl: string
  initialCustomCss: string
}

export function SiteSettingsForm({
  tenantId,
  initialMetaTitle,
  initialMetaDescription,
  initialOgImageUrl,
  initialCustomCss,
}: SiteSettingsFormProps) {
  const [metaTitle, setMetaTitle] = useState(initialMetaTitle)
  const [metaDescription, setMetaDescription] = useState(initialMetaDescription)
  const [ogImageUrl, setOgImageUrl] = useState(initialOgImageUrl)
  const [customCss, setCustomCss] = useState(initialCustomCss)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSave = () => {
    setMessage(null)
    setError(null)

    startTransition(async () => {
      const result = await updateTenantSiteSettings(tenantId, {
        metaTitle,
        metaDescription,
        ogImageUrl,
        customCss,
      })

      if (!result.success) {
        setError(result.error ?? 'Failed to save site settings.')
        return
      }

      setMessage('Site settings saved.')
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <label className="block">
          <p className="text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Meta Title</p>
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            maxLength={160}
            className="w-full h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-blue-500/60"
            placeholder="Best HVAC Service in Austin | Your Brand"
          />
        </label>

        <label className="block">
          <p className="text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Meta Description</p>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            maxLength={320}
            rows={3}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-blue-500/60"
            placeholder="Describe this business and service area for search and social snippets."
          />
        </label>

        <label className="block">
          <p className="text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Open Graph Image URL</p>
          <input
            value={ogImageUrl}
            onChange={(e) => setOgImageUrl(e.target.value)}
            className="w-full h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-blue-500/60"
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <p className="text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Custom CSS</p>
          <textarea
            value={customCss}
            onChange={(e) => setCustomCss(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-[11px] text-white placeholder:text-white/30 outline-none focus:border-blue-500/60"
            placeholder="/* Optional custom styles for this tenant site */"
          />
          <p className="mt-1 text-[10px] text-white/35">{customCss.length}/12000</p>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save Settings'}
        </button>

        {message && <p className="text-[11px] text-emerald-300">{message}</p>}
        {error && <p className="text-[11px] text-red-300">{error}</p>}
      </div>
    </div>
  )
}
