// lib/waas/services/serper/search-client.ts
import { auditDebug, SERPER_TARGET_RESULTS, SerperOrganicResults, SerperSearchResult, extractDomain } from './types'
import { normalizeSerperLocation, inferGlFromLocation } from './location-utils'

// ---------------------------------------------------------------------------
// Run a single Serper search and return organic results
// ---------------------------------------------------------------------------
export async function serperSearch(
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

    auditDebug('query:start', {
      query,
      location: normalizedLocation,
      gl,
      requestedNum: numResults,
    })

    const perPage = Math.min(10, numResults)
    const totalPages = Math.max(1, Math.ceil(numResults / perPage))
    const mergedResults: SerperSearchResult[] = []
    const seenLinks = new Set<string>()
    let firstPage: SerperOrganicResults | null = null

    for (let page = 1; page <= totalPages; page += 1) {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: perPage,
          page,
          gl,
          hl: 'en',
          location: normalizedLocation,
        }),
        // No cache — always fresh results
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error(`[Serper] API error ${response.status}: ${await response.text()}`)
        auditDebug('query:error', {
          query,
          page,
          status: response.status,
        })
        // Keep partial data if we already collected results.
        break
      }

      const parsed = await response.json() as SerperOrganicResults
      if (!firstPage) firstPage = parsed

      const pageOrganic = parsed.organic ?? []
      auditDebug('query:page_success', {
        query,
        page,
        pageResults: pageOrganic.length,
        providerNum: parsed.searchParameters?.num ?? null,
      })

      if (pageOrganic.length === 0) break

      let addedThisPage = 0
      for (const row of pageOrganic) {
        const key = row.link || `${row.title}|${row.displayLink}`
        if (!key || seenLinks.has(key)) continue
        seenLinks.add(key)
        mergedResults.push({
          ...row,
          position: mergedResults.length + 1,
        })
        addedThisPage += 1
        if (mergedResults.length >= numResults) break
      }

      // Stop if no new rows were added (depth cap / duplicate pages).
      if (addedThisPage === 0 || mergedResults.length >= numResults) break
    }

    if (!firstPage || mergedResults.length === 0) {
      auditDebug('query:empty', {
        query,
        requestedNum: numResults,
      })
      return null
    }

    const aggregated: SerperOrganicResults = {
      ...firstPage,
      searchParameters: {
        ...firstPage.searchParameters,
        num: mergedResults.length,
      },
      organic: mergedResults,
    }

    auditDebug('query:success', {
      query,
      requestedNum: numResults,
      resultsReturned: aggregated.organic.length,
      providerQuery: aggregated.searchParameters?.q ?? null,
    })
    return aggregated
  } catch (err) {
    console.error('[Serper] Fetch error:', err)
    auditDebug('query:fetch_error', {
      query,
      error: String(err).slice(0, 200),
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// Find rank position of a domain in search results
// ---------------------------------------------------------------------------
export function findDomainRank(
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
