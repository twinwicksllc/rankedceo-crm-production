// lib/waas/services/serper/location-utils.ts

export function normalizeSerperLocation(location: string): string {
  const cleaned = location.trim()
  return cleaned.length > 0 ? cleaned : 'United States'
}

export function inferGlFromLocation(location: string): string {
  const value = location.toLowerCase()

  if (/(united states|usa|u\.s\.|\b[a-z]{2},\s*[a-z]{2}\b)/.test(value)) return 'us'
  if (/(united kingdom|uk|england|scotland|wales|northern ireland)/.test(value)) return 'uk'
  if (/canada/.test(value)) return 'ca'
  if (/australia/.test(value)) return 'au'

  return 'us'
}

export function normalizeTextTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function parseLocationParts(location: string): { city: string | null; state: string | null } {
  const parts = location.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return { city: null, state: null }

  const city = parts[0] || null
  const stateRaw = parts[1] || null
  const state = stateRaw ? stateRaw.split(/\s+/)[0] : null

  return { city, state }
}

export function keywordContainsLocation(keyword: string, location: string): boolean {
  const keywordLower = keyword.toLowerCase()
  const locationLower = location.toLowerCase().trim()

  if (locationLower && keywordLower.includes(locationLower)) {
    return true
  }

  const { city, state } = parseLocationParts(location)
  if (city && keywordLower.includes(city.toLowerCase())) {
    return true
  }

  if (state) {
    const stateLower = state.toLowerCase()
    // Match a standalone state token like "il".
    if (new RegExp(`\\b${stateLower}\\b`, 'i').test(keywordLower)) {
      return true
    }
  }

  // Generic geo signals likely indicating geo-intent is already present.
  const geoSignals = ['near me', 'county', 'city', 'illinois', 'chicago']
  if (geoSignals.some(signal => keywordLower.includes(signal))) {
    return true
  }

  return false
}

export function stripLocationFromKeyword(keyword: string, location: string): string {
  const { city, state } = parseLocationParts(location)
  let output = keyword

  const removals = [
    location,
    city,
    state,
    state ? `${city ?? ''} ${state}`.trim() : null,
    state ? `${city ?? ''}, ${state}`.trim() : null,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0))

  for (const part of removals) {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Protect short tokens like US states (e.g. "IL") from matching inside larger words.
    const pattern = part.trim().length <= 3 ? `\\b${escaped}\\b` : escaped
    output = output.replace(new RegExp(pattern, 'ig'), ' ')
  }

  output = output
    .replace(/\bnear me\b/ig, ' ')
    .replace(/\bnear\b/ig, ' ')
    .replace(/\bin\s+[a-z0-9\s]+\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return output
}

export function buildQueryCandidates(keyword: string, location: string): string[] {
  const withLocation = keywordContainsLocation(keyword, location)
    ? keyword.trim()
    : `${keyword.trim()} ${location.trim()}`.trim()
  const bare = keyword.trim()
  const broader = stripLocationFromKeyword(keyword, location)

  const candidates = [withLocation, bare, broader]
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    const cleaned = candidate.trim()
    if (!cleaned) continue

    const key = normalizeTextTokens(cleaned).join(' ')
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(cleaned)
  }

  return deduped
}
