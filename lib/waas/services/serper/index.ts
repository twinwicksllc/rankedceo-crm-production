// lib/waas/services/serper/index.ts
import {
  extractDomain,
  auditDebug,
  SERPER_TARGET_RESULTS,
  SerperOrganicResults,
  SerperSearchResult,
  SearchRankReport,
  RankResult,
} from "./types";
import { buildQueryCandidates } from "./location-utils";
import { serperSearch, findDomainRank } from "./search-client";

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
export function getMockSearchRankings(
  targetUrl: string,
  competitorUrls: string[],
  keyword: string,
  location: string,
): SearchRankReport {
  const targetDomain = extractDomain(targetUrl);

  // Randomly place target between position 8-45 (not great)
  const targetPos = Math.floor(Math.random() * 37) + 8;

  const competitorResults: RankResult[] = competitorUrls.map((url, i) => ({
    url,
    domain: extractDomain(url),
    position: i + 1, // Competitors rank 1st, 2nd, 3rd
    title: `${extractDomain(url)} - Professional Services`,
    snippet: `Trusted local service provider. Call us today for a free estimate.`,
  }));

  const mockOrganic: SerperSearchResult[] = [
    ...competitorUrls.slice(0, 3).map((url, i) => ({
      position: i + 1,
      title: `${extractDomain(url)} - Local Experts`,
      link: url,
      snippet: "Trusted by 500+ local customers. Free estimates available.",
      displayLink: extractDomain(url),
      domain: extractDomain(url),
    })),
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

// Barrel re-exports
export type {
  SerperSearchResult,
  SerperOrganicResults,
  RankResult,
  SearchRankReport,
} from "./types";
export { extractDomain } from "./types";
export {
  normalizeSerperLocation,
  inferGlFromLocation,
  normalizeTextTokens,
  parseLocationParts,
  keywordContainsLocation,
  stripLocationFromKeyword,
  buildQueryCandidates,
} from "./location-utils";
export { serperSearch, findDomainRank } from "./search-client";
