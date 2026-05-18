'use client'

// =============================================================================
// app/edit/[reviewToken]/regenerate-section-panel.tsx  (PR #102)
//
// Slide-in panel that lets the client regenerate ALL text fields in a single
// named section at once using AI.
//
// Usage flow
// ----------
// 1. Client clicks "✨ Regenerate with AI" button in the FieldNavigator
//    section-group header.
// 2. This panel slides in from the right.
// 3. Client optionally types a short hint (e.g. "punchier" / "focus on
//    emergency service") then clicks "Regenerate".
// 4. On success, a diff table shows original → suggested for each field.
// 5. Client clicks "Apply all X changes" → onApply(fields) → panel closes.
//    The parent (EditorShell) saves each field via updateClientVariantContent.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  regenerateSection,
  type RegeneratedField,
} from '@/lib/waas/actions/client-edit'
import type { SectionId } from '@/lib/waas/templates/types'

const RATE_LIMIT_MS = 8_000  // 8-second cooldown between calls

interface RegenerateSectionPanelProps {
  /** e.g. "hero", "about", "faq" */
  sectionId:    SectionId
  /** e.g. "1. Hero" — used in the header */
  sectionLabel: string
  reviewToken:  string
  variantIndex: number
  onApply:      (fields: RegeneratedField[]) => void
  onClose:      () => void
}

export function RegenerateSectionPanel({
  sectionId,
  sectionLabel,
  reviewToken,
  variantIndex,
  onApply,
  onClose,
}: RegenerateSectionPanelProps) {
  const [hint,      setHint]      = useState('')
  const [fields,    setFields]    = useState<RegeneratedField[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [cooldown,  setCooldown]  = useState(false)
  const hintRef    = useRef<HTMLTextAreaElement>(null)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus hint textarea
  useEffect(() => {
    const t = setTimeout(() => hintRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  // ESC closes panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [onClose])

  const generate = useCallback(async () => {
    if (loading || cooldown) return
    setError(null)
    setFields([])
    setLoading(true)

    try {
      const result = await regenerateSection({
        reviewToken,
        variantIndex,
        sectionId,
        hint: hint.trim() || undefined,
      })

      if (!result.success || !result.data) {
        setError(result.error ?? 'AI returned no results. Please try again.')
        return
      }

      setFields(result.data.fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setLoading(false)
      setCooldown(true)
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
      cooldownTimer.current = setTimeout(() => setCooldown(false), RATE_LIMIT_MS)
    }
  }, [hint, loading, cooldown, reviewToken, variantIndex, sectionId])

  // Cmd/Ctrl+Enter triggers generate
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void generate()
    }
  }

  const hasResults = fields.length > 0

  // -------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[460px] flex-col bg-white shadow-2xl ring-1 ring-slate-200"
      aria-label={`Regenerate ${sectionLabel} section with AI`}
      role="dialog"
      aria-modal="true"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">✨</span>
            <span className="text-sm font-semibold text-slate-900">
              Regenerate section with AI
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {sectionLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close regenerate panel"
          className="rounded p-1.5 text-slate-400 hover:bg-white/80 hover:text-slate-700"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Intro copy */}
        <p className="text-[13px] text-slate-600 leading-relaxed">
          AI will rewrite <strong>all text fields</strong> in this section — 
          headline, subheadline, body copy, CTAs, and more. You can review
          every change before it&apos;s applied.
        </p>

        {/* Hint textarea */}
        <div>
          <label
            htmlFor="regen-hint"
            className="block text-sm font-medium text-slate-800 mb-1.5"
          >
            Optional instruction{' '}
            <span className="text-slate-400 font-normal">(leave blank to let AI decide)</span>
          </label>
          <textarea
            id="regen-hint"
            ref={hintRef}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={500}
            placeholder='e.g. "Focus on 24/7 emergency service" or "Make it punchier and shorter"'
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">⌘↵</kbd>
              {' '}to regenerate
            </span>
            <span>{hint.length} / 500</span>
          </div>
        </div>

        {/* Generate button */}
        <button
          type="button"
          disabled={loading || cooldown}
          onClick={() => void generate()}
          className="w-full rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {loading
            ? 'Regenerating…'
            : cooldown
              ? 'Please wait…'
              : '✨ Regenerate section'}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="animate-pulse rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-4/5 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {/* Diff results */}
        {!loading && hasResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {fields.length} field{fields.length === 1 ? '' : 's'} regenerated — review changes
              </div>
            </div>

            {fields.map((f) => (
              <FieldDiffCard key={f.path} field={f} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer: apply button ────────────────────────────────────────── */}
      {hasResults && !loading && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => { onApply(fields); onClose() }}
            className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Apply all {fields.length} change{fields.length === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {/* Footer note (no results yet) */}
      {!hasResults && (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-500">
          Changes are previewed before being applied. Nothing saves until you click
          &ldquo;Apply all changes&rdquo;.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldDiffCard — shows original vs. suggested side-by-side (stacked on small)
// ---------------------------------------------------------------------------

function FieldDiffCard({ field }: { field: RegeneratedField }) {
  const isEmpty = !field.original.trim()

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
      {/* Field label */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5">
        <span className="text-[11px] font-semibold text-slate-600">{field.label}</span>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Original */}
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Current
          </div>
          <p className="text-slate-500 leading-snug text-[12px] line-clamp-4">
            {isEmpty
              ? <em className="text-slate-300">Empty</em>
              : field.original}
          </p>
        </div>

        {/* Suggested */}
        <div className="p-3 bg-violet-50/40">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 mb-1">
            AI suggestion
          </div>
          <p className="text-slate-800 leading-snug text-[12px] line-clamp-4 font-medium">
            {field.suggested}
          </p>
        </div>
      </div>
    </div>
  )
}
