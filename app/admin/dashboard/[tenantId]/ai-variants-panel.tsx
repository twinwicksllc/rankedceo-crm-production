'use client'

import { useMemo, useState, useTransition } from 'react'
import type { SectionConfig } from '@/lib/waas/templates/types'
import type { AdminSiteVariant, VariantEditHistoryEntry } from '@/lib/waas/actions/admin'
import {
  getVariantEditHistory,
  generateAndStoreSiteVariants,
  getSiteVariants,
  markVariantsSentToReview,
  rollbackSiteVariantFromHistory,
  unlockVariantsForEditing,
  updateSiteVariant,
} from '@/lib/waas/actions/admin'

type Viewport = 'desktop' | 'mobile'

interface ScalarFieldSpec {
  key: string
  label: string
  multiline?: boolean
  maxLength?: number
}

interface ObjectArrayFieldSpec {
  key: string
  label: string
  multiline?: boolean
  maxLength?: number
}

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  mobile: '390px',
}

const SECTION_FIELD_MAP: Record<string, ScalarFieldSpec[]> = {
  hero: [
    { key: 'eyebrow', label: 'Eyebrow', maxLength: 50 },
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'subheadline', label: 'Subheadline', multiline: true, maxLength: 320 },
    { key: 'primaryCtaLabel', label: 'Primary CTA Label', maxLength: 60 },
    { key: 'secondaryCtaLabel', label: 'Secondary CTA Label', maxLength: 60 },
    { key: 'locationBadge', label: 'Location Badge', maxLength: 120 },
  ],
  services: [
    { key: 'eyebrow', label: 'Eyebrow', maxLength: 50 },
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'subheadline', label: 'Subheadline', multiline: true, maxLength: 320 },
    { key: 'bottomCtaText', label: 'Bottom CTA Text', multiline: true, maxLength: 240 },
  ],
  trust: [
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'subheadline', label: 'Subheadline', multiline: true, maxLength: 320 },
  ],
  about: [
    { key: 'eyebrow', label: 'Eyebrow', maxLength: 50 },
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'body', label: 'Body', multiline: true, maxLength: 2000 },
  ],
  faq: [
    { key: 'eyebrow', label: 'Eyebrow', maxLength: 50 },
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'intro', label: 'Intro', multiline: true, maxLength: 500 },
  ],
  'how-it-works': [
    { key: 'eyebrow', label: 'Eyebrow', maxLength: 50 },
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'intro', label: 'Intro', multiline: true, maxLength: 500 },
  ],
  booking: [
    { key: 'eyebrow', label: 'Eyebrow', maxLength: 50 },
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'subheadline', label: 'Subheadline', multiline: true, maxLength: 320 },
    { key: 'primaryCtaLabel', label: 'Primary CTA Label', maxLength: 60 },
  ],
  reviews: [
    { key: 'eyebrow', label: 'Eyebrow', maxLength: 50 },
    { key: 'headline', label: 'Headline', maxLength: 140 },
    { key: 'subheadline', label: 'Subheadline', multiline: true, maxLength: 320 },
  ],
}

const STRING_ARRAY_FIELD_MAP: Record<string, { key: string; label: string; itemLabel: string }> = {
  about: { key: 'highlights', label: 'Highlights', itemLabel: 'Highlight' },
}

const OBJECT_ARRAY_FIELD_MAP: Record<string, { key: string; label: string; fields: ObjectArrayFieldSpec[] }> = {
  services: {
    key: 'items',
    label: 'Service Items',
    fields: [
      { key: 'title', label: 'Title', maxLength: 90 },
      { key: 'description', label: 'Description', multiline: true, maxLength: 260 },
      { key: 'icon', label: 'Icon', maxLength: 8 },
    ],
  },
  trust: {
    key: 'badges',
    label: 'Trust Badges',
    fields: [
      { key: 'label', label: 'Label', maxLength: 80 },
      { key: 'sub', label: 'Subtext', multiline: true, maxLength: 180 },
      { key: 'icon', label: 'Icon', maxLength: 8 },
    ],
  },
  faq: {
    key: 'items',
    label: 'FAQ Items',
    fields: [
      { key: 'question', label: 'Question', multiline: true, maxLength: 180 },
      { key: 'answer', label: 'Answer', multiline: true, maxLength: 700 },
    ],
  },
  'how-it-works': {
    key: 'steps',
    label: 'Process Steps',
    fields: [
      { key: 'title', label: 'Title', maxLength: 100 },
      { key: 'description', label: 'Description', multiline: true, maxLength: 320 },
    ],
  },
}

interface VariantDraft {
  variant_label: string
  variant_rationale: string
  sections_json: SectionConfig[]
}

function toDraft(variant: AdminSiteVariant): VariantDraft {
  return {
    variant_label: variant.variant_label,
    variant_rationale: variant.variant_rationale ?? '',
    sections_json: [...variant.sections_json]
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        ...section,
        config: { ...section.config },
        content: section.content ? { ...section.content } : undefined,
      })),
  }
}

function startCase(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizeSectionOrders(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      ...section,
      order: index + 1,
    }))
}

export function AIVariantsPanel({ tenantId, initialVariants }: { tenantId: string; initialVariants: AdminSiteVariant[] }) {
  const [variants, setVariants] = useState<AdminSiteVariant[]>(initialVariants)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [openVariantEditor, setOpenVariantEditor] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, VariantDraft>>({})
  const [savedSignatures, setSavedSignatures] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {}
    for (const variant of initialVariants) {
      out[variant.variant_index] = JSON.stringify(toDraft(variant))
    }
    return out
  })
  const [isPending, startTransition] = useTransition()
  const [historyByVariant, setHistoryByVariant] = useState<Record<number, VariantEditHistoryEntry[]>>({})
  const [loadingHistoryIndex, setLoadingHistoryIndex] = useState<number | null>(null)

  const isReviewLocked = useMemo(
    () => variants.some((variant) => variant.status === 'sent_to_review' || variant.status === 'selected'),
    [variants],
  )
  const hasSelectedVariant = useMemo(
    () => variants.some((variant) => variant.status === 'selected'),
    [variants],
  )

  const previewBase = useMemo(() => `/_preview/${tenantId}`, [tenantId])

  const refreshVariants = async () => {
    const result = await getSiteVariants(tenantId)
    if (result.success && result.data) {
      setVariants(result.data)
      setDrafts((prev) => {
        const next = { ...prev }
        for (const variant of result.data ?? []) {
          next[variant.variant_index] = toDraft(variant)
        }
        return next
      })
      setSavedSignatures(() => {
        const next: Record<number, string> = {}
        for (const variant of result.data ?? []) {
          next[variant.variant_index] = JSON.stringify(toDraft(variant))
        }
        return next
      })
    }
  }

  const getDraft = (variant: AdminSiteVariant): VariantDraft => {
    return drafts[variant.variant_index] ?? toDraft(variant)
  }

  const setDraft = (variantIndex: number, updater: (current: VariantDraft) => VariantDraft) => {
    setDrafts((prev) => {
      const fallback = variants.find((item) => item.variant_index === variantIndex)
      if (!fallback) return prev
      const current = prev[variantIndex] ?? toDraft(fallback)
      const nextDraft = updater(current)
      return {
        ...prev,
        [variantIndex]: {
          ...nextDraft,
          sections_json: normalizeSectionOrders(nextDraft.sections_json),
        },
      }
    })
  }

  const handleGenerate = () => {
    setMessage(null)
    startTransition(async () => {
      if (isReviewLocked) {
        setMessage('Variants are locked during active client review. Unlock variants before regenerating.')
        return
      }

      const result = await generateAndStoreSiteVariants(tenantId, notes.trim() || undefined)
      if (!result.success) {
        setMessage(result.error ?? 'Failed to generate variants.')
        return
      }
      await refreshVariants()
      setMessage('Generated 3 AI variants and refreshed previews.')
    })
  }

  const handleSendToClient = () => {
    setMessage(null)
    startTransition(async () => {
      const hasDirtyDraft = variants.some((variant) => {
        const draft = getDraft(variant)
        const signature = JSON.stringify(draft)
        return signature !== (savedSignatures[variant.variant_index] ?? '')
      })

      if (hasDirtyDraft) {
        setMessage('You have unsaved variant edits. Save changes before sending to client review.')
        return
      }

      const result = await markVariantsSentToReview(tenantId)
      if (!result.success) {
        setMessage(result.error ?? 'Failed to send variants to review.')
        return
      }
      await refreshVariants()
      setMessage(`Sent variants to client review. Share link: /review/${result.data ?? tenantId}`)
    })
  }

  const handleToggleEditor = (variant: AdminSiteVariant) => {
    setDrafts((prev) => {
      if (prev[variant.variant_index]) return prev
      return {
        ...prev,
        [variant.variant_index]: toDraft(variant),
      }
    })

    setOpenVariantEditor((prev) => prev === variant.variant_index ? null : variant.variant_index)

    if (openVariantEditor !== variant.variant_index) {
      void loadVariantHistory(variant.variant_index)
    }
  }

  const loadVariantHistory = async (variantIndex: number) => {
    setLoadingHistoryIndex(variantIndex)
    const result = await getVariantEditHistory(tenantId, variantIndex, 8)
    if (result.success && result.data) {
      setHistoryByVariant((prev) => ({
        ...prev,
        [variantIndex]: result.data ?? [],
      }))
    }
    setLoadingHistoryIndex(null)
  }

  const handleSaveVariant = (variant: AdminSiteVariant) => {
    const draft = getDraft(variant)
    setMessage(null)

    startTransition(async () => {
      if (isReviewLocked) {
        setMessage('Variants are locked during active client review. Unlock variants before saving edits.')
        return
      }

      const result = await updateSiteVariant(tenantId, variant.variant_index, {
        variantLabel: draft.variant_label,
        variantRationale: draft.variant_rationale,
        sections: draft.sections_json,
      })

      if (!result.success) {
        setMessage(result.error ?? 'Failed to save variant edits.')
        return
      }

      await refreshVariants()
      setMessage(`Saved edits for ${draft.variant_label}.`)
    })
  }

  const handleResetVariant = (variant: AdminSiteVariant) => {
    setDrafts((prev) => ({
      ...prev,
      [variant.variant_index]: toDraft(variant),
    }))
    setMessage(`Reset unsaved edits for ${variant.variant_label}.`)
  }

  const handleSaveAllDrafts = () => {
    setMessage(null)
    startTransition(async () => {
      if (isReviewLocked) {
        setMessage('Variants are locked during active client review. Unlock variants before saving edits.')
        return
      }

      let savedCount = 0

      for (const variant of variants) {
        const draft = getDraft(variant)
        const signature = JSON.stringify(draft)
        const savedSignature = savedSignatures[variant.variant_index] ?? ''
        if (signature === savedSignature) continue

        const result = await updateSiteVariant(tenantId, variant.variant_index, {
          variantLabel: draft.variant_label,
          variantRationale: draft.variant_rationale,
          sections: draft.sections_json,
        })

        if (!result.success) {
          setMessage(result.error ?? `Failed while saving ${variant.variant_label}.`)
          return
        }

        savedCount += 1
      }

      await refreshVariants()
      setMessage(savedCount > 0 ? `Saved ${savedCount} variant draft(s).` : 'No unsaved changes to save.')
    })
  }

  const handleRollbackVariant = (variant: AdminSiteVariant, versionId: string) => {
    setMessage(null)
    startTransition(async () => {
      const result = await rollbackSiteVariantFromHistory(tenantId, variant.variant_index, versionId)
      if (!result.success) {
        setMessage(result.error ?? 'Failed to roll back variant from history.')
        return
      }

      await refreshVariants()
      await loadVariantHistory(variant.variant_index)
      setMessage(`Rolled back ${variant.variant_label} to selected snapshot.`)
    })
  }

  const handleUnlockVariants = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await unlockVariantsForEditing(tenantId)
      if (!result.success) {
        setMessage(result.error ?? 'Failed to unlock variants for editing.')
        return
      }
      await refreshVariants()
      setMessage('Variants unlocked for admin editing.')
    })
  }

  const updateSection = (
    variantIndex: number,
    sectionIndex: number,
    updater: (section: SectionConfig) => SectionConfig,
  ) => {
    setDraft(variantIndex, (current) => {
      const nextSections = current.sections_json.map((section, index) => {
        if (index !== sectionIndex) return section
        return updater(section)
      })
      return { ...current, sections_json: normalizeSectionOrders(nextSections) }
    })
  }

  const moveSection = (
    variantIndex: number,
    sectionIndex: number,
    direction: 'up' | 'down',
  ) => {
    setDraft(variantIndex, (current) => {
      const list = [...current.sections_json]
      const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1
      if (targetIndex < 0 || targetIndex >= list.length) return current

      const temp = list[sectionIndex]
      list[sectionIndex] = list[targetIndex]
      list[targetIndex] = temp

      return {
        ...current,
        sections_json: normalizeSectionOrders(list),
      }
    })
  }

  const updateSectionContentField = (
    variantIndex: number,
    sectionIndex: number,
    fieldName: string,
    nextValue: string,
  ) => {
    updateSection(variantIndex, sectionIndex, (currentSection) => {
      const nextContent = asObject(currentSection.content)
      nextContent[fieldName] = nextValue
      return {
        ...currentSection,
        content: nextContent,
      }
    })
  }

  const updateSectionStringArrayItem = (
    variantIndex: number,
    sectionIndex: number,
    arrayKey: string,
    itemIndex: number,
    nextValue: string,
  ) => {
    updateSection(variantIndex, sectionIndex, (currentSection) => {
      const nextContent = asObject(currentSection.content)
      const source = Array.isArray(nextContent[arrayKey]) ? (nextContent[arrayKey] as unknown[]) : []
      const list = [...source]
      list[itemIndex] = nextValue
      nextContent[arrayKey] = list
      return {
        ...currentSection,
        content: nextContent,
      }
    })
  }

  const addSectionStringArrayItem = (
    variantIndex: number,
    sectionIndex: number,
    arrayKey: string,
  ) => {
    updateSection(variantIndex, sectionIndex, (currentSection) => {
      const nextContent = asObject(currentSection.content)
      const source = Array.isArray(nextContent[arrayKey]) ? (nextContent[arrayKey] as unknown[]) : []
      nextContent[arrayKey] = [...source, '']
      return {
        ...currentSection,
        content: nextContent,
      }
    })
  }

  const removeSectionStringArrayItem = (
    variantIndex: number,
    sectionIndex: number,
    arrayKey: string,
    itemIndex: number,
  ) => {
    updateSection(variantIndex, sectionIndex, (currentSection) => {
      const nextContent = asObject(currentSection.content)
      const source = Array.isArray(nextContent[arrayKey]) ? (nextContent[arrayKey] as unknown[]) : []
      nextContent[arrayKey] = source.filter((_, index) => index !== itemIndex)
      return {
        ...currentSection,
        content: nextContent,
      }
    })
  }

  const updateSectionObjectArrayField = (
    variantIndex: number,
    sectionIndex: number,
    arrayKey: string,
    itemIndex: number,
    fieldKey: string,
    nextValue: string,
  ) => {
    updateSection(variantIndex, sectionIndex, (currentSection) => {
      const nextContent = asObject(currentSection.content)
      const source = Array.isArray(nextContent[arrayKey]) ? (nextContent[arrayKey] as unknown[]) : []
      const list = [...source]
      const row = asObject(list[itemIndex])
      row[fieldKey] = nextValue
      list[itemIndex] = row
      nextContent[arrayKey] = list
      return {
        ...currentSection,
        content: nextContent,
      }
    })
  }

  const addSectionObjectArrayItem = (
    variantIndex: number,
    sectionIndex: number,
    arrayKey: string,
    fields: ObjectArrayFieldSpec[],
  ) => {
    updateSection(variantIndex, sectionIndex, (currentSection) => {
      const nextContent = asObject(currentSection.content)
      const source = Array.isArray(nextContent[arrayKey]) ? (nextContent[arrayKey] as unknown[]) : []
      const newItem = fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = ''
        return acc
      }, {})
      nextContent[arrayKey] = [...source, newItem]
      return {
        ...currentSection,
        content: nextContent,
      }
    })
  }

  const removeSectionObjectArrayItem = (
    variantIndex: number,
    sectionIndex: number,
    arrayKey: string,
    itemIndex: number,
  ) => {
    updateSection(variantIndex, sectionIndex, (currentSection) => {
      const nextContent = asObject(currentSection.content)
      const source = Array.isArray(nextContent[arrayKey]) ? (nextContent[arrayKey] as unknown[]) : []
      nextContent[arrayKey] = source.filter((_, index) => index !== itemIndex)
      return {
        ...currentSection,
        content: nextContent,
      }
    })
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {message}
        </div>
      )}

      {isReviewLocked && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Variant editing is locked while client review is active.
        </div>
      )}

      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-white text-lg font-semibold">AI Variant Generation</h2>
            <p className="text-white/55 text-xs mt-1">Generate 3 differentiated directions from onboarding answers.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-1">
            {(['desktop', 'mobile'] as Viewport[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewport(mode)}
                className={`rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
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

        <label className="mt-4 block text-sm">
          <div className="mb-2 text-white/70">Re-generation notes (optional)</div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1200}
            rows={3}
            placeholder="Example: lean more premium and emphasize financing eligibility"
            className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-400"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending || isReviewLocked}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isPending || isReviewLocked
                ? 'cursor-not-allowed bg-white/10 text-white/35'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {isPending ? 'Generating…' : 'Generate / Re-Generate'}
          </button>

          <button
            type="button"
            onClick={handleSaveAllDrafts}
            disabled={isPending || variants.length === 0 || isReviewLocked}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isPending || variants.length === 0 || isReviewLocked
                ? 'cursor-not-allowed bg-white/10 text-white/35'
                : 'bg-emerald-500 text-white hover:bg-emerald-400'
            }`}
          >
            {isPending ? 'Saving…' : 'Save All Drafts'}
          </button>

          <button
            type="button"
            onClick={handleUnlockVariants}
            disabled={isPending || !isReviewLocked || hasSelectedVariant}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isPending || !isReviewLocked || hasSelectedVariant
                ? 'cursor-not-allowed bg-white/10 text-white/35'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {isPending ? 'Unlocking…' : 'Unlock For Editing'}
          </button>

          <button
            type="button"
            onClick={handleSendToClient}
            disabled={isPending || variants.length === 0}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isPending || variants.length === 0
                ? 'cursor-not-allowed bg-white/10 text-white/35'
                : 'bg-violet-500 text-white hover:bg-violet-400'
            }`}
          >
            {isPending ? 'Sending…' : 'Send All 3 to Client'}
          </button>
        </div>
      </div>

      {variants.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-white/50">
          No variants generated yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {variants.map((variant) => (
            <section key={variant.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              {(() => {
                const draft = getDraft(variant)
                const isDirty = JSON.stringify(draft) !== (savedSignatures[variant.variant_index] ?? '')

                return (
                  <div className="mb-2">
                    {isDirty && (
                      <span className="inline-flex text-[10px] uppercase tracking-wide rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-amber-200">
                        Unsaved Changes
                      </span>
                    )}
                  </div>
                )
              })()}

              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-semibold">{variant.variant_label}</p>
                  <p className="text-white/45 text-xs mt-0.5">Template: {variant.template_slug}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide rounded-full border border-white/15 bg-white/5 px-2 py-1 text-white/65">
                  {variant.status}
                </span>
              </div>

              {variant.variant_rationale && (
                <p className="text-xs text-white/70 mb-3">{variant.variant_rationale}</p>
              )}

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2">
                <div className="mx-auto overflow-hidden rounded-lg border border-white/10 bg-white" style={{ width: VIEWPORT_WIDTH[viewport], maxWidth: '100%' }}>
                  <iframe
                    title={`Variant ${variant.variant_index} preview`}
                    src={`${previewBase}?variant=${variant.variant_index}`}
                    className="h-[560px] w-full border-0"
                    loading="lazy"
                    sandbox="allow-same-origin allow-scripts allow-forms"
                  />
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleEditor(variant)}
                    disabled={isReviewLocked}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      isReviewLocked
                        ? 'cursor-not-allowed border-white/10 text-white/35'
                        : 'border-white/15 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {openVariantEditor === variant.variant_index ? 'Close Editor' : 'Edit Variant'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetVariant(variant)}
                    disabled={isPending || isReviewLocked}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      isPending || isReviewLocked
                        ? 'cursor-not-allowed border-white/10 text-white/35'
                        : 'border-white/15 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    Reset Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveVariant(variant)}
                    disabled={isPending || isReviewLocked}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      isPending || isReviewLocked
                        ? 'cursor-not-allowed bg-white/10 text-white/35'
                        : 'bg-emerald-500 text-white hover:bg-emerald-400'
                    }`}
                  >
                    {isPending ? 'Saving…' : 'Save Edits'}
                  </button>
                </div>

                {openVariantEditor === variant.variant_index && (() => {
                  const draft = getDraft(variant)
                  const history = historyByVariant[variant.variant_index] ?? []
                  return (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
                      <label className="block">
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">Variant Label</div>
                        <input
                          value={draft.variant_label}
                          onChange={(event) => {
                            setDraft(variant.variant_index, (current) => ({
                              ...current,
                              variant_label: event.target.value,
                            }))
                          }}
                          className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">Variant Rationale</div>
                        <textarea
                          value={draft.variant_rationale}
                          onChange={(event) => {
                            setDraft(variant.variant_index, (current) => ({
                              ...current,
                              variant_rationale: event.target.value,
                            }))
                          }}
                          rows={3}
                          className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                        />
                      </label>

                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wide text-white/60">Section Controls</p>
                        {draft.sections_json.map((section, sectionIndex) => {
                          const scalarFields = SECTION_FIELD_MAP[section.section] ?? []
                          const contentRecord = section.content && typeof section.content === 'object'
                            ? (section.content as Record<string, unknown>)
                            : {}
                          const stringArraySpec = STRING_ARRAY_FIELD_MAP[section.section]
                          const objectArraySpec = OBJECT_ARRAY_FIELD_MAP[section.section]
                          const stringArrayValues = stringArraySpec && Array.isArray(contentRecord[stringArraySpec.key])
                            ? (contentRecord[stringArraySpec.key] as unknown[])
                            : []
                          const objectArrayValues = objectArraySpec && Array.isArray(contentRecord[objectArraySpec.key])
                            ? (contentRecord[objectArraySpec.key] as unknown[])
                            : []

                          return (
                            <div key={`${section.section}-${section.order}-${sectionIndex}`} className="rounded-lg border border-white/10 bg-slate-900/50 p-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm font-semibold text-white">{startCase(section.section)}</p>
                                <label className="inline-flex items-center gap-1.5 text-xs text-white/70">
                                  <input
                                    type="checkbox"
                                    checked={section.enabled}
                                    onChange={(event) => {
                                      updateSection(variant.variant_index, sectionIndex, (currentSection) => ({
                                        ...currentSection,
                                        enabled: event.target.checked,
                                      }))
                                    }}
                                  />
                                  Enabled
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-xs text-white/70">
                                  Order
                                  <input
                                    type="number"
                                    min={1}
                                    value={section.order}
                                    onChange={(event) => {
                                      const nextOrder = Number(event.target.value)
                                      updateSection(variant.variant_index, sectionIndex, (currentSection) => ({
                                        ...currentSection,
                                        order: Number.isFinite(nextOrder) && nextOrder > 0 ? nextOrder : currentSection.order,
                                      }))
                                    }}
                                    className="w-16 rounded border border-white/15 bg-slate-800 px-2 py-1 text-xs text-white"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => moveSection(variant.variant_index, sectionIndex, 'up')}
                                  disabled={sectionIndex === 0}
                                  className={`rounded border px-2 py-1 text-[11px] ${sectionIndex === 0 ? 'cursor-not-allowed border-white/10 text-white/30' : 'border-white/15 text-white/75 hover:bg-white/10'}`}
                                >
                                  Up
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSection(variant.variant_index, sectionIndex, 'down')}
                                  disabled={sectionIndex === draft.sections_json.length - 1}
                                  className={`rounded border px-2 py-1 text-[11px] ${sectionIndex === draft.sections_json.length - 1 ? 'cursor-not-allowed border-white/10 text-white/30' : 'border-white/15 text-white/75 hover:bg-white/10'}`}
                                >
                                  Down
                                </button>
                              </div>

                              {scalarFields.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 gap-2">
                                  {scalarFields.map((field) => {
                                    const value = typeof contentRecord[field.key] === 'string' ? contentRecord[field.key] as string : ''
                                    return (
                                      <label key={field.key} className="block">
                                        <div className="mb-1 text-[11px] text-white/60">{field.label}</div>
                                        {field.multiline ? (
                                          <textarea
                                            value={value}
                                            maxLength={field.maxLength}
                                            rows={3}
                                            onChange={(event) => {
                                              updateSectionContentField(variant.variant_index, sectionIndex, field.key, event.target.value)
                                            }}
                                            className="w-full rounded border border-white/15 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                                          />
                                        ) : (
                                          <input
                                            value={value}
                                            maxLength={field.maxLength}
                                            onChange={(event) => {
                                              updateSectionContentField(variant.variant_index, sectionIndex, field.key, event.target.value)
                                            }}
                                            className="w-full rounded border border-white/15 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                                          />
                                        )}
                                        {field.maxLength && (
                                          <div className="mt-1 text-right text-[10px] text-white/45">
                                            {value.length}/{field.maxLength}
                                          </div>
                                        )}
                                      </label>
                                    )
                                  })}
                                </div>
                              )}

                              {stringArraySpec && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[11px] uppercase tracking-wide text-white/60">{stringArraySpec.label}</p>
                                    <button
                                      type="button"
                                      onClick={() => addSectionStringArrayItem(variant.variant_index, sectionIndex, stringArraySpec.key)}
                                      className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10"
                                    >
                                      Add
                                    </button>
                                  </div>
                                  {stringArrayValues.map((item, itemIndex) => (
                                    <div key={`${stringArraySpec.key}-${itemIndex}`} className="flex gap-2">
                                      <input
                                        value={typeof item === 'string' ? item : ''}
                                        onChange={(event) => {
                                          updateSectionStringArrayItem(variant.variant_index, sectionIndex, stringArraySpec.key, itemIndex, event.target.value)
                                        }}
                                        placeholder={`${stringArraySpec.itemLabel} ${itemIndex + 1}`}
                                        className="w-full rounded border border-white/15 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeSectionStringArrayItem(variant.variant_index, sectionIndex, stringArraySpec.key, itemIndex)}
                                        className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {objectArraySpec && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[11px] uppercase tracking-wide text-white/60">{objectArraySpec.label}</p>
                                    <button
                                      type="button"
                                      onClick={() => addSectionObjectArrayItem(variant.variant_index, sectionIndex, objectArraySpec.key, objectArraySpec.fields)}
                                      className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10"
                                    >
                                      Add
                                    </button>
                                  </div>

                                  {objectArrayValues.map((item, itemIndex) => {
                                    const itemRecord = asObject(item)
                                    return (
                                      <div key={`${objectArraySpec.key}-${itemIndex}`} className="rounded border border-white/10 bg-slate-900/50 p-2 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[11px] text-white/65">{startCase(objectArraySpec.key)} {itemIndex + 1}</p>
                                          <button
                                            type="button"
                                            onClick={() => removeSectionObjectArrayItem(variant.variant_index, sectionIndex, objectArraySpec.key, itemIndex)}
                                            className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10"
                                          >
                                            Remove
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                          {objectArraySpec.fields.map((field) => (
                                            <label key={field.key} className="block">
                                              <div className="mb-1 text-[11px] text-white/60">{field.label}</div>
                                              {field.multiline ? (
                                                <textarea
                                                  value={typeof itemRecord[field.key] === 'string' ? itemRecord[field.key] as string : ''}
                                                  maxLength={field.maxLength}
                                                  rows={3}
                                                  onChange={(event) => {
                                                    updateSectionObjectArrayField(
                                                      variant.variant_index,
                                                      sectionIndex,
                                                      objectArraySpec.key,
                                                      itemIndex,
                                                      field.key,
                                                      event.target.value,
                                                    )
                                                  }}
                                                  className="w-full rounded border border-white/15 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                                                />
                                              ) : (
                                                <input
                                                  value={typeof itemRecord[field.key] === 'string' ? itemRecord[field.key] as string : ''}
                                                  maxLength={field.maxLength}
                                                  onChange={(event) => {
                                                    updateSectionObjectArrayField(
                                                      variant.variant_index,
                                                      sectionIndex,
                                                      objectArraySpec.key,
                                                      itemIndex,
                                                      field.key,
                                                      event.target.value,
                                                    )
                                                  }}
                                                  className="w-full rounded border border-white/15 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                                                />
                                              )}
                                              {field.maxLength && (
                                                <div className="mt-1 text-right text-[10px] text-white/45">
                                                  {(typeof itemRecord[field.key] === 'string' ? itemRecord[field.key] as string : '').length}/{field.maxLength}
                                                </div>
                                              )}
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-wide text-white/60">Variant History</p>
                          <button
                            type="button"
                            onClick={() => loadVariantHistory(variant.variant_index)}
                            disabled={isPending || loadingHistoryIndex === variant.variant_index}
                            className={`rounded border px-2 py-1 text-[11px] ${isPending || loadingHistoryIndex === variant.variant_index
                              ? 'cursor-not-allowed border-white/10 text-white/35'
                              : 'border-white/15 text-white/75 hover:bg-white/10'
                            }`}
                          >
                            {loadingHistoryIndex === variant.variant_index ? 'Loading…' : 'Refresh'}
                          </button>
                        </div>

                        {history.length === 0 ? (
                          <p className="text-xs text-white/45">No edit snapshots yet for this variant.</p>
                        ) : (
                          <div className="space-y-2">
                            {history.map((entry) => (
                              <div key={entry.versionId} className="rounded border border-white/10 bg-slate-950/40 px-3 py-2">
                                <p className="text-[11px] text-white/85">{entry.summary ?? 'Variant snapshot'}</p>
                                <p className="text-[10px] text-white/45 mt-0.5">{new Date(entry.createdAt).toLocaleString()}</p>
                                <button
                                  type="button"
                                  onClick={() => handleRollbackVariant(variant, entry.versionId)}
                                  disabled={isPending || isReviewLocked}
                                  className={`mt-2 rounded border px-2 py-1 text-[11px] ${isPending || isReviewLocked
                                    ? 'cursor-not-allowed border-white/10 text-white/35'
                                    : 'border-white/15 text-white/75 hover:bg-white/10'
                                  }`}
                                >
                                  Restore Snapshot
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
