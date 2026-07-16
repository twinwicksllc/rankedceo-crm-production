// lib/waas/services/serper/types.ts

export const AUDIT_DEBUG = process.env.WAAS_AUDIT_DEBUG === "true";
export const SERPER_TARGET_RESULTS = (() => {
  const parsed = Number.parseInt(
    process.env.WAAS_SERP_TARGET_RESULTS ?? "50",
    10,
  );
  if (Number.isNaN(parsed)) return 50;
  return Math.max(10, Math.min(100, parsed));
})();

// Google Maps "Local Pack" tracking via Serper's /places endpoint. Off by
// default — this is a separate, additionally-billed Serper call — enable
// explicitly once Places pricing/quota is confirmed.
export const LOCAL_PACK_ENABLED =
  process.env.WAAS_LOCAL_PACK_ENABLED === "true";

export function auditDebug(event: string, payload: Record<string, unknown>) {
  if (!AUDIT_DEBUG) return;
  try {
    console.log(`[AuditDebug][Serper] ${event} ${JSON.stringify(payload)}`);
  } catch {
    console.log(`[AuditDebug][Serper] ${event}`);
  }
}

export interface SerperSearchResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  domain: string;
}

export interface SerperOrganicResults {
  searchParameters: { q: string; gl: string; hl: string; num: number };
  organic: SerperSearchResult[];
  peopleAlsoAsk?: { question: string; snippet: string }[];
  relatedSearches?: { query: string }[];
}

export interface RankResult {
  url: string;
  domain: string;
  position: number | null; // null = not in tracked SERP window (top N)
  title: string;
  snippet: string;
}

export interface SearchRankReport {
  keyword: string;
  location: string;
  queryUsed: string;
  resultsReturned: number;
  maxTrackedPosition: number;
  targetResult: RankResult;
  competitorResults: RankResult[];
  allResults: SerperSearchResult[];
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// Google Maps Local Pack ("Places") types
// ---------------------------------------------------------------------------
export interface PlaceResult {
  position: number;
  title: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
  cid?: string;
  website?: string;
}

export interface LocalPackCompetitorResult {
  url: string;
  domain: string;
  position: number | null;
  title: string | null;
}

export interface LocalPackReport {
  keyword: string;
  location: string;
  queryUsed: string;
  places: PlaceResult[];
  target: { position: number | null; title: string | null };
  competitorResults: LocalPackCompetitorResult[];
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// Extract domain from URL
// ---------------------------------------------------------------------------
export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}
