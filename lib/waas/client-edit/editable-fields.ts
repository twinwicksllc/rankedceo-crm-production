// =============================================================================
// lib/waas/client-edit/editable-fields.ts
// Introspects a variant's sections_json and returns a flat, ordered list of
// EditableField descriptors the navigator UI renders.
//
// Mirrors the allowlist defined in content-paths.ts — only surfaces fields
// the client is actually allowed to edit.
// =============================================================================

import type { SectionConfig, SectionId } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditableFieldKind =
  | 'text'        // single-line
  | 'long_text'   // multi-line / textarea
  | 'color'       // color picker
  | 'image'       // image swap (upload zone + URL fallback)
  | 'toggle'      // section on/off switch (inline — no modal)
  | 'font'        // font family picker (Phase 7.1)

export interface EditableField {
  /** Stable id for React keys */
  id:          string
  /** JSONPath used by updateClientVariantContent / updateClientBrandConfig */
  path:        string
  /** User-facing label */
  label:       string
  /** Current value (always a string for editor UI purposes) */
  value:       string
  /** Which input kind to render */
  kind:        EditableFieldKind
  /** Grouping label for the navigator */
  group:       string
  /** Scope — section-scoped or brand-wide */
  scope:       'section' | 'brand'
  /** Optional — section id when scope = 'section' */
  sectionId?:  SectionId
  /** Optional — section order for stable scroll targeting */
  sectionOrder?: number
  /** Soft character-count hint for the input */
  maxLength?:  number
}

export interface BrandConfigLike {
  business_name?: string
  tagline?:       string | null
  logo_url?:      string | null
  fonts?: {
    heading?: string | null
    body?:    string | null
  }
  colors?: {
    primary?:    string
    secondary?:  string
    accent?:     string
    background?: string
    text?:       string
  }
  contact?: {
    phone?:   string | null
    email?:   string | null
    address?: string | null
    city?:    string | null
    state?:   string | null
    zip?:     string | null
  }
  social?: {
    facebook?:  string | null
    instagram?: string | null
    google?:    string | null
    yelp?:      string | null
  }
}

// ---------------------------------------------------------------------------
// Section-level label map (friendly names for the navigator groups)
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<string, string> = {
  hero:           'Hero',
  services:       'Services',
  trust:          'Trust Badges',
  financing:      'Financing',
  booking:        'Booking',
  reviews:        'Reviews',
  about:          'About',
  faq:            'FAQ',
  'how-it-works': 'How It Works',
}

// Sections the client cannot toggle off (always required)
const REQUIRED_SECTION_IDS = new Set<string>(['hero', 'booking'])

function sectionLabel(id: string, order: number): string {
  const base = SECTION_LABELS[id] ?? id
  return `${order + 1}. ${base}`
}

// ---------------------------------------------------------------------------
// Leaf-field configs per section id
// ---------------------------------------------------------------------------

type LeafDef = {
  key:        string
  label:      string
  kind:       EditableFieldKind
  maxLength?: number
}

const SECTION_LEAF_FIELDS: Partial<Record<SectionId, LeafDef[]>> = {
  hero: [
    { key: 'eyebrow',           label: 'Eyebrow',           kind: 'text',      maxLength: 60 },
    { key: 'headline',          label: 'Headline',          kind: 'text',      maxLength: 120 },
    { key: 'subheadline',       label: 'Subheadline',       kind: 'long_text', maxLength: 240 },
    { key: 'primaryCtaLabel',   label: 'Primary CTA',       kind: 'text',      maxLength: 40 },
    { key: 'secondaryCtaLabel', label: 'Secondary CTA',     kind: 'text',      maxLength: 40 },
    { key: 'locationBadge',     label: 'Location Badge',    kind: 'text',      maxLength: 80 },
  ],
  services: [
    { key: 'eyebrow',       label: 'Eyebrow',       kind: 'text',      maxLength: 60 },
    { key: 'headline',      label: 'Headline',      kind: 'text',      maxLength: 120 },
    { key: 'subheadline',   label: 'Subheadline',   kind: 'long_text', maxLength: 240 },
    { key: 'bottomCtaText', label: 'Bottom CTA',    kind: 'text',      maxLength: 60 },
  ],
  trust: [
    { key: 'headline',    label: 'Headline',    kind: 'text',      maxLength: 120 },
    { key: 'subheadline', label: 'Subheadline', kind: 'long_text', maxLength: 240 },
  ],
  about: [
    { key: 'eyebrow',  label: 'Eyebrow',  kind: 'text',      maxLength: 60  },
    { key: 'headline', label: 'Headline', kind: 'text',      maxLength: 120 },
    { key: 'body',     label: 'Body',     kind: 'long_text', maxLength: 800 },
  ],
  faq: [
    { key: 'eyebrow',  label: 'Eyebrow',  kind: 'text',      maxLength: 60  },
    { key: 'headline', label: 'Headline', kind: 'text',      maxLength: 120 },
    { key: 'intro',    label: 'Intro',    kind: 'long_text', maxLength: 300 },
  ],
  'how-it-works': [
    { key: 'eyebrow',  label: 'Eyebrow',  kind: 'text',      maxLength: 60  },
    { key: 'headline', label: 'Headline', kind: 'text',      maxLength: 120 },
    { key: 'intro',    label: 'Intro',    kind: 'long_text', maxLength: 300 },
  ],
  booking: [
    { key: 'eyebrow',         label: 'Eyebrow',       kind: 'text',      maxLength: 60  },
    { key: 'headline',        label: 'Headline',      kind: 'text',      maxLength: 120 },
    { key: 'subheadline',     label: 'Subheadline',   kind: 'long_text', maxLength: 240 },
    { key: 'primaryCtaLabel', label: 'Primary CTA',   kind: 'text',      maxLength: 40  },
  ],
  reviews: [
    { key: 'eyebrow',     label: 'Eyebrow',     kind: 'text',      maxLength: 60  },
    { key: 'headline',    label: 'Headline',    kind: 'text',      maxLength: 120 },
    { key: 'subheadline', label: 'Subheadline', kind: 'long_text', maxLength: 240 },
  ],
}

// Array-of-objects fields per section (items / steps / badges / faq items)
const SECTION_ARRAY_FIELDS: Partial<Record<SectionId, {
  arrayKey: string
  itemLabel: (index: number) => string
  leafs:    LeafDef[]
}>> = {
  services: {
    arrayKey:  'items',
    itemLabel: (i) => `Service ${i + 1}`,
    leafs: [
      { key: 'title',       label: 'Title',       kind: 'text',      maxLength: 80  },
      { key: 'description', label: 'Description', kind: 'long_text', maxLength: 240 },
    ],
  },
  trust: {
    arrayKey:  'badges',
    itemLabel: (i) => `Badge ${i + 1}`,
    leafs: [
      { key: 'label', label: 'Label', kind: 'text', maxLength: 40 },
      { key: 'sub',   label: 'Sub',   kind: 'text', maxLength: 60 },
    ],
  },
  faq: {
    arrayKey:  'items',
    itemLabel: (i) => `Question ${i + 1}`,
    leafs: [
      { key: 'question', label: 'Question', kind: 'text',      maxLength: 160 },
      { key: 'answer',   label: 'Answer',   kind: 'long_text', maxLength: 600 },
    ],
  },
  'how-it-works': {
    arrayKey:  'steps',
    itemLabel: (i) => `Step ${i + 1}`,
    leafs: [
      { key: 'title',       label: 'Title',       kind: 'text',      maxLength: 80  },
      { key: 'description', label: 'Description', kind: 'long_text', maxLength: 240 },
    ],
  },
}

// ---------------------------------------------------------------------------
// Build editable fields for a single section
// ---------------------------------------------------------------------------

function fieldsForSection(section: SectionConfig): EditableField[] {
  const out: EditableField[] = []
  const order = section.order
  const sid   = section.section
  const group = sectionLabel(sid, order)
  const content = (section.content ?? {}) as Record<string, unknown>

  // Leaf scalar fields
  const leafs = SECTION_LEAF_FIELDS[sid] ?? []
  for (const leaf of leafs) {
    const current = content[leaf.key]
    if (current === undefined) continue  // only surface fields the variant populated
    out.push({
      id:           `sec-${order}-${leaf.key}`,
      path:         `sections[${order}].content.${leaf.key}`,
      label:        leaf.label,
      value:        current == null ? '' : String(current),
      kind:         leaf.kind,
      group,
      scope:        'section',
      sectionId:    sid,
      sectionOrder: order,
      maxLength:    leaf.maxLength,
    })
  }

  // Array-of-objects fields
  const arrayDef = SECTION_ARRAY_FIELDS[sid]
  if (arrayDef) {
    const arr = content[arrayDef.arrayKey]
    if (Array.isArray(arr)) {
      arr.forEach((item, i) => {
        if (!item || typeof item !== 'object') return
        const itemObj = item as Record<string, unknown>
        for (const leaf of arrayDef.leafs) {
          const current = itemObj[leaf.key]
          if (current === undefined) continue
          out.push({
            id:           `sec-${order}-${arrayDef.arrayKey}-${i}-${leaf.key}`,
            path:         `sections[${order}].content.${arrayDef.arrayKey}[${i}].${leaf.key}`,
            label:        `${arrayDef.itemLabel(i)} — ${leaf.label}`,
            value:        current == null ? '' : String(current),
            kind:         leaf.kind,
            group,
            scope:        'section',
            sectionId:    sid,
            sectionOrder: order,
            maxLength:    leaf.maxLength,
          })
        }
      })
    }
  }

  // About.highlights (string array)
  if (sid === 'about') {
    const highlights = content['highlights']
    if (Array.isArray(highlights)) {
      highlights.forEach((h, i) => {
        out.push({
          id:           `sec-${order}-highlights-${i}`,
          path:         `sections[${order}].content.highlights[${i}]`,
          label:        `Highlight ${i + 1}`,
          value:        h == null ? '' : String(h),
          kind:         'text',
          group,
          scope:        'section',
          sectionId:    sid,
          sectionOrder: order,
          maxLength:    120,
        })
      })
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Build editable brand-config fields
// ---------------------------------------------------------------------------

function fieldsForBrandConfig(brand: BrandConfigLike): EditableField[] {
  const out: EditableField[] = []
  const group = 'Business Info'

  const push = (
    id: string, path: string, label: string, value: unknown,
    kind: EditableFieldKind, maxLength?: number,
  ) => {
    out.push({
      id, path, label,
      value: value == null ? '' : String(value),
      kind, group, scope: 'brand', maxLength,
    })
  }

  push('brand-business-name', 'brand_config.business_name', 'Business Name', brand.business_name, 'text', 80)
  push('brand-tagline',       'brand_config.tagline',       'Tagline',       brand.tagline,       'text', 120)

  if (brand.logo_url !== undefined) {
    push('brand-logo', 'brand_config.logo_url', 'Logo URL', brand.logo_url, 'image')
  }

  const g = 'Brand Colors'
  const c = brand.colors ?? {}
  out.push(
    { id: 'brand-color-primary',    path: 'brand_config.colors.primary',    label: 'Primary Color',    value: c.primary    ?? '#2563EB', kind: 'color', group: g, scope: 'brand' },
    { id: 'brand-color-secondary',  path: 'brand_config.colors.secondary',  label: 'Secondary Color',  value: c.secondary  ?? '#1E40AF', kind: 'color', group: g, scope: 'brand' },
    { id: 'brand-color-accent',     path: 'brand_config.colors.accent',     label: 'Accent Color',     value: c.accent     ?? '#F59E0B', kind: 'color', group: g, scope: 'brand' },
  )

  // Phase 7.1: Font family pickers
  const fg = 'Fonts'
  const f  = brand.fonts ?? {}
  out.push(
    {
      id:    'brand-font-heading',
      path:  'brand_config.fonts.heading',
      label: 'Heading Font',
      value: f.heading ?? 'Inter',
      kind:  'font',
      group: fg,
      scope: 'brand',
    },
    {
      id:    'brand-font-body',
      path:  'brand_config.fonts.body',
      label: 'Body Font',
      value: f.body ?? 'Inter',
      kind:  'font',
      group: fg,
      scope: 'brand',
    },
  )

  const cg = 'Contact'
  const ct = brand.contact ?? {}
  out.push(
    { id: 'brand-contact-phone',   path: 'brand_config.contact.phone',   label: 'Phone',   value: ct.phone   ?? '', kind: 'text', group: cg, scope: 'brand', maxLength: 40  },
    { id: 'brand-contact-email',   path: 'brand_config.contact.email',   label: 'Email',   value: ct.email   ?? '', kind: 'text', group: cg, scope: 'brand', maxLength: 120 },
    { id: 'brand-contact-address', path: 'brand_config.contact.address', label: 'Address', value: ct.address ?? '', kind: 'text', group: cg, scope: 'brand', maxLength: 200 },
  )

  return out
}

// ---------------------------------------------------------------------------
// Public: build the full field list for the editor navigator
// ---------------------------------------------------------------------------

export interface BuildEditableFieldsInput {
  sections:    SectionConfig[]
  brandConfig: BrandConfigLike
}

export function buildEditableFields(input: BuildEditableFieldsInput): EditableField[] {
  const out: EditableField[] = []

  // ---- Section visibility toggles (first group — always at the top) ----
  const allSections = [...input.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const section of allSections) {
    if (!section) continue
    const sid    = section.section
    const order  = section.order
    const label  = SECTION_LABELS[sid] ?? sid
    const isReq  = REQUIRED_SECTION_IDS.has(sid)

    out.push({
      id:           `sec-${order}-enabled`,
      path:         `sections[${order}].enabled`,
      label:        `${label}`,
      value:        String(section.enabled !== false),
      kind:         'toggle',
      group:        'Sections on your site',
      scope:        'section',
      sectionId:    sid,
      sectionOrder: order,
      // Encode whether this section is required in maxLength (convention: -1 = required)
      maxLength:    isReq ? -1 : undefined,
    })
  }

  // ---- Brand-wide fields ----
  out.push(...fieldsForBrandConfig(input.brandConfig))

  // ---- Per-section editable fields (only for enabled sections) ----
  const enabledSections = allSections.filter((s) => s && s.enabled !== false)
  for (const section of enabledSections) {
    out.push(...fieldsForSection(section))
  }

  return out
}

// ---------------------------------------------------------------------------
// Group editable fields by their `group` label, preserving insertion order
// ---------------------------------------------------------------------------

export interface FieldGroup {
  group:  string
  fields: EditableField[]
}

export function groupEditableFields(fields: EditableField[]): FieldGroup[] {
  const groups: FieldGroup[] = []
  const map = new Map<string, FieldGroup>()

  for (const field of fields) {
    let g = map.get(field.group)
    if (!g) {
      g = { group: field.group, fields: [] }
      map.set(field.group, g)
      groups.push(g)
    }
    g.fields.push(field)
  }

  return groups
}

// ---------------------------------------------------------------------------
// assetSlotFromPath
// Derives a safe storage-path slug from a field path.
// Used by the upload zone to build the Supabase Storage key.
//
// Examples:
//   "sections[0].content.image_url"            → "section-0-image"
//   "sections[2].content.items[1].image_url"   → "section-2-items-1-image"
//   "brand_config.logo_url"                    → "brand-logo"
// ---------------------------------------------------------------------------

export function assetSlotFromPath(path: string): string {
  if (path === 'brand_config.logo_url') return 'brand-logo'

  // sections[N].content.image_url
  const simple = path.match(/^sections\[(\d+)\]\.content\.([a-z_]+)$/)
  if (simple) {
    const [, idx, key] = simple
    const baseKey = key.replace(/_url$/, '').replace(/_/g, '-')
    return `section-${idx}-${baseKey}`
  }

  // sections[N].content.items[M].image_url
  const nested = path.match(/^sections\[(\d+)\]\.content\.([a-z_]+)\[(\d+)\]\.([a-z_]+)$/)
  if (nested) {
    const [, secIdx, arrKey, itemIdx, key] = nested
    const baseKey = key.replace(/_url$/, '').replace(/_/g, '-')
    return `section-${secIdx}-${arrKey}-${itemIdx}-${baseKey}`
  }

  // Fallback: sanitise the whole path
  return path.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().slice(0, 60)
}
