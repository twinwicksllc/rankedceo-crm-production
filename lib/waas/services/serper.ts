// =============================================================================
// Serper.dev API Integration
// Google Search results for rank tracking
// Docs: https://serper.dev/docs
// =============================================================================

export interface SerperSearchResult {
  position:    number
  title:       string
  link:        string
  snippet:     string
  displayLink: string
  domain:      string
}

export interface SerperOrganicResults {
  searchParameters: { q: string; gl: string; hl: string; num: number }
  organic:          SerperSearchResult[]
  peopleAlsoAsk?:   { question: string; snippet: string }[]
  relatedSearches?: { query: string }[]
}

export interface RankResult {
  url:      string
  domain:   string
  position: number | null   // null = not in tracked SERP window (top N)
  title:    string
  snippet:  string
}

export interface SearchRankReport {
  keyword:        string
  location:       string
  queryUsed:      string
  resultsReturned: number
  maxTrackedPosition: number
  targetResult:   RankResult
  competitorResults: RankResult[]
  allResults:     SerperSearchResult[]
  searchedAt:     string
}

// ---------------------------------------------------------------------------
// Extract domain from URL
// ---------------------------------------------------------------------------
export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

function normalizeSerperLocation(location: string): string {
  const cleaned = location.trim()
  return cleaned.length > 0 ? cleaned : 'United States'
}

function inferGlFromLocation(location: string): string {
  const value = location.toLowerCase()

  if (/(united states|usa|u\.s\.|\b[a-z]{2},\s*[a-z]{2}\b)/.test(value)) return 'us'
  if (/(united kingdom|uk|england|scotland|wales|northern ireland)/.test(value)) return 'uk'
  if (/canada/.test(value)) return 'ca'
  if (/australia/.test(value)) return 'au'

  return 'us'
}

function normalizeTextTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function parseLocationParts(location: string): { city: string | null; state: string | null } {
  const parts = location.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return { city: null, state: null }

  const city = parts[0] || null
  const stateRaw = parts[1] || null
  const state = stateRaw ? stateRaw.split(/\s+/)[0] : null

  return { city, state }
}

function keywordContainsLocation(keyword: string, location: string): boolean {
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

function stripLocationFromKeyword(keyword: string, location: string): string {
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
    output = output.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ')
  }

  output = output
    .replace(/\bnear me\b/ig, ' ')
    .replace(/\bin\s+[a-z0-9\s]+\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return output
}

function buildQueryCandidates(keyword: string, location: string): string[] {
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

// ---------------------------------------------------------------------------
// Run a single Serper search and return organic results
// ---------------------------------------------------------------------------
async function serperSearch(
  query: string,
  location: string = 'United States',
  numResults: number = 100
): Promise<SerperOrganicResults | null> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    console.warn('[Serper] SERPER_API_KEY not set — returning null')
    return null
  }

  try {
    const normalizedLocation = normalizeSerperLocation(location)
    const gl = inferGlFromLocation(normalizedLocation)

    const response = await fetch('https://google.serper.dev/search', {
      method:  'POST',
      headers: {
        'X-API-KEY':    apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q:         query,
        num:       numResults,
        gl,
        hl:        'en',
        location:  normalizedLocation,
      }),
      // No cache — always fresh results
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error(`[Serper] API error ${response.status}: ${await response.text()}`)
      return null
    }

    return await response.json() as SerperOrganicResults
  } catch (err) {
    console.error('[Serper] Fetch error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Find rank position of a domain in search results
// ---------------------------------------------------------------------------
function findDomainRank(
  domain: string,
  results: SerperSearchResult[]
): { position: number | null; title: string; snippet: string; link: string } {
  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase()

  for (const result of results) {
    const resultDomain = result.link
      ? extractDomain(result.link).toLowerCase()
      : ''

    if (resultDomain === normalizedDomain || resultDomain.endsWith(`.${normalizedDomain}`)) {
      return {
        position: result.position,
        title:    result.title   ?? '',
        snippet:  result.snippet ?? '',
        link:     result.link    ?? '',
      }
    }
  }

  return { position: null, title: '', snippet: '', link: '' }
}

// ---------------------------------------------------------------------------
// Main: Get search rankings for target + competitors
// ---------------------------------------------------------------------------
export async function getSearchRankings(
  targetUrl:       string,
  competitorUrls:  string[],
  keyword:         string,
  location:        string = 'Chicago, IL'
): Promise<SearchRankReport | null> {
  const targetDomain = extractDomain(targetUrl)
  const queries = buildQueryCandidates(keyword, location)

  let bestQuery = ''
  let bestOrganic: SerperSearchResult[] = []
  let bestSearchResults: SerperOrganicResults | null = null

  for (const query of queries) {
    const searchResults = await serperSearch(query, location, 100)
    const organic = searchResults?.organic ?? []
    if (!searchResults || organic.length === 0) continue

    const targetRank = findDomainRank(targetDomain, organic)
    const competitorRanks = competitorUrls.map(url => {
      const domain = extractDomain(url)
      return findDomainRank(domain, organic)
    })

    const hasAnyMatch = targetRank.position !== null || competitorRanks.some(rank => rank.position !== null)

    bestQuery = query
    bestOrganic = organic
    bestSearchResults = searchResults

    // Prefer the first query that yields at least one domain match.
    if (hasAnyMatch) break
  }

  if (!bestSearchResults || bestOrganic.length === 0) return null

  const targetRank = findDomainRank(targetDomain, bestOrganic)

  const competitorResults: RankResult[] = competitorUrls.map(url => {
    const domain = extractDomain(url)
    const rank = findDomainRank(domain, bestOrganic)
    return {
      url,
      domain,
      position: rank.position,
      title: rank.title,
      snippet: rank.snippet,
    }
  })

  const maxTrackedPosition = bestSearchResults.searchParameters?.num ?? bestOrganic.length

  return {
    keyword,
    location,
    queryUsed: bestQuery,
    resultsReturned: bestOrganic.length,
    maxTrackedPosition,
    targetResult: {
      url: targetUrl,
      domain: targetDomain,
      position: targetRank.position,
      title: targetRank.title,
      snippet: targetRank.snippet,
    },
    competitorResults,
    allResults: bestOrganic.slice(0, 10),   // top 10 for display
    searchedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Generate industry-specific keywords from URL + location
// ---------------------------------------------------------------------------
export function generateKeywords(
  targetUrl:  string,
  industry:   string | null,
  location:   string | null
): string[] {
  const loc = location ?? 'Chicago, IL'
  const city = loc.split(',')[0].trim()

  const industryKeywords: Record<string, string[]> = {
    plumbing:    [`plumber in ${city}`, `plumbing company ${city}`, `emergency plumber ${city}`],
    hvac:        [`HVAC company ${city}`, `AC repair ${city}`, `heating and cooling ${city}`],
    electrical:  [`electrician ${city}`, `electrical contractor ${city}`, `licensed electrician ${city}`],
    roofing:     [`roofing company ${city}`, `roof repair ${city}`, `roofer near me ${city}`],
    landscaping: [`landscaping company ${city}`, `lawn care ${city}`, `landscape design ${city}`],
    real_estate: [`real estate agent ${city}`, `homes for sale ${city}`, `realtor ${city}`],
    dental:      [`dentist in ${city}`, `dental office ${city}`, `family dentist ${city}`],
    default:     [`${industry ?? 'local business'} ${city}`, `best ${industry ?? 'contractor'} ${city}`],
  }

  const key = industry?.toLowerCase() ?? 'default'
  return industryKeywords[key] ?? industryKeywords.default
}

// ---------------------------------------------------------------------------
// MOCK: Returns realistic-looking data for dev/testing (no API key needed)
// ---------------------------------------------------------------------------
export function getMockSearchRankings(
  targetUrl:       string,
  competitorUrls:  string[],
  keyword:         string,
  location:        string
): SearchRankReport {
  const targetDomain = extractDomain(targetUrl)

  // Randomly place target between position 8-45 (not great)
  const targetPos = Math.floor(Math.random() * 37) + 8

  const competitorResults: RankResult[] = competitorUrls.map((url, i) => ({
    url,
    domain:   extractDomain(url),
    position: i + 1,   // Competitors rank 1st, 2nd, 3rd
    title:    `${extractDomain(url)} - Professional Services`,
    snippet:  `Trusted local service provider. Call us today for a free estimate.`,
  }))

  const mockOrganic: SerperSearchResult[] = [
    ...competitorUrls.slice(0, 3).map((url, i) => ({
      position:    i + 1,
      title:       `${extractDomain(url)} - Local Experts`,
      link:        url,
      snippet:     'Trusted by 500+ local customers. Free estimates available.',
      displayLink: extractDomain(url),
      domain:      extractDomain(url),
    })),
    {
      position:    targetPos,
      title:       `${targetDomain} - Home Services`,
      link:        targetUrl,
      snippet:     'Serving the local area. Contact us for more information.',
      displayLink: targetDomain,
      domain:      targetDomain,
    },
  ]

  return {
    keyword,
    location,
    queryUsed: keyword,
    resultsReturned: 100,
    maxTrackedPosition: 100,
    targetResult: {
      url:      targetUrl,
      domain:   targetDomain,
      position: targetPos,
      title:    `${targetDomain} - Home Services`,
      snippet:  'Serving the local area. Contact us for more information.',
    },
    competitorResults,
    allResults:  mockOrganic,
    searchedAt:  new Date().toISOString(),
  }
}