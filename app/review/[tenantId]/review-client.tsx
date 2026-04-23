'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ClientReviewVersion, ClientVariantFeedback, ClientVariantMix } from '@/lib/waas/actions/admin'
import { mixClientVariantsByReviewToken, regenerateSelectedVariantByReviewToken, selectClientVariantByReviewToken } from '@/lib/waas/actions/admin'

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
  initialFeedback,
  initialMix,
  versions,
}: {
  tenantId: string
  slug: string
  businessName: string
  reviewToken: string
  initialSelectedTemplate: string | null
  initialFeedback: ClientVariantFeedback
  initialMix: ClientVariantMix
  versions: ClientReviewVersion[]
}) {
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [selected, setSelected] = useState<string | null>(initialSelectedTemplate)
  const [message, setMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<string>(initialFeedback.tone ?? '')
  const [feedbackCtaIntensity, setFeedbackCtaIntensity] = useState<string>(initialFeedback.ctaIntensity ?? '')
  const [feedbackLayoutPreference, setFeedbackLayoutPreference] = useState<string>(initialFeedback.layoutPreference ?? '')
  const [feedbackNotes, setFeedbackNotes] = useState<string>(initialFeedback.notes ?? '')
  const [mixPrimary, setMixPrimary] = useState<string>(initialSelectedTemplate ?? 'modern')
  const [mixSourceTemplates, setMixSourceTemplates] = useState<string[]>(initialMix.sourceTemplates ?? [])
  const [isPending, startTransition] = useTransition()

  const previewBase = useMemo(() => `/_preview/${tenantId}`, [tenantId])

  const handleSelect = (templateSlug: string) => {
    setMessage(null)
    startTransition(async () => {
      const result = await selectClientVariantByReviewToken(reviewToken, templateSlug, {
        tone: feedbackTone || null,
        ctaIntensity: feedbackCtaIntensity || null,
        layoutPreference: feedbackLayoutPreference || null,
        notes: feedbackNotes || null,
      })
      if (!result.success) {
        setMessage(result.error ?? 'Failed to select this option. Please try again.')
        return
      }
      setSelected(templateSlug)
      setMessage(`Selected ${templateSlug} and saved your feedback. Our team has been notified for final deployment prep.`)
    })
  }

  const toggleMixTemplate = (slug: string) => {
    setMixSourceTemplates((prev) => {
      if (prev.includes(slug)) return prev.filter(item => item !== slug)
      return [...prev, slug]
    })
  }

  const handleSaveMixedDirection = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await mixClientVariantsByReviewToken(
        reviewToken,
        mixPrimary,
        mixSourceTemplates,
        {
          tone: feedbackTone || null,
          ctaIntensity: feedbackCtaIntensity || null,
          layoutPreference: feedbackLayoutPreference || null,
          notes: feedbackNotes || null,
        },
      )

      if (!result.success) {
        setMessage(result.error ?? 'Failed to save mixed direction. Please try again.')
        return
      }

      setSelected(mixPrimary)
      const summary = mixSourceTemplates.length
        ? `Saved mixed direction with ${mixPrimary} as primary and influences from ${mixSourceTemplates.join(', ')}.`
        : `Saved mixed direction with ${mixPrimary} as primary.`
      setMessage(summary)
    })
  }

  const handleRegenerate = () => {
    setMessage(null)
    startTransition(async () => {
      const templateSlug = selected ?? mixPrimary
      const result = await regenerateSelectedVariantByReviewToken(reviewToken, templateSlug)
      if (!result.success) {
        setMessage(result.error ?? 'Failed to regenerate your selected direction. Please try again.')
        return
      }
      setMessage(`Regenerated ${templateSlug} using your saved feedback and preferences.`)
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

        <section className="mb-6 rounded-2xl border border-white/15 bg-white/[0.03] p-4 backdrop-blur sm:p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Tell us how to refine your chosen direction</h2>
            <p className="mt-1 text-sm text-white/60">
              Optional, but helpful. We save this feedback when you select a variant.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm">
              <div className="mb-2 text-white/70">Tone</div>
              <select
                value={feedbackTone}
                onChange={(e) => setFeedbackTone(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
              >
                <option value="">No preference</option>
                <option value="professional">More professional</option>
                <option value="friendly">More friendly</option>
                <option value="premium">More premium</option>
                <option value="direct">More direct</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-2 text-white/70">CTA intensity</div>
              <select
                value={feedbackCtaIntensity}
                onChange={(e) => setFeedbackCtaIntensity(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
              >
                <option value="">No preference</option>
                <option value="soft">Softer</option>
                <option value="balanced">Balanced</option>
                <option value="strong">Stronger</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-2 text-white/70">Layout preference</div>
              <select
                value={feedbackLayoutPreference}
                onChange={(e) => setFeedbackLayoutPreference(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
              >
                <option value="">No preference</option>
                <option value="compact">More compact</option>
                <option value="balanced">Balanced spacing</option>
                <option value="spacious">More spacious</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm">
            <div className="mb-2 text-white/70">Notes</div>
            <textarea
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              maxLength={3000}
              rows={4}
              placeholder="Anything you want us to change before launch..."
              className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-400"
            />
            <div className="mt-1 text-right text-xs text-white/45">{feedbackNotes.length}/3000</div>
          </label>

          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-white/90">Mix From A/B/C</h3>
            <p className="mt-1 text-xs text-white/55">
              Pick a primary direction and optionally blend signals from the others.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-2 text-white/70">Primary direction</div>
                <select
                  value={mixPrimary}
                  onChange={(e) => setMixPrimary(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white outline-none transition focus:border-cyan-400"
                >
                  {VARIANTS.map((variant) => (
                    <option key={variant.slug} value={variant.slug}>{variant.label}</option>
                  ))}
                </select>
              </label>

              <div className="text-sm">
                <div className="mb-2 text-white/70">Influence from</div>
                <div className="flex flex-wrap gap-2">
                  {VARIANTS.map((variant) => (
                    <button
                      key={variant.slug}
                      type="button"
                      onClick={() => toggleMixTemplate(variant.slug)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${mixSourceTemplates.includes(variant.slug)
                        ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-100'
                        : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10'
                      }`}
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveMixedDirection}
              disabled={isPending}
              className={`mt-4 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                isPending
                  ? 'cursor-not-allowed bg-white/10 text-white/40'
                  : 'bg-violet-500 text-white hover:bg-violet-400'
              }`}
            >
              {isPending ? 'Saving mixed direction…' : 'Save Mixed Direction'}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-white/15 bg-white/[0.03] p-4 backdrop-blur sm:p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Iteration Timeline</h2>
            <p className="mt-1 text-sm text-white/60">
              Your prior versions are tracked and available to the team for rollback.
            </p>
          </div>

          {versions.length === 0 ? (
            <p className="text-sm text-white/50">No iterations yet. Save a selection or regenerate to create version history.</p>
          ) : (
            <div className="space-y-2">
              {versions.slice(0, 8).map((version) => (
                <div key={version.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-sm text-white/85">
                    {version.templateSlug ? `Template: ${version.templateSlug}` : 'Template snapshot'}
                  </p>
                  <p className="text-xs text-white/55">
                    {version.changeSource.replace(/_/g, ' ')}
                    {version.summary ? ` • ${version.summary}` : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">{new Date(version.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>

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
          <div className="mt-4">
            <button
              onClick={handleRegenerate}
              disabled={isPending}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                isPending
                  ? 'cursor-not-allowed bg-white/10 text-white/40'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
              }`}
            >
              {isPending ? 'Regenerating…' : 'Regenerate Selected Direction'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
