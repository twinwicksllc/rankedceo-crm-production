// lib/waas/services/serper/index.ts
import {
  extractDomain,
  auditDebug,
  SERPER_TARGET_RESULTS,
  SerperOrganicResults,
  SerperSearchResult,
  SearchRankReport,
  RankResult,
  PlaceResult,
  LocalPackReport,
} from "./types";
import { buildQueryCandidates } from "./location-utils";
import {
  serperSearch,
  findDomainRank,
  serperPlacesSearch,
  findPlaceByDomain,
} from "./search-client";

// ---------------------------------------------------------------------------
// Main: Get search rankings for target + competitors
// ---------------------------------------------------------------------------
export async function getSearchRankings(
  targetUrl: string,
  competitorUrls: string[],
  keyword: string,
  location: string = "Chicago, IL",
): Promise<SearchRankReport | null> {
  const targetDomain = extractDomain(targetUrl);
  const queries = buildQueryCandidates(keyword, location);

  auditDebug("keyword:start", {
    keyword,
    location,
    targetDomain,
    targetResultsRequested: SERPER_TARGET_RESULTS,
    queryCandidates: queries,
  });

  let bestQuery = "";
  let bestOrganic: SerperSearchResult[] = [];
  let bestSearchResults: SerperOrganicResults | null = null;

  for (const query of queries) {
    const searchResults = await serperSearch(
      query,
      location,
      SERPER_TARGET_RESULTS,
    );
    const organic = searchResults?.organic ?? [];
    if (!searchResults || organic.length === 0) {
      auditDebug("keyword:attempt_empty", {
        keyword,
        query,
      });
      continue;
    }

    const targetRank = findDomainRank(targetDomain, organic);
    const competitorRanks = competitorUrls.map((url) => {
      const domain = extractDomain(url);
      return findDomainRank(domain, organic);
    });

    const hasAnyMatch =
      targetRank.position !== null ||
      competitorRanks.some((rank) => rank.position !== null);

    auditDebug("keyword:attempt_result", {
      keyword,
      query,
      resultsReturned: organic.length,
      targetPosition: targetRank.position,
      competitorMatchedCount: competitorRanks.filter(
        (rank) => rank.position !== null,
      ).length,
      hasAnyMatch,
    });

    bestQuery = query;
    bestOrganic = organic;
    bestSearchResults = searchResults;

    // Prefer the first query that yields at least one domain match.
    if (hasAnyMatch) break;
  }

  if (!bestSearchResults || bestOrganic.length === 0) {
    auditDebug("keyword:no_results", {
      keyword,
      location,
      targetDomain,
    });
    return null;
  }

  const targetRank = findDomainRank(targetDomain, bestOrganic);

  const competitorResults: RankResult[] = competitorUrls.map((url) => {
    const domain = extractDomain(url);
    const rank = findDomainRank(domain, bestOrganic);
    return {
      url,
      domain,
      position: rank.position,
      title: rank.title,
      snippet: rank.snippet,
    };
  });

  // Use actual returned organic depth as the tracked window.
  // Some provider plans return only top-10 even when num=100 is requested.
  const maxTrackedPosition = bestOrganic.length;

  auditDebug("keyword:final", {
    keyword,
    selectedQuery: bestQuery,
    fallbackUsed: bestQuery !== queries[0],
    resultsReturned: bestOrganic.length,
    maxTrackedPosition,
    targetPosition: targetRank.position,
    competitorMatchedCount: competitorResults.filter(
      (result) => result.position !== null,
    ).length,
  });

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
    allResults: bestOrganic.slice(0, 10), // top 10 for display
    searchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main: Get Google Maps "Local Pack" rankings for target + competitors
// Cost note: this hits Serper's /places endpoint, a separate billed call
// from /search — callers should gate this behind LOCAL_PACK_ENABLED.
// ---------------------------------------------------------------------------
export async function getLocalPackRankings(
  targetUrl: string,
  competitorUrls: string[],
  keyword: string,
  location: string = "Chicago, IL",
): Promise<LocalPackReport | null> {
  const targetDomain = extractDomain(targetUrl);

  auditDebug("places:keyword_start", { keyword, location, targetDomain });

  const places = await serperPlacesSearch(keyword, location);
  if (!places || places.length === 0) {
    auditDebug("places:keyword_empty", { keyword, location });
    return null;
  }

  const targetPlace = findPlaceByDomain(targetDomain, places);
  const competitorResults = competitorUrls.map((url) => {
    const domain = extractDomain(url);
    const place = findPlaceByDomain(domain, places);
    return {
      url,
      domain,
      position: place?.position ?? null,
      title: place?.title ?? null,
    };
  });

  auditDebug("places:keyword_final", {
    keyword,
    placesReturned: places.length,
    targetPosition: targetPlace?.position ?? null,
    competitorMatchedCount: competitorResults.filter(
      (result) => result.position !== null,
    ).length,
  });

  return {
    keyword,
    location,
    queryUsed: keyword,
    places: places.slice(0, 10),
    target: {
      position: targetPlace?.position ?? null,
      title: targetPlace?.title ?? null,
    },
    competitorResults,
    searchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Generate industry-specific keywords from URL + location
// ---------------------------------------------------------------------------
export function generateKeywords(
  targetUrl: string,
  industry: string | null,
  location: string | null,
): string[] {
  const loc = location ?? "Chicago, IL";
  const city = loc.split(",")[0].trim();

  const industryKeywords: Record<string, string[]> = {
    plumbing: [
      `plumber in ${city}`,
      `plumbing company ${city}`,
      `emergency plumber ${city}`,
    ],
    hvac: [
      `HVAC company ${city}`,
      `AC repair ${city}`,
      `heating and cooling ${city}`,
    ],
    electrical: [
      `electrician ${city}`,
      `electrical contractor ${city}`,
      `licensed electrician ${city}`,
    ],
    roofing: [
      `roofing company ${city}`,
      `roof repair ${city}`,
      `roofer near me ${city}`,
    ],
    landscaping: [
      `landscaping company ${city}`,
      `lawn care ${city}`,
      `landscape design ${city}`,
    ],
    real_estate: [
      `real estate agent ${city}`,
      `homes for sale ${city}`,
      `realtor ${city}`,
    ],
    dental: [
      `dentist in ${city}`,
      `dental office ${city}`,
      `family dentist ${city}`,
    ],
    default: [
      `${industry ?? "local business"} ${city}`,
      `best ${industry ?? "contractor"} ${city}`,
    ],
  };

  const key = industry?.toLowerCase() ?? "default";
  return industryKeywords[key] ?? industryKeywords.default;
}

// ---------------------------------------------------------------------------
// MOCK: Returns realistic-looking data for dev/testing (no API key needed)
// ---------------------------------------------------------------------------
function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getMockSearchRankings(
  targetUrl: string,
  competitorUrls: string[],
  keyword: string,
  location: string,
): SearchRankReport {
  const targetDomain = extractDomain(targetUrl);

  const hash = stringHash(targetDomain + keyword);
  // Deterministic target position between position 8-45
  const targetPos = (hash % 37) + 8;

  const competitorResults: RankResult[] = competitorUrls.map((url, i) => {
    const compHash = stringHash(extractDomain(url) + keyword);
    return {
      url,
      domain: extractDomain(url),
      position: (compHash % 10) + 1, // Deterministic competitor rank between 1-10
      title: `${extractDomain(url)} - Professional Services`,
      snippet: `Trusted local service provider. Call us today for a free estimate.`,
    };
  });

  const mockOrganic: SerperSearchResult[] = [
    ...competitorUrls.slice(0, 3).map((url, i) => {
      const compHash = stringHash(extractDomain(url) + keyword);
      return {
        position: (compHash % 10) + 1,
        title: `${extractDomain(url)} - Local Experts`,
        link: url,
        snippet: "Trusted by 500+ local customers. Free estimates available.",
        displayLink: extractDomain(url),
        domain: extractDomain(url),
      };
    }),
    {
      position: targetPos,
      title: `${targetDomain} - Home Services`,
      link: targetUrl,
      snippet: "Serving the local area. Contact us for more information.",
      displayLink: targetDomain,
      domain: targetDomain,
    },
  ];

  return {
    keyword,
    location,
    queryUsed: keyword,
    resultsReturned: 100,
    maxTrackedPosition: 100,
    targetResult: {
      url: targetUrl,
      domain: targetDomain,
      position: targetPos,
      title: `${targetDomain} - Home Services`,
      snippet: "Serving the local area. Contact us for more information.",
    },
    competitorResults,
    allResults: mockOrganic,
    searchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// MOCK: Local Pack (deterministic, matches getMockSearchRankings' pattern)
// ---------------------------------------------------------------------------
export function getMockLocalPackRankings(
  targetUrl: string,
  competitorUrls: string[],
  keyword: string,
  location: string,
): LocalPackReport {
  const targetDomain = extractDomain(targetUrl);
  const targetHash = stringHash(targetDomain + keyword + "places");
  // ~1 in 5 chance the target doesn't appear in the local pack at all.
  const targetPosition = targetHash % 5 === 0 ? null : (targetHash % 3) + 1;

  const competitorResults = competitorUrls.map((url) => {
    const domain = extractDomain(url);
    const hash = stringHash(domain + keyword + "places");
    const position = hash % 4 === 0 ? null : (hash % 3) + 1;
    return {
      url,
      domain,
      position,
      title: position !== null ? `${domain} - Local` : null,
    };
  });

  const rankedCompetitors: Array<{
    position: number;
    title: string;
    url: string;
  }> = [];
  for (const c of competitorResults) {
    if (c.position !== null) {
      rankedCompetitors.push({
        position: c.position,
        title: c.title ?? `${c.domain} - Local`,
        url: c.url,
      });
    }
  }

  const places: PlaceResult[] = [
    ...(targetPosition !== null
      ? [
          {
            position: targetPosition,
            title: `${targetDomain} - Home Services`,
            address: location,
            rating: 4.5,
            ratingCount: 42,
            category: "Local Business",
            website: targetUrl,
          },
        ]
      : []),
    ...rankedCompetitors.map((c) => ({
      position: c.position,
      title: c.title,
      address: location,
      rating: 4.3,
      ratingCount: 30,
      category: "Local Business",
      website: c.url,
    })),
  ].sort((a, b) => a.position - b.position);

  return {
    keyword,
    location,
    queryUsed: keyword,
    places,
    target: {
      position: targetPosition,
      title: targetPosition !== null ? `${targetDomain} - Home Services` : null,
    },
    competitorResults,
    searchedAt: new Date().toISOString(),
  };
}

// Barrel re-exports
export type {
  SerperSearchResult,
  SerperOrganicResults,
  RankResult,
  SearchRankReport,
  PlaceResult,
  LocalPackReport,
} from "./types";
export { extractDomain, LOCAL_PACK_ENABLED } from "./types";
export {
  normalizeSerperLocation,
  inferGlFromLocation,
  normalizeTextTokens,
  parseLocationParts,
  keywordContainsLocation,
  stripLocationFromKeyword,
  buildQueryCandidates,
} from "./location-utils";
export {
  serperSearch,
  findDomainRank,
  serperPlacesSearch,
  findPlaceByDomain,
} from "./search-client";
