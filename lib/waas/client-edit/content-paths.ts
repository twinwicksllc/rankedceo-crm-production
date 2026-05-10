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

const ALLOWED_BRAND_KEYS = new Set([
  'brand_config.business_name',
  'brand_config.tagline',
  'brand_config.primary_color',
  'brand_config.secondary_color',
  'brand_config.accent_color',
  'brand_config.logo_url',
  'brand_config.hero_title',
  'brand_config.hero_subtitle',
])

const ALLOWED_SECTION_CONTENT_KEYS = new Set([
  'headline',
  'subheadline',
  'body_text',
  'cta_text',
  'cta_url',
  'image_url',
  'image_alt',
  'caption',
  'label',
  'title',
  'description',
  'items',
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
  // Pattern: sections[N].content.<allowed_key>
  const sectionContentMatch = path.match(/^sections\[\d+\]\.content\.(.+)$/)
  if (sectionContentMatch) {
    const leafKey = sectionContentMatch[1]
    if (!ALLOWED_SECTION_CONTENT_KEYS.has(leafKey)) {
      return { valid: false, reason: `Section content key '${leafKey}' is not editable by clients` }
    }
    return { valid: true }
  }

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
