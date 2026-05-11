'use client'

// =============================================================================
// app/admin/dashboard/[tenantId]/site-settings-form.tsx
// Admin form for SEO/CSS site settings + hero image upload (Phase 7.2).
// =============================================================================

import { useRef, useState, useTransition } from 'react'
import { updateTenantSiteSettings, updateTenantHeroImage } from '@/lib/waas/actions/admin'

interface SiteSettingsFormProps {
  tenantId: string
  initialMetaTitle: string
  initialMetaDescription: string
  initialOgImageUrl: string
  initialCustomCss: string
  initialHeroImageUrl?: string   // Phase 7.2
}

export function SiteSettingsForm({
  tenantId,
  initialMetaTitle,
  initialMetaDescription,
  initialOgImageUrl,
  initialCustomCss,
  initialHeroImageUrl = '',
}: SiteSettingsFormProps) {
  const [metaTitle, setMetaTitle] = useState(initialMetaTitle)
  const [metaDescription, setMetaDescription] = useState(initialMetaDescription)
  const [ogImageUrl, setOgImageUrl] = useState(initialOgImageUrl)
  const [customCss, setCustomCss] = useState(initialCustomCss)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Phase 7.2: hero image
  const [heroImageUrl, setHeroImageUrl]   = useState(initialHeroImageUrl)
  const [heroUploading, setHeroUploading] = useState(false)
  const [heroMessage, setHeroMessage]     = useState<string | null>(null)
  const [heroError, setHeroError]         = useState<string | null>(null)
  const heroFileRef = useRef<HTMLInputElement>(null)

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

  // Phase 7.2: upload hero image to Supabase Storage then save URL
  const onHeroFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setHeroUploading(true)
    setHeroMessage(null)
    setHeroError(null)

    try {
      // Upload via the signed upload API route (reuse existing pattern)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tenantId', tenantId)
      formData.append('assetSlot', 'brand-hero')

      const resp = await fetch('/api/waas/upload-asset', {
        method: 'POST',
        body: formData,
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string }
        setHeroError(body.error ?? `Upload failed (HTTP ${resp.status})`)
        return
      }

      const data = await resp.json() as { publicUrl: string }
      const publicUrl = data.publicUrl

      // Persist to brand_config.hero_image_url
      const saveResult = await updateTenantHeroImage(tenantId, publicUrl)
      if (!saveResult.success) {
        setHeroError(saveResult.error ?? 'Failed to save hero image URL.')
        return
      }

      setHeroImageUrl(publicUrl)
      setHeroMessage('Hero image updated.')
    } catch (err) {
      setHeroError(err instanceof Error ? err.message : 'Upload error')
    } finally {
      setHeroUploading(false)
      if (heroFileRef.current) heroFileRef.current.value = ''
    }
  }

  const onHeroClear = async () => {
    setHeroMessage(null)
    setHeroError(null)
    const result = await updateTenantHeroImage(tenantId, null)
    if (!result.success) {
      setHeroError(result.error ?? 'Failed to clear hero image.')
      return
    }
    setHeroImageUrl('')
    setHeroMessage('Hero image removed.')
  }

  return (
    <div className="space-y-6">

      {/* ── Hero Background Image ─────────────────────────────────────── */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/45 mb-2">Hero Background Photo</p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
          {heroImageUrl ? (
            <div className="relative rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt="Hero background preview"
                className="w-full h-32 object-cover rounded"
                onError={(e) => { (e.currentTarget.style.display = 'none') }}
              />
              <button
                type="button"
                onClick={onHeroClear}
                className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white hover:bg-red-600/80"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="rounded border-2 border-dashed border-white/20 p-4 text-center">
              <p className="text-[11px] text-white/40">No hero image set — site uses brand colour background</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-md border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] text-white hover:bg-white/15 transition-colors">
              {heroUploading ? 'Uploading…' : '⬆ Upload photo'}
              <input
                ref={heroFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onHeroFileChange}
                disabled={heroUploading}
              />
            </label>
            {heroMessage && <p className="text-[11px] text-emerald-300">{heroMessage}</p>}
            {heroError   && <p className="text-[11px] text-red-300">{heroError}</p>}
          </div>
          <p className="text-[10px] text-white/30">
            Recommended: 1920×1080px or wider. JPEG / PNG / WebP. A dark scrim is automatically applied over the photo so text stays legible.
          </p>
        </div>
      </div>

      {/* ── SEO / Meta settings ──────────────────────────────────────── */}
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
