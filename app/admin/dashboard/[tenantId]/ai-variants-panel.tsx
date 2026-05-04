'use client'

import { useMemo, useState, useTransition } from 'react'
import type { SectionConfig } from '@/lib/waas/templates/types'
import type { AdminSiteVariant } from '@/lib/waas/actions/admin'
import { generateAndStoreSiteVariants, getSiteVariants, markVariantsSentToReview, updateSiteVariant } from '@/lib/waas/actions/admin'

type Viewport = 'desktop' | 'mobile'

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  mobile: '390px',
}

const SECTION_FIELD_MAP: Record<string, string[]> = {
  hero: ['headline', 'subheadline', 'primaryCtaLabel', 'locationBadge'],
  services: ['headline', 'subheadline', 'bottomCtaText'],
  trust: ['headline', 'subheadline'],
  about: ['headline', 'body'],
  faq: ['headline', 'intro'],
  'how-it-works': ['headline', 'intro'],
  booking: ['headline', 'subheadline', 'primaryCtaLabel'],
  reviews: ['headline', 'subheadline'],
}

const STRING_ARRAY_FIELD_MAP: Record<string, { key: string; label: string; itemLabel: string }> = {
  about: { key: 'highlights', label: 'Highlights', itemLabel: 'Highlight' },
}

const OBJECT_ARRAY_FIELD_MAP: Record<string, { key: string; label: string; fields: Array<{ key: string; label: string }> }> = {
  services: {
    key: 'items',
    label: 'Service Items',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
      { key: 'icon', label: 'Icon' },
    ],
  },
  trust: {
    key: 'badges',
    label: 'Trust Badges',
    fields: [
      { key: 'label', label: 'Label' },
      { key: 'sub', label: 'Subtext' },
      { key: 'icon', label: 'Icon' },
    ],
  },
  faq: {
    key: 'items',
    label: 'FAQ Items',
    fields: [
      { key: 'question', label: 'Question' },
      { key: 'answer', label: 'Answer' },
    ],
  },
  'how-it-works': {
    key: 'steps',
    label: 'Process Steps',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
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

export function AIVariantsPanel({ tenantId, initialVariants }: { tenantId: string; initialVariants: AdminSiteVariant[] }) {
  const [variants, setVariants] = useState<AdminSiteVariant[]>(initialVariants)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [openVariantEditor, setOpenVariantEditor] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, VariantDraft>>({})
  const [isPending, startTransition] = useTransition()

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
      return {
        ...prev,
        [variantIndex]: updater(current),
      }
    })
  }

  const handleGenerate = () => {
    setMessage(null)
    startTransition(async () => {
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
  }

  const handleSaveVariant = (variant: AdminSiteVariant) => {
    const draft = getDraft(variant)
    setMessage(null)

    startTransition(async () => {
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
      return { ...current, sections_json: nextSections }
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
    fields: Array<{ key: string; label: string }>,
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
            disabled={isPending}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isPending ? 'cursor-not-allowed bg-white/10 text-white/35' : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {isPending ? 'Generating…' : 'Generate / Re-Generate'}
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
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                  >
                    {openVariantEditor === variant.variant_index ? 'Close Editor' : 'Edit Variant'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveVariant(variant)}
                    disabled={isPending}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      isPending
                        ? 'cursor-not-allowed bg-white/10 text-white/35'
                        : 'bg-emerald-500 text-white hover:bg-emerald-400'
                    }`}
                  >
                    {isPending ? 'Saving…' : 'Save Edits'}
                  </button>
                </div>

                {openVariantEditor === variant.variant_index && (() => {
                  const draft = getDraft(variant)
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
                          const fieldNames = SECTION_FIELD_MAP[section.section] ?? []
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
                              </div>

                              {fieldNames.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 gap-2">
                                  {fieldNames.map((fieldName) => {
                                    const value = typeof contentRecord[fieldName] === 'string' ? contentRecord[fieldName] as string : ''
                                    return (
                                      <label key={fieldName} className="block">
                                        <div className="mb-1 text-[11px] text-white/60">{startCase(fieldName)}</div>
                                        <input
                                          value={value}
                                          onChange={(event) => {
                                            updateSectionContentField(variant.variant_index, sectionIndex, fieldName, event.target.value)
                                          }}
                                          className="w-full rounded border border-white/15 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                                        />
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
                                              <input
                                                value={typeof itemRecord[field.key] === 'string' ? itemRecord[field.key] as string : ''}
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
