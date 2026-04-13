'use client'

// =============================================================================
// Step 3: Brand Identity
// Logo upload (Supabase Storage), color picker, SVG auto-generate
// =============================================================================

import React, { useState, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { generateTextmarkSvg, svgToDataUrl } from '@/lib/waas/utils/generate-textmark'

interface Props {
  tenantId:         string
  businessName:     string
  primaryColor:     string
  setPrimaryColor:  (c: string) => void
  secondaryColor:   string
  setSecondaryColor:(c: string) => void
  logoUrl:          string | null
  setLogoUrl:       (u: string | null) => void
  onNext:           () => void
  onBack:           () => void
  isLoading:        boolean
}

const PRESET_PALETTES = [
  { primary: '#2563EB', secondary: '#1E40AF', label: 'Ocean Blue'    },
  { primary: '#7C3AED', secondary: '#5B21B6', label: 'Royal Purple'  },
  { primary: '#059669', secondary: '#047857', label: 'Emerald Green' },
  { primary: '#DC2626', secondary: '#B91C1C', label: 'Bold Red'      },
  { primary: '#D97706', secondary: '#B45309', label: 'Amber Gold'    },
  { primary: '#0891B2', secondary: '#0E7490', label: 'Cyan Pro'      },
  { primary: '#BE185D', secondary: '#9D174D', label: 'Hot Pink'      },
  { primary: '#374151', secondary: '#1F2937', label: 'Charcoal'      },
]

export function StepBrandIdentity({
  tenantId, businessName,
  primaryColor, setPrimaryColor,
  secondaryColor, setSecondaryColor,
  logoUrl, setLogoUrl,
  onNext, onBack, isLoading,
}: Props) {
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [useAutoLogo, setUseAutoLogo] = useState(!logoUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  // Generate auto SVG preview
  const svgPreview = generateTextmarkSvg(businessName || 'My Business', primaryColor)
  const svgDataUrl = svgToDataUrl(svgPreview)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')

    // Validate
    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a JPG, PNG, SVG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be under 5MB.')
      return
    }

    setUploading(true)
    try {
      const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
      const anon = process.env.NEXT_PUBLIC_WAAS_SUPABASE_ANON_KEY
      if (!url || !anon) throw new Error('Storage not configured')

      const supabase   = createClient(url, anon)
      const ext        = file.name.split('.').pop() ?? 'png'
      const uploadPath = `${tenantId}/logo.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(uploadPath, file, { upsert: true, contentType: file.type })

      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(uploadPath)

      setLogoUrl(publicUrl)
      setUseAutoLogo(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setUploadError(msg)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [tenantId, setLogoUrl])

  const handleRemoveLogo = () => {
    setLogoUrl(null)
    setUseAutoLogo(true)
  }

  const handlePaletteSelect = (p: { primary: string; secondary: string }) => {
    setPrimaryColor(p.primary)
    setSecondaryColor(p.secondary)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
          <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Step 3 of 4</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
          Define your brand identity
        </h1>
        <p className="text-white/50 mt-2 text-sm sm:text-base">
          Upload your logo or we'll craft a professional text-mark automatically.
        </p>
      </div>

      {/* Logo Section */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-white/70 mb-3">Logo</label>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Upload option */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              !useAutoLogo
                ? 'border-blue-500/60 bg-blue-500/5'
                : 'border-white/10 hover:border-white/20 bg-white/3'
            }`}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/svg+xml,image/webp"
              onChange={handleFileSelect}
              className="sr-only"
            />
            {logoUrl && !useAutoLogo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Uploaded logo" className="max-h-16 max-w-full object-contain" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoveLogo() }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                {uploading ? (
                  <svg className="animate-spin w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-white/30">
                    <path d="M16 4v16M8 12l8-8 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 24v2a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
                <div className="text-center">
                  <p className="text-white/60 text-sm font-medium">{uploading ? 'Uploading…' : 'Upload Logo'}</p>
                  <p className="text-white/30 text-xs mt-0.5">JPG, PNG, SVG, WebP • Max 5MB</p>
                </div>
              </>
            )}
          </div>

          {/* Auto-generate option */}
          <div
            className={`relative rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              useAutoLogo
                ? 'border-violet-500/60 bg-violet-500/5'
                : 'border-white/10 hover:border-white/20'
            }`}
            onClick={() => { setUseAutoLogo(true); setLogoUrl(null) }}
          >
            {useAutoLogo && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            {/* SVG preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgDataUrl}
              alt="Auto-generated text-mark"
              className="max-h-10 max-w-full object-contain"
            />
            <div className="text-center">
              <p className="text-white/60 text-sm font-medium">Auto-Generate</p>
              <p className="text-white/30 text-xs mt-0.5">Professional text-mark</p>
            </div>
          </div>
        </div>

        {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
      </div>

      {/* Color Palette */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-white/70 mb-3">Color Palette</label>

        {/* Preset palettes */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PRESET_PALETTES.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePaletteSelect(p)}
              title={p.label}
              className={`group relative h-10 rounded-xl overflow-hidden border-2 transition-all ${
                primaryColor === p.primary
                  ? 'border-white/60 scale-105 shadow-lg'
                  : 'border-transparent hover:border-white/30'
              }`}
            >
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
              />
              <span className="sr-only">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Custom color pickers */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Primary Color</label>
            <div className="flex items-center gap-3 h-12 px-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-blue-500/60 transition-all">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none p-0"
              />
              <span className="text-white/60 text-sm font-mono uppercase">{primaryColor}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Secondary Color</label>
            <div className="flex items-center gap-3 h-12 px-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-blue-500/60 transition-all">
              <input
                type="color"
                value={secondaryColor}
                onChange={e => setSecondaryColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none p-0"
              />
              <span className="text-white/60 text-sm font-mono uppercase">{secondaryColor}</span>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-white/30 text-xs mb-3 uppercase tracking-wider font-medium">Live Preview</p>
          <div className="flex items-center gap-3">
            <div
              className="h-10 flex-1 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-lg"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            >
              Your Brand Button
            </div>
            <div
              className="h-10 w-10 rounded-lg"
              style={{ backgroundColor: primaryColor + '20', border: `2px solid ${primaryColor}` }}
            />
            <div
              className="h-10 w-10 rounded-lg"
              style={{ backgroundColor: secondaryColor }}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-14 px-6 rounded-xl border border-white/15 text-white/60 hover:text-white hover:border-white/30 font-medium text-sm transition-all"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || uploading}
          className="flex-1 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Saving…
            </>
          ) : (
            <>Continue to Integrations <span className="ml-1">→</span></>
          )}
        </button>
      </div>
    </div>
  )
}