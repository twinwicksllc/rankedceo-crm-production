'use client'

import { useMemo, useState, useTransition } from 'react'
import { selectClientVariantByReviewToken } from '@/lib/waas/actions/admin'

type Viewport = 'desktop' | 'tablet' | 'mobile'

const VARIANTS = [
  { slug: 'modern', label: 'Modern', tone: 'Clean & minimal' },
  { slug: 'bold', label: 'Bold', tone: 'High-energy conversion style' },
  { slug: 'trust-first', label: 'Trust-First', tone: 'Social proof first' },
] as const

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '820px',
  mobile: '390px',
}

export function ReviewClient({
  tenantId,
  slug,
  businessName,
  reviewToken,
  initialSelectedTemplate,
}: {
  tenantId: string
  slug: string
  businessName: string
  reviewToken: string
  initialSelectedTemplate: string | null
}) {
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [selected, setSelected] = useState<string | null>(initialSelectedTemplate)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const previewBase = useMemo(() => `/_preview/${tenantId}`, [tenantId])

  const handleSelect = (templateSlug: string) => {
    setMessage(null)
    startTransition(async () => {
      const result = await selectClientVariantByReviewToken(reviewToken, templateSlug)
      if (!result.success) {
        setMessage(result.error ?? 'Failed to select this option. Please try again.')
        return
      }
      setSelected(templateSlug)
      setMessage(`Selected ${templateSlug} as the active direction. Our team has been notified for final deployment prep.`)
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">RankedCEO Client Review</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Choose your favorite website direction</h1>
            <p className="mt-2 text-sm text-white/60">
              {businessName} • Compare all 3 options and select the one you want us to launch.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-1">
            {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewport(mode)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all ${
                  viewport === mode
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {VARIANTS.map((variant) => {
            const isSelected = selected === variant.slug

            return (
              <section key={variant.slug} className="rounded-2xl border border-white/15 bg-white/[0.03] p-4 backdrop-blur">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{variant.label}</h2>
                    <p className="text-xs text-white/55">{variant.tone}</p>
                  </div>
                  {isSelected && (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      Selected
                    </span>
                  )}
                </div>

                <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/70 p-2">
                  <div className="mx-auto overflow-hidden rounded-lg border border-white/10 bg-white" style={{ width: VIEWPORT_WIDTH[viewport], maxWidth: '100%' }}>
                    <iframe
                      title={`${variant.label} preview`}
                      src={`${previewBase}?template=${variant.slug}`}
                      className="h-[620px] w-full border-0"
                      loading="lazy"
                      sandbox="allow-same-origin allow-scripts allow-forms"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleSelect(variant.slug)}
                  disabled={isPending}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    isPending
                      ? 'cursor-not-allowed bg-white/10 text-white/40'
                      : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                  }`}
                >
                  {isPending ? 'Saving selection…' : `Select ${variant.label}`}
                </button>
              </section>
            )
          })}
        </div>

        <div className="mt-8 text-center text-xs text-white/45">
          After selection, our team will finalize content polish and deploy your chosen direction.
          <div className="mt-1">Live path: /_sites/{slug}</div>
        </div>
      </div>
    </main>
  )
}
