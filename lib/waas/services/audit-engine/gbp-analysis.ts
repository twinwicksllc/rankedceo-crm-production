// lib/waas/services/audit-engine/gbp-analysis.ts
//
// A3: Google Business Profile, NAP and review analysis, built only from data we
// already have: the Serper /places list (one shared lookup per audit) and the
// NAP read from the client's own homepage. Pure functions, no network.
//
// Honesty rules (the wording is part of the design):
//  - /places only returns the top ~10 businesses for one search. If the client
//    is not in that list we say "not in the top 10 for this search", never
//    "you have no Google Business Profile".
//  - A field Serper did not return for ANY place is treated as "not provided by
//    the data source", not as "missing", so it never lowers a score.
//  - Citations, review velocity and Yelp/Facebook need other providers and are
//    deliberately not attempted here.

import type { PlaceResult } from "../serper";
import { registrableDomain } from "./directory-blocklist";
import { normalizePhone, type SiteNap } from "./site-nap";

export type GbpMatchConfidence = "domain" | "phone" | "name" | "none";
export type NapFieldStatus = "match" | "mismatch" | "unknown";
export type NapStatus = "match" | "partial" | "mismatch" | "unknown";

export interface GbpPlaceSummary {
  position: number;
  title: string;
  address: string | null;
  phone: string | null;
  category: string | null;
  website: string | null;
  rating: number | null;
  rating_count: number | null;
}

export interface NapComparison {
  status: NapStatus;
  name: NapFieldStatus;
  phone: NapFieldStatus;
  address: NapFieldStatus;
  site: { name: string | null; phone: string | null; address: string | null };
  gbp: { name: string | null; phone: string | null; address: string | null };
}

export interface ReviewGap {
  target_count: number | null;
  target_rating: number | null;
  /** Median / max review count of the competitors found in the same results. */
  competitor_median_count: number | null;
  competitor_max_count: number | null;
  /** Target rating minus the average competitor rating (negative = behind). */
  rating_delta: number | null;
  competitors_compared: number;
}

export interface GbpCompleteness {
  /** 0-100, or null when the data source gave us nothing to judge by. */
  score: number | null;
  present: string[];
  missing: string[];
  /** Fields the data source did not return for any place; not counted. */
  not_provided: string[];
}

export interface GbpAnalysis {
  /** True when the client's listing was identified in the results. */
  found: boolean;
  match_confidence: GbpMatchConfidence;
  place: GbpPlaceSummary | null;
  nap: NapComparison | null;
  review_gap: ReviewGap | null;
  completeness: GbpCompleteness | null;
  /** The search this was measured on, for wording. */
  keyword: string;
  location: string;
  places_checked: number;
  /** 0-100 GBP component of the overall score; null = not measured. */
  score: number | null;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set([
  "the", "and", "of", "llc", "inc", "co", "corp", "company", "ltd", "services",
  "service", "group", "pllc", "pc",
]);
const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  st: "street", str: "street", ave: "avenue", av: "avenue", blvd: "boulevard",
  rd: "road", dr: "drive", ln: "lane", ct: "court", cir: "circle", pkwy: "parkway",
  hwy: "highway", pl: "place", ste: "suite", n: "north", s: "south", e: "east", w: "west",
};

function tokens(text: string, abbreviations = false): string[] {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (abbreviations ? (ADDRESS_ABBREVIATIONS[t] ?? t) : t))
    .filter((t) => !STOP_WORDS.has(t));
}

/** Share of the smaller token set found in the larger one (0-1). */
function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  let shared = 0;
  for (const t of small) if (large.has(t)) shared += 1;
  return shared / small.size;
}

function nameFromDomain(targetUrl: string): string {
  const domain = registrableDomain(targetUrl) ?? "";
  return domain.split(".")[0]?.replace(/[-_]/g, " ") ?? "";
}

// ---------------------------------------------------------------------------
// Which place is the client?
// ---------------------------------------------------------------------------
export function matchTargetPlace(
  places: PlaceResult[],
  targetUrl: string,
  siteNap: SiteNap | null,
): { place: PlaceResult | null; confidence: GbpMatchConfidence } {
  const targetDomain = registrableDomain(targetUrl);
  if (targetDomain) {
    const byDomain = places.find(
      (p) => p.website && registrableDomain(p.website) === targetDomain,
    );
    if (byDomain) return { place: byDomain, confidence: "domain" };
  }

  const sitePhone = normalizePhone(siteNap?.phone);
  if (sitePhone) {
    const byPhone = places.find((p) => normalizePhone(p.phone) === sitePhone);
    if (byPhone) return { place: byPhone, confidence: "phone" };
  }

  // Name: need a real overlap, not one shared word. Compare the title with the
  // name the site publishes, or failing that with the domain name.
  const candidates = [siteNap?.name, nameFromDomain(targetUrl)]
    .filter((n): n is string => !!n && n.trim().length > 0)
    .map((n) => tokens(n));
  let best: { place: PlaceResult; score: number } | null = null;
  for (const place of places) {
    const titleTokens = tokens(place.title);
    for (const candidate of candidates) {
      if (candidate.length === 0) continue;
      // Joined form handles "acmeplumbing" vs "Acme Plumbing".
      const joinedTitle = titleTokens.join("");
      const joinedCandidate = candidate.join("");
      const score =
        joinedCandidate.length >= 5 &&
        (joinedTitle.includes(joinedCandidate) ||
          joinedCandidate.includes(joinedTitle))
          ? 1
          : overlap(candidate, titleTokens);
      if (score >= 0.75 && (!best || score > best.score)) {
        best = { place, score };
      }
    }
  }
  return best
    ? { place: best.place, confidence: "name" }
    : { place: null, confidence: "none" };
}

// ---------------------------------------------------------------------------
// NAP consistency
// ---------------------------------------------------------------------------
export function compareNap(site: SiteNap, place: PlaceResult): NapComparison {
  const gbp = {
    name: place.title || null,
    phone: place.phone ?? null,
    address: place.address ?? null,
  };

  const fieldStatus = (
    a: string | null,
    b: string | null,
    equal: (x: string, y: string) => boolean,
  ): NapFieldStatus => (!a || !b ? "unknown" : equal(a, b) ? "match" : "mismatch");

  const name = fieldStatus(site.name, gbp.name, (x, y) => {
    const tx = tokens(x);
    const ty = tokens(y);
    const joinedX = tx.join("");
    const joinedY = ty.join("");
    if (joinedX.length >= 5 && (joinedY.includes(joinedX) || joinedX.includes(joinedY))) {
      return true;
    }
    return overlap(tx, ty) >= 0.6;
  });
  const phone = fieldStatus(
    normalizePhone(site.phone),
    normalizePhone(gbp.phone),
    (x, y) => x === y,
  );
  const address = fieldStatus(site.address, gbp.address, (x, y) => {
    const tx = tokens(x, true);
    const ty = tokens(y, true);
    // The street number must agree when both have one.
    const numX = tx.find((t) => /^\d+$/.test(t));
    const numY = ty.find((t) => /^\d+$/.test(t));
    if (numX && numY && numX !== numY) return false;
    return overlap(tx, ty) >= 0.6;
  });

  const known = [name, phone, address].filter((s) => s !== "unknown");
  let status: NapStatus;
  if (known.length === 0) status = "unknown";
  else if (known.includes("mismatch")) status = "mismatch";
  else if (known.length < 3) status = "partial";
  else status = "match";

  return {
    status,
    name,
    phone,
    address,
    site: { name: site.name, phone: site.phone, address: site.address },
    gbp,
  };
}

// ---------------------------------------------------------------------------
// Reviews vs the competitors found in the same results
// ---------------------------------------------------------------------------
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function computeReviewGap(
  target: PlaceResult | null,
  places: PlaceResult[],
  competitorUrls: string[],
): ReviewGap | null {
  const competitorDomains = new Set(
    competitorUrls.map((u) => registrableDomain(u)).filter((d): d is string => !!d),
  );
  const competitors = places.filter(
    (p) =>
      p !== target &&
      p.website &&
      competitorDomains.has(registrableDomain(p.website) ?? ""),
  );
  const counts = competitors
    .map((p) => p.ratingCount)
    .filter((n): n is number => typeof n === "number");
  const ratings = competitors
    .map((p) => p.rating)
    .filter((n): n is number => typeof n === "number");
  if (counts.length === 0 && ratings.length === 0) return null;

  const avgRating =
    ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
  const targetRating = target?.rating ?? null;
  return {
    target_count: target?.ratingCount ?? null,
    target_rating: targetRating,
    competitor_median_count: median(counts),
    competitor_max_count: counts.length > 0 ? Math.max(...counts) : null,
    rating_delta:
      targetRating != null && avgRating != null
        ? Number((targetRating - avgRating).toFixed(1))
        : null,
    competitors_compared: competitors.length,
  };
}

// ---------------------------------------------------------------------------
// Profile completeness, judged only on fields the data source provides
// ---------------------------------------------------------------------------
const COMPLETENESS_FIELDS: Array<{
  key: string;
  label: string;
  weight: number;
  provided: (p: PlaceResult) => boolean;
  /** 0-1 credit for the target's value. */
  credit: (p: PlaceResult) => number;
}> = [
  { key: "website", label: "Website", weight: 15, provided: (p) => p.website !== undefined, credit: (p) => (p.website ? 1 : 0) },
  { key: "phone", label: "Phone number", weight: 15, provided: (p) => p.phone !== undefined, credit: (p) => (p.phone ? 1 : 0) },
  { key: "category", label: "Business category", weight: 10, provided: (p) => p.category !== undefined, credit: (p) => (p.category ? 1 : 0) },
  { key: "rating", label: "Rating of 4.0 or higher", weight: 20, provided: (p) => p.rating !== undefined, credit: (p) => ((p.rating ?? 0) >= 4 ? 1 : 0) },
  { key: "reviews", label: "25+ reviews", weight: 25, provided: (p) => p.ratingCount !== undefined, credit: (p) => Math.min((p.ratingCount ?? 0) / 25, 1) },
  { key: "hours", label: "Opening hours", weight: 10, provided: (p) => p.hours !== undefined, credit: (p) => (p.hours ? 1 : 0) },
  { key: "photo", label: "Photo", weight: 5, provided: (p) => p.thumbnailUrl !== undefined, credit: (p) => (p.thumbnailUrl ? 1 : 0) },
];

export function computeCompleteness(
  target: PlaceResult,
  places: PlaceResult[],
): GbpCompleteness {
  const present: string[] = [];
  const missing: string[] = [];
  const notProvided: string[] = [];
  let earned = 0;
  let possible = 0;

  for (const field of COMPLETENESS_FIELDS) {
    const providedSomewhere = places.some((p) => field.provided(p));
    if (!providedSomewhere) {
      notProvided.push(field.label);
      continue;
    }
    const credit = field.credit(target);
    possible += field.weight;
    earned += field.weight * credit;
    if (credit >= 1) present.push(field.label);
    else missing.push(field.label);
  }

  return {
    score: possible > 0 ? Math.round((earned / possible) * 100) : null,
    present,
    missing,
    not_provided: notProvided,
  };
}

const NAP_POINTS: Record<NapStatus, number | null> = {
  match: 100,
  partial: 75,
  mismatch: 25,
  unknown: null,
};

/** 70% profile completeness + 30% NAP consistency (NAP left out when unknown). */
export function gbpComponentScore(
  completeness: GbpCompleteness | null,
  nap: NapComparison | null,
): number | null {
  const completenessScore = completeness?.score ?? null;
  const napPoints = nap ? NAP_POINTS[nap.status] : null;
  if (completenessScore == null && napPoints == null) return null;
  if (completenessScore == null) return napPoints;
  if (napPoints == null) return completenessScore;
  return Math.round(completenessScore * 0.7 + napPoints * 0.3);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export function analyzeGbp(input: {
  places: PlaceResult[];
  targetUrl: string;
  siteNap: SiteNap | null;
  competitorUrls: string[];
  keyword: string;
  location: string;
}): GbpAnalysis | null {
  // No places at all means the lookup was off, empty or failed: not measured.
  if (input.places.length === 0) return null;

  const { place, confidence } = matchTargetPlace(
    input.places,
    input.targetUrl,
    input.siteNap,
  );
  const base = {
    keyword: input.keyword,
    location: input.location,
    places_checked: input.places.length,
  };

  if (!place) {
    return {
      ...base,
      found: false,
      match_confidence: "none",
      place: null,
      nap: null,
      review_gap: null,
      completeness: null,
      score: null,
    };
  }

  const nap = input.siteNap ? compareNap(input.siteNap, place) : null;
  const completeness = computeCompleteness(place, input.places);
  return {
    ...base,
    found: true,
    match_confidence: confidence,
    place: {
      position: place.position,
      title: place.title,
      address: place.address ?? null,
      phone: place.phone ?? null,
      category: place.category ?? null,
      website: place.website ?? null,
      rating: place.rating ?? null,
      rating_count: place.ratingCount ?? null,
    },
    nap,
    review_gap: computeReviewGap(place, input.places, input.competitorUrls),
    completeness,
    score: gbpComponentScore(completeness, nap),
  };
}

// ---------------------------------------------------------------------------
// Findings (fed into the ranked opportunities list)
// ---------------------------------------------------------------------------
export interface GbpFinding {
  id: "gbp_not_found" | "nap_mismatch" | "review_gap" | "gbp_incomplete";
  title: string;
  fix: string;
  impact: "high" | "medium" | "low";
}

export function buildGbpFindings(analysis: GbpAnalysis | null): GbpFinding[] {
  if (!analysis) return [];
  const findings: GbpFinding[] = [];

  if (!analysis.found) {
    findings.push({
      id: "gbp_not_found",
      title: `Your business was not in the top ${analysis.places_checked} Google Maps results for "${analysis.keyword}"`,
      fix: "Claim and complete your Google Business Profile, pick the right primary category, and ask recent customers for reviews. This does not mean you have no profile: Google only showed us the top results for this search.",
      impact: "medium",
    });
    return findings;
  }

  const nap = analysis.nap;
  if (nap && nap.status === "mismatch") {
    const fields = (["phone", "address", "name"] as const).filter(
      (f) => nap[f] === "mismatch",
    );
    findings.push({
      id: "nap_mismatch",
      title: `Your ${fields.join(" and ")} on your website does not match your Google Business Profile`,
      fix: "Make your business name, address and phone number identical on your website and your Google Business Profile (same spelling and format). Inconsistent details weaken your local rankings.",
      impact: nap.phone === "mismatch" ? "high" : "medium",
    });
  }

  const gap = analysis.review_gap;
  if (
    gap &&
    gap.target_count != null &&
    gap.competitor_median_count != null &&
    gap.target_count < gap.competitor_median_count
  ) {
    const heavy = gap.target_count * 2 <= gap.competitor_median_count;
    findings.push({
      id: "review_gap",
      title: `You have ${gap.target_count} Google reviews; the competitors we compared have a median of ${gap.competitor_median_count}`,
      fix: "Ask every happy customer for a Google review (a short link by text or email works best) and reply to the reviews you already have.",
      impact: heavy ? "high" : "medium",
    });
  }

  const completeness = analysis.completeness;
  if (completeness && completeness.score != null && completeness.score < 70) {
    findings.push({
      id: "gbp_incomplete",
      title: `Your Google Business Profile looks incomplete (${completeness.score}/100)`,
      fix: `Fill in what is missing: ${completeness.missing.join(", ")}.`,
      impact: completeness.score < 40 ? "high" : "medium",
    });
  }

  return findings;
}
