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
  position: number | null   // null = not in top 100
  title:    string
  snippet:  string
}

export interface SearchRankReport {
  keyword:        string
  location:       string
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
  const queryWithLocation = `${keyword} ${location}`

  let searchResults = await serperSearch(queryWithLocation, location, 100)
  let organic = searchResults?.organic ?? []

  // Retry without location suffix if provider returned empty results for localized query.
  if (organic.length === 0) {
    searchResults = await serperSearch(keyword, location, 100)
    organic = searchResults?.organic ?? []
  }

  if (!searchResults || organic.length === 0) return null

  const targetDomain = extractDomain(targetUrl)
  const targetRank   = findDomainRank(targetDomain, organic)

  const competitorResults: RankResult[] = competitorUrls.map(url => {
    const domain = extractDomain(url)
    const rank   = findDomainRank(domain, organic)
    return {
      url,
      domain,
      position: rank.position,
      title:    rank.title,
      snippet:  rank.snippet,
    }
  })

  return {
    keyword,
    location,
    targetResult: {
      url:      targetUrl,
      domain:   targetDomain,
      position: targetRank.position,
      title:    targetRank.title,
      snippet:  targetRank.snippet,
    },
    competitorResults,
    allResults:  organic.slice(0, 10),   // top 10 for display
    searchedAt:  new Date().toISOString(),
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