// RankedCEO WaaS — Section validation & normalisation helpers (no 'use server')
import type { SectionConfig, SectionId } from '@/lib/waas/templates/types'

function toSectionConfigList(value: unknown): SectionConfig[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SectionConfig => {
    if (!item || typeof item !== 'object') return false
    const row = item as Record<string, unknown>
    return typeof row.section === 'string' && typeof row.enabled === 'boolean' && typeof row.order === 'number' && typeof row.config === 'object' && row.config !== null
  })
}


function getCoreSectionFailures(enabledSections: string[]): string[] {
  const required = ['hero', 'services', 'booking']
  return required.filter((section) => !enabledSections.includes(section))
}


function normalizeVariantSections(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      ...section,
      order: index + 1,
      config: section.config && typeof section.config === 'object' ? section.config : {},
    }))
}


function readContentString(content: unknown, key: string): string | null {
  if (!content || typeof content !== 'object') return null
  const value = (content as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}


function validateStringLength(value: string | null, max: number, label: string): string | null {
  if (value && value.length > max) {
    return `${label} must be ${max} characters or fewer.`
  }
  return null
}


function validateVariantSections(sections: SectionConfig[]): string | null {
  for (const section of sections) {
    const headline = readContentString(section.content, 'headline')
    const subheadline = readContentString(section.content, 'subheadline')
    const eyebrow = readContentString(section.content, 'eyebrow')

    const headlineErr = validateStringLength(headline, 140, `${section.section} headline`)
    if (headlineErr) return headlineErr

    const subheadlineErr = validateStringLength(subheadline, 700, `${section.section} subheadline`)
    if (subheadlineErr) return subheadlineErr

    const eyebrowErr = validateStringLength(eyebrow, 60, `${section.section} eyebrow`)
    if (eyebrowErr) return eyebrowErr

    if (section.section === 'about') {
      const body = readContentString(section.content, 'body')
      const bodyErr = validateStringLength(body, 2500, 'About body')
      if (bodyErr) return bodyErr

      const highlights = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).highlights
        : null

      if (Array.isArray(highlights)) {
        if (highlights.length > 10) return 'About highlights are limited to 10 items.'
        for (const item of highlights) {
          if (typeof item !== 'string') return 'About highlights must be text items.'
          if (item.length > 120) return 'Each About highlight must be 120 characters or fewer.'
        }
      }
    }

    if (section.section === 'faq') {
      const faqItems = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).items
        : null

      if (Array.isArray(faqItems)) {
        if (faqItems.length > 12) return 'FAQ supports up to 12 items.'
        for (const item of faqItems) {
          if (!item || typeof item !== 'object') return 'FAQ items must be objects.'
          const row = item as Record<string, unknown>
          const question = typeof row.question === 'string' ? row.question.trim() : ''
          const answer = typeof row.answer === 'string' ? row.answer.trim() : ''
          if (!question) return 'Each FAQ item requires a question.'
          if (!answer) return 'Each FAQ item requires an answer.'
          if (question.length > 180) return 'FAQ questions must be 180 characters or fewer.'
          if (answer.length > 700) return 'FAQ answers must be 700 characters or fewer.'
        }
      }
    }

    if (section.section === 'how-it-works') {
      const steps = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).steps
        : null

      if (Array.isArray(steps)) {
        if (steps.length > 8) return 'How It Works supports up to 8 steps.'
        for (const item of steps) {
          if (!item || typeof item !== 'object') return 'How It Works steps must be objects.'
          const row = item as Record<string, unknown>
          const title = typeof row.title === 'string' ? row.title.trim() : ''
          const description = typeof row.description === 'string' ? row.description.trim() : ''
          if (!title) return 'Each How It Works step requires a title.'
          if (!description) return 'Each How It Works step requires a description.'
          if (title.length > 100) return 'How It Works step titles must be 100 characters or fewer.'
          if (description.length > 320) return 'How It Works step descriptions must be 320 characters or fewer.'
        }
      }
    }

    if (section.section === 'services') {
      const items = section.content && typeof section.content === 'object'
        ? (section.content as Record<string, unknown>).items
        : null

      if (Array.isArray(items)) {
        if (items.length > 12) return 'Services supports up to 12 items.'
        for (const item of items) {
          if (!item || typeof item !== 'object') return 'Service items must be objects.'
          const row = item as Record<string, unknown>
          const title = typeof row.title === 'string' ? row.title.trim() : ''
          if (!title) return 'Each service item requires a title.'
          if (title.length > 90) return 'Service item titles must be 90 characters or fewer.'
          const description = typeof row.description === 'string' ? row.description : null
          const descriptionErr = validateStringLength(description, 260, 'Service item description')
          if (descriptionErr) return descriptionErr
        }
      }
    }
  }

  return null
}


function getVariantCoreSectionFailures(sections: SectionConfig[]): string[] {
  const enabled = new Set(sections.filter((section) => section.enabled).map((section) => section.section))
  const required: Array<SectionId> = ['hero', 'services', 'booking']
  return required.filter((section) => !enabled.has(section))
}


function validateVariantReviewReadiness(
  variantIndex: number,
  sections: SectionConfig[],
): string | null {
  const contentValidation = validateVariantSections(sections)
  if (contentValidation) {
    return `Variant ${variantIndex}: ${contentValidation}`
  }

  const coreSectionFailures = getVariantCoreSectionFailures(sections)
  if (coreSectionFailures.length > 0) {
    return `Variant ${variantIndex}: missing required enabled sections (${coreSectionFailures.join(', ')}).`
  }

  return null
}


