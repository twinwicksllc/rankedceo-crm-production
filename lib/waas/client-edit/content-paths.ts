// =============================================================================
// lib/waas/client-edit/content-paths.ts
// Safe JSONPath-style patcher for nested variant section content.
//
// Supports paths like:
//   "sections[0].content.headline"
//   "sections[2].content.body_text"
//   "sections[1].content.image_url"
//   "brand_config.primary_color"
//   "brand_config.business_name"
// =============================================================================

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

// ---------------------------------------------------------------------------
// Path segment types
// ---------------------------------------------------------------------------

type PathSegment =
  | { type: 'key';   key: string }
  | { type: 'index'; index: number }

// ---------------------------------------------------------------------------
// Parse a dot/bracket path string into segments
// e.g. "sections[0].content.headline" →
//   [{type:'key',key:'sections'}, {type:'index',index:0},
//    {type:'key',key:'content'},  {type:'key',key:'headline'}]
// ---------------------------------------------------------------------------

export function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = []
  // Split on . and [ — keep the index numbers
  const parts = path.split(/\.|\[(\d+)\]\.?/).filter(Boolean)

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      segments.push({ type: 'index', index: parseInt(part, 10) })
    } else if (part.trim()) {
      segments.push({ type: 'key', key: part.trim() })
    }
  }

  return segments
}

// ---------------------------------------------------------------------------
// Read a value at path (returns undefined if path does not exist)
// ---------------------------------------------------------------------------

export function getValueAtPath(obj: JsonValue, path: string): JsonValue | undefined {
  const segments = parsePath(path)
  let current: JsonValue = obj

  for (const seg of segments) {
    if (current === null || current === undefined) return undefined

    if (seg.type === 'key') {
      if (typeof current !== 'object' || Array.isArray(current)) return undefined
      current = (current as Record<string, JsonValue>)[seg.key]
    } else {
      if (!Array.isArray(current)) return undefined
      current = current[seg.index]
    }
  }

  return current
}

// ---------------------------------------------------------------------------
// Immutably set a value at path — returns new object
// Returns { ok: true, result } on success or { ok: false, error } on failure
// ---------------------------------------------------------------------------

export type PatchResult =
  | { ok: true;  result: JsonValue }
  | { ok: false; error: string }

export function setValueAtPath(
  obj: JsonValue,
  path: string,
  newValue: JsonValue,
): PatchResult {
  try {
    const segments = parsePath(path)
    if (segments.length === 0) {
      return { ok: false, error: 'Path is empty' }
    }

    const result = deepSetRecursive(obj, segments, 0, newValue)
    return { ok: true, result }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown patch error',
    }
  }
}

function deepSetRecursive(
  current: JsonValue,
  segments: PathSegment[],
  depth: number,
  newValue: JsonValue,
): JsonValue {
  if (depth === segments.length) return newValue

  const seg = segments[depth]

  if (seg.type === 'key') {
    // Treat null/non-object as an empty object at this level
    const base: Record<string, JsonValue> =
      current !== null && typeof current === 'object' && !Array.isArray(current)
        ? { ...(current as Record<string, JsonValue>) }
        : {}

    base[seg.key] = deepSetRecursive(
      base[seg.key] !== undefined ? base[seg.key] : null,
      segments,
      depth + 1,
      newValue,
    )
    return base
  } else {
    // Array index
    const base: JsonValue[] = Array.isArray(current) ? [...current] : []
    // Pad array if index is beyond current length
    while (base.length <= seg.index) base.push(null)
    base[seg.index] = deepSetRecursive(
      base[seg.index],
      segments,
      depth + 1,
      newValue,
    )
    return base
  }
}

// ---------------------------------------------------------------------------
// Validate that a path is allowlisted (prevent arbitrary key injection)
// ---------------------------------------------------------------------------

const ALLOWED_PATH_PREFIXES = [
  'sections[',
  'brand_config.',
] as const

// Brand config keys clients can edit (matches BrandConfig interface in
// lib/waas/templates/types.ts — real shape includes nested colors.* etc.)
const ALLOWED_BRAND_KEYS = new Set([
  'brand_config.business_name',
  'brand_config.tagline',
  'brand_config.logo_url',
  'brand_config.colors.primary',
  'brand_config.colors.secondary',
  'brand_config.colors.accent',
  'brand_config.colors.background',
  'brand_config.colors.text',
  'brand_config.fonts.heading',  // Phase 7.1
  'brand_config.fonts.body',     // Phase 7.1
  'brand_config.contact.phone',
  'brand_config.contact.email',
  'brand_config.contact.address',
  'brand_config.contact.city',
  'brand_config.contact.state',
  'brand_config.contact.zip',
  'brand_config.social.facebook',
  'brand_config.social.instagram',
  'brand_config.social.google',
  'brand_config.social.yelp',
])

// Top-level leaf keys inside sections[N].content (matches the Section*Content
// interfaces in lib/waas/templates/types.ts — all camelCase)
const ALLOWED_SECTION_CONTENT_KEYS = new Set([
  'eyebrow',
  'headline',
  'subheadline',
  'body',
  'intro',
  'primaryCtaLabel',
  'secondaryCtaLabel',
  'locationBadge',
  'bottomCtaText',
  'image_url',        // generic image fields (future-proof)
  'image_alt',
])

// Keys permitted on items in arrays like services[i], faq[i], steps[i],
// badges[i], highlights[i].  Values that are themselves arrays-of-strings
// are matched separately below (highlights[i]).
const ALLOWED_ARRAY_ITEM_KEYS = new Set([
  'title',
  'description',
  'label',
  'sub',
  'icon',
  'question',
  'answer',
])

export type PathValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export function validateEditPath(path: string): PathValidationResult {
  if (!path || typeof path !== 'string') {
    return { valid: false, reason: 'Path must be a non-empty string' }
  }

  if (path.length > 200) {
    return { valid: false, reason: 'Path exceeds maximum length of 200 characters' }
  }

  // Check allowed prefixes
  const hasAllowedPrefix = ALLOWED_PATH_PREFIXES.some((p) => path.startsWith(p))
  if (!hasAllowedPrefix) {
    return { valid: false, reason: `Path must start with one of: ${ALLOWED_PATH_PREFIXES.join(', ')}` }
  }

  // Brand config paths — check against explicit allowlist
  if (path.startsWith('brand_config.')) {
    if (!ALLOWED_BRAND_KEYS.has(path)) {
      return { valid: false, reason: `Brand config key '${path}' is not editable by clients` }
    }
    return { valid: true }
  }

  // Section content paths — validate the leaf key
  // Pattern 1: sections[N].content.<allowed_key>
  const sectionContentMatch = path.match(/^sections\[\d+\]\.content\.([a-zA-Z0-9_]+)$/)
  if (sectionContentMatch) {
    const leafKey = sectionContentMatch[1]
    if (!ALLOWED_SECTION_CONTENT_KEYS.has(leafKey)) {
      return { valid: false, reason: `Section content key '${leafKey}' is not editable by clients` }
    }
    return { valid: true }
  }

  // Pattern 2: sections[N].content.<arrayField>[M].<allowed_item_key>
  //   e.g. sections[2].content.items[0].title
  //        sections[3].content.steps[1].description
  //        sections[4].content.badges[0].label
  const arrayItemMatch = path.match(
    /^sections\[\d+\]\.content\.([a-zA-Z0-9_]+)\[\d+\]\.([a-zA-Z0-9_]+)$/,
  )
  if (arrayItemMatch) {
    const arrayField = arrayItemMatch[1]
    const leafKey    = arrayItemMatch[2]
    const allowedArrayFields = new Set(['items', 'steps', 'badges', 'faq'])
    if (!allowedArrayFields.has(arrayField)) {
      return { valid: false, reason: `Array field '${arrayField}' is not editable by clients` }
    }
    if (!ALLOWED_ARRAY_ITEM_KEYS.has(leafKey)) {
      return { valid: false, reason: `Item key '${leafKey}' is not editable by clients` }
    }
    return { valid: true }
  }

  // Pattern 3: sections[N].content.highlights[M]  (string array, no leaf key)
  const highlightMatch = path.match(/^sections\[\d+\]\.content\.highlights\[\d+\]$/)
  if (highlightMatch) return { valid: true }

  // sections[N].enabled is also allowed (section toggle)
  const sectionEnabledMatch = path.match(/^sections\[\d+\]\.enabled$/)
  if (sectionEnabledMatch) return { valid: true }

  return { valid: false, reason: `Path '${path}' does not match any allowed edit pattern` }
}

// ---------------------------------------------------------------------------
// Extract a plain-text snapshot of a value for diffing / history display
// Truncates long strings and serializes arrays/objects
// ---------------------------------------------------------------------------

export function serializeForHistory(value: JsonValue | undefined, maxLen = 500): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') {
    return value.length > maxLen ? value.slice(0, maxLen) + '…' : value
  }
  const json = JSON.stringify(value)
  return json.length > maxLen ? json.slice(0, maxLen) + '…' : json
}
