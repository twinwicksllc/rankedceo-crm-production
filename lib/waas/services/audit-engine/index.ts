import {
  getSearchRankings,
  getMockSearchRankings,
  buildLocalPackReport,
  extractDomain,
  type SearchRankReport,
  type LocalPackReport,
} from "../serper";
import { extractCityFromAddress } from "../serper/location-utils";
import { LocationUnresolvedError, resolveAuditLocation } from "./location";
import { createPlacesFetcher } from "./local-pack";
import { discoverCompetitors, mergeCompetitors } from "./competitor-discovery";
import { analyzeGbp, buildGbpFindings } from "./gbp-analysis";
import { generateIndustryKeywordPlan } from "../keyword-generator";
import { collectSiteSignals } from "../keyword-generator/site-scraper";
import {
  runPageSpeedAudit,
  getMockPageSpeedReport,
  type PageSpeedReport,
} from "../pagespeed";
import type { AuditReportData, AuditSeoProvider } from "../../types";
import { computeGapAnalysis } from "./gap-analysis";
import { buildLeaderboard, computeKeywordPerformance } from "./leaderboard";
import { crawlOnPage, type OnPageCrawlResult } from "./on-page-crawl";
import { buildOpportunities } from "./findings";
import {
  computeOverallScoreV2,
  positionToPoints,
  searchVisibilityScore,
  SCORE_VERSION,
} from "./scoring";

interface CompetitorLocality {
  isLocal: boolean | null;
  detectedLocation: string | null;
}

function extractCityToken(location: string | null): string | null {
  if (!location) return null;
  const city = location.split(",")[0]?.trim().toLowerCase();
  return city && city.length > 0 ? city : null;
}

// Classify each competitor as local/national by comparing their detected
// homepage location city against the target's search location city.
// Non-blocking: scraping failures resolve to { isLocal: null } rather than
// throwing, so a slow/unreachable competitor site never breaks the audit.
async function classifyCompetitorLocality(
  competitorUrls: string[],
  targetSearchLocation: string,
): Promise<Map<string, CompetitorLocality>> {
  const targetCity = extractCityToken(targetSearchLocation);
  const result = new Map<string, CompetitorLocality>();

  const settled = await Promise.allSettled(
    competitorUrls.map(async (url) => {
      const signals = await collectSiteSignals(url);
      const detectedLocation =
        extractCityFromAddress(signals.addressHint) ?? signals.locationHint;
      const detectedCity = extractCityToken(detectedLocation);
      const isLocal =
        targetCity && detectedCity ? targetCity === detectedCity : null;
      return { url, isLocal, detectedLocation };
    }),
  );

  settled.forEach((entry, i) => {
    const url = competitorUrls[i];
    if (entry.status === "fulfilled") {
      result.set(url, {
        isLocal: entry.value.isLocal,
        detectedLocation: entry.value.detectedLocation,
      });
    } else {
      result.set(url, { isLocal: null, detectedLocation: null });
    }
  });

  return result;
}

const AUDIT_DEBUG = process.env.WAAS_AUDIT_DEBUG === "true";

function auditDebug(event: string, payload: Record<string, unknown>) {
  if (!AUDIT_DEBUG) return;
  try {
    console.log(`[AuditDebug][Engine] ${event} ${JSON.stringify(payload)}`);
  } catch {
    console.log(`[AuditDebug][Engine] ${event}`);
  }
}

export interface AuditEngineResult {
  reportData: AuditReportData;
  provider: AuditSeoProvider;
  keywordsUsed: string[];
  locationDetected: string;
  manualReview: boolean;
  manualReviewNote: string | null;
}

export async function runFullAudit(
  targetUrl: string,
  typedCompetitorUrls: string[],
  industry: string | null = null,
  location: string | null = null,
): Promise<AuditEngineResult> {
  // Default to serper for live results
  const provider = (process.env.WAAS_SEO_PROVIDER ??
    "serper") as AuditSeoProvider;
  const usingLiveProviders = provider !== "mock";
  const keywordPlan = await generateIndustryKeywordPlan(
    targetUrl,
    industry,
    location,
    5,
  );
  // DEC-0003: location comes from the intake form or the client's website.
  // There is no default city. If we cannot resolve one, stop before spending
  // any search/PageSpeed calls and send the audit to manual review.
  const resolvedLocation = resolveAuditLocation({
    explicit: location,
    detectedLocation: keywordPlan.detectedLocation,
    detectedAddress: keywordPlan.detectedAddress,
  });
  if (!resolvedLocation) {
    throw new LocationUnresolvedError();
  }
  const { detectedLocation, searchLocation } = resolvedLocation;
  const keywords = keywordPlan.keywords;
  const totalKeywords = keywords.length;
  let manualReview = false;
  let manualReviewNote: string | null = null;

  auditDebug("audit:start", {
    provider,
    targetUrl,
    competitorCount: typedCompetitorUrls.length,
    industryHint: industry,
    locationHint: location,
    detectedLocation,
    searchLocation,
    keywordProvider: keywordPlan.provider,
    keywords,
  });

  // One Serper /places lookup per audit, started now so it runs in parallel
  // with the rankings below. Only the primary keyword is checked, which caps
  // the billed /places cost at a single call. It never throws; a disabled,
  // empty or failed lookup just yields no places.
  const primaryKeyword = keywords[0];
  const placesPromise = createPlacesFetcher(
    provider,
    targetUrl,
    typedCompetitorUrls,
    primaryKeyword,
    searchLocation,
  )();

  // A7: competitors the visitor typed always win; the local pack fills any
  // remaining slots (up to 3). Rankings need the final list, so wait for the
  // lookup here (it is time-limited and never throws).
  const { places: discoveryPlaces, status: placesStatus } = await placesPromise;
  const discovered = discoverCompetitors({
    places: discoveryPlaces,
    targetUrl,
    typedCompetitorUrls,
  });
  const mergedCompetitors = mergeCompetitors(typedCompetitorUrls, discovered);
  const competitorUrls = mergedCompetitors.urls;
  const discoveredCompetitorUrls = new Set(mergedCompetitors.discoveredUrls);
  auditDebug("competitors:resolved", {
    typed: typedCompetitorUrls.length,
    discovered: mergedCompetitors.discoveredUrls.length,
    placesStatus,
  });

  // ── 1. Get search rankings ─────────────────────────────────────────────────────────
  const rankReports: SearchRankReport[] = [];
  if (provider === "mock") {
    for (const keyword of keywords) {
      rankReports.push(
        getMockSearchRankings(
          targetUrl,
          competitorUrls,
          keyword,
          searchLocation,
        ),
      );
    }
    auditDebug("rankings:mock_complete", {
      keywordCount: keywords.length,
    });
  } else {
    const searchResults = await Promise.allSettled(
      keywords.map((keyword) =>
        getSearchRankings(targetUrl, competitorUrls, keyword, searchLocation),
      ),
    );

    for (const result of searchResults) {
      if (result.status === "fulfilled" && result.value) {
        rankReports.push(result.value);
      } else if (result.status === "rejected") {
        auditDebug("rankings:promise_rejected", {
          error: String(result.reason).slice(0, 200),
        });
      }
    }

    auditDebug("rankings:live_complete", {
      keywordCount: keywords.length,
      successfulReports: rankReports.length,
      failedReports: Math.max(0, keywords.length - rankReports.length),
      reportSummaries: rankReports.map((report) => ({
        keyword: report.keyword,
        queryUsed: report.queryUsed,
        resultsReturned: report.resultsReturned,
        maxTrackedPosition: report.maxTrackedPosition,
        targetPosition: report.targetResult.position,
      })),
    });

    if (rankReports.length === 0) {
      manualReview = true;
      manualReviewNote = "Search API failed for all evaluated keywords.";
    }
  }

  const failedKeywordFetches = Math.max(0, totalKeywords - rankReports.length);
  if (failedKeywordFetches > 0 && rankReports.length > 0) {
    manualReviewNote = `${failedKeywordFetches} keyword search request(s) failed and were excluded from ranking analysis.`;
  }

  // Kick off competitor locality classification now so it runs in parallel
  // with the PageSpeed audit below rather than adding sequential latency.
  const competitorLocalityPromise = classifyCompetitorLocality(
    competitorUrls,
    searchLocation,
  );

  // Build the Local Pack report from the shared places lookup (null when the
  // lookup is disabled, empty or failed).
  const localPackPromise: Promise<LocalPackReport | null> =
    placesPromise.then(({ places }) =>
      primaryKeyword
        ? buildLocalPackReport(
            places,
            targetUrl,
            competitorUrls,
            primaryKeyword,
            searchLocation,
          )
        : null,
    );

  // ── On-page crawl (A5) ──
  // A real crawl of the target site, run in parallel with PageSpeed. Best-effort:
  // a crawl failure resolves to null and never fails the audit. Skipped in mock
  // mode so offline/demo audits make no network calls.
  const onPagePromise: Promise<OnPageCrawlResult | null> =
    provider === "mock"
      ? Promise.resolve(null)
      : crawlOnPage(targetUrl, { locationHint: searchLocation }).catch((err) => {
          auditDebug("onpage:error", { error: String(err).slice(0, 200) });
          return null;
        });

  // ── 2. Run PageSpeed ────────────────────────────────────────────────────────────────────
  let pageSpeed: PageSpeedReport | null = null;

  if (provider === "mock") {
    pageSpeed = getMockPageSpeedReport(targetUrl);
    auditDebug("pagespeed:mock_complete", {
      available: pageSpeed !== null,
    });
  } else {
    try {
      pageSpeed = await runPageSpeedAudit(targetUrl);
      auditDebug("pagespeed:live_complete", {
        available: pageSpeed !== null,
      });
      if (!pageSpeed && !manualReview) {
        manualReview = true;
        manualReviewNote = "PageSpeed API returned no analyzable data.";
      }
    } catch (err) {
      console.error("[AuditEngine] PageSpeed failed:", err);
      auditDebug("pagespeed:error", {
        error: String(err).slice(0, 200),
      });
      if (!manualReview) {
        manualReview = true;
        manualReviewNote = `PageSpeed API failed: ${String(err).slice(0, 200)}`;
      }
    }
  }

  // If both APIs failed, mark for manual review
  if (rankReports.length === 0 && !pageSpeed) {
    manualReview = true;
    manualReviewNote =
      "Both search rankings and PageSpeed APIs failed. Site may be unscrapable.";
  }

  const competitorLocality = await competitorLocalityPromise;
  auditDebug("competitor:classified", {
    targetSearchLocation: searchLocation,
    classifications: competitorUrls.map((url) => ({
      url,
      ...competitorLocality.get(url),
    })),
  });

  const localPack = await localPackPromise;
  if (placesStatus !== "disabled") {
    auditDebug("places:complete", {
      status: placesStatus,
      available: localPack !== null,
      targetPosition: localPack?.target.position ?? null,
    });
  }

  const onPage = await onPagePromise;
  auditDebug("onpage:complete", {
    available: onPage !== null,
    pagesCrawled: onPage?.pagesCrawled ?? 0,
    findings: onPage?.findings.length ?? 0,
    score: onPage?.score ?? null,
  });

  // A3: Google Business Profile / NAP / review analysis from the same shared
  // places lookup plus the NAP read from the client's homepage. Null (not
  // measured) when there were no places to look at.
  const gbp = primaryKeyword
    ? analyzeGbp({
        places: discoveryPlaces,
        targetUrl,
        siteNap: onPage?.nap ?? null,
        competitorUrls,
        keyword: primaryKeyword,
        location: searchLocation,
      })
    : null;
  const gbpFindings = buildGbpFindings(gbp);
  auditDebug("gbp:complete", {
    measured: gbp !== null,
    found: gbp?.found ?? null,
    confidence: gbp?.match_confidence ?? null,
    napStatus: gbp?.nap?.status ?? null,
    score: gbp?.score ?? null,
    findings: gbpFindings.map((f) => f.id),
  });

  const competitorLocalityByDomain = new Map<string, boolean | null>();
  competitorUrls.forEach((url) => {
    competitorLocalityByDomain.set(
      extractDomain(url),
      competitorLocality.get(url)?.isLocal ?? null,
    );
  });

  const localityCounts = competitorUrls.reduce(
    (acc, url) => {
      const isLocal = competitorLocality.get(url)?.isLocal;
      if (isLocal === true) acc.local += 1;
      else if (isLocal === false) acc.national += 1;
      else acc.unknown += 1;
      return acc;
    },
    { local: 0, national: 0, unknown: 0 },
  );
  const competitorLocalitySummary = {
    total: competitorUrls.length,
    ...localityCounts,
  };

  // Persist guard: only enter concierge/manual fallback when BOTH live dependencies fail.
  // If one provider succeeds, we still return a partial-but-actionable automated report.
  const dataUnavailable =
    usingLiveProviders && rankReports.length === 0 && !pageSpeed;

  const maxTrackedPosition =
    rankReports.length > 0
      ? Math.min(
          ...rankReports.map((report) => report.maxTrackedPosition ?? 100),
        )
      : 100;
  const unrankedPositionValue = maxTrackedPosition + 1;
  const serpResultsReturned = rankReports.map(
    (report) => report.resultsReturned ?? 0,
  );
  const serpResultsMin =
    serpResultsReturned.length > 0 ? Math.min(...serpResultsReturned) : 0;
  const serpResultsMax =
    serpResultsReturned.length > 0 ? Math.max(...serpResultsReturned) : 0;

  // ── 3. Compute gap analysis ─────────────────────────────────────────────────────────────────
  const gapAnalysis = computeGapAnalysis(
    targetUrl,
    rankReports,
    competitorLocalityByDomain,
  );
  const leaderboard = buildLeaderboard(
    targetUrl,
    competitorUrls,
    rankReports,
  ).map((entry) =>
    entry.isTarget
      ? entry
      : { ...entry, isLocal: competitorLocality.get(entry.url)?.isLocal ?? null },
  );
  const keywordPerformance = computeKeywordPerformance(
    rankReports,
    keywords.length,
    maxTrackedPosition,
  );
  const performanceScore =
    pageSpeed?.mobile.categoryScores.performance.score ?? 0;
  const seoScore = pageSpeed?.mobile.categoryScores.seo.score ?? 0;
  // Kept for stored-report compatibility. It is mobile performance (same as
  // performance_score); the v2 score no longer counts it twice.
  const mobileScore = performanceScore;
  const accessibilityScore =
    pageSpeed?.mobile.categoryScores.accessibility.score ?? 0;
  const overall = computeOverallScoreV2({
    // Not measured unless every requested keyword search succeeded.
    visibility: searchVisibilityScore(
      rankReports.map((r) => r.targetResult.position),
      totalKeywords,
    ),
    // Only meaningful when every keyword was measured and competitors exist.
    competitive:
      rankReports.length > 0 &&
      failedKeywordFetches === 0 &&
      competitorUrls.length > 0
        ? 100 - gapAnalysis.opportunityScore
        : null,
    localPack: localPack ? positionToPoints(localPack.target.position) : null,
    gbp: gbp?.score ?? null,
    onPage: onPage?.score ?? null,
    speed: pageSpeed ? performanceScore : null,
    seo: pageSpeed ? seoScore : null,
    accessibility: pageSpeed ? accessibilityScore : null,
    bestPractices: pageSpeed?.mobile.categoryScores.bestPractices.score ?? null,
  });
  const { score, grade } = overall;

  // ── 4. Build report_data ─────────────────────────────────────────────────────────────────
  const providerMeta = {
    provider: provider,
    fetched_at: new Date().toISOString(),
    request_id: crypto.randomUUID(),
    ...({
      keyword_provider: keywordPlan.provider,
      keyword_detected_location: keywordPlan.detectedLocation,
      keyword_search_location: searchLocation,
      keyword_detected_industry: keywordPlan.detectedIndustry,
      keyword_detected_address: keywordPlan.detectedAddress,
      keyword_confidence_score: keywordPlan.confidenceScore,
      keyword_confidence_label: keywordPlan.confidenceLabel,
      keyword_confidence_reasons: keywordPlan.confidenceReasons,
      keyword_requests: totalKeywords,
      keyword_successes: rankReports.length,
      keyword_failures: failedKeywordFetches,
      keyword_max_tracked_position: maxTrackedPosition,
      keyword_unranked_position_value: unrankedPositionValue,
      keyword_serp_results_min: serpResultsMin,
      keyword_serp_results_max: serpResultsMax,
      competitor_locality_summary: competitorLocalitySummary,
      on_page_pages_crawled: onPage?.pagesCrawled ?? 0,
      on_page_findings: onPage?.findings.length ?? 0,
      on_page_score: onPage?.score ?? null,
      on_page_sitemap_found: onPage?.sitemapFound ?? false,
    } as Record<string, unknown>),
  };

  auditDebug("audit:provider_meta", {
    keywordRequests: totalKeywords,
    keywordSuccesses: rankReports.length,
    keywordFailures: failedKeywordFetches,
    maxTrackedPosition,
    serpResultsMin,
    serpResultsMax,
    dataUnavailable,
    manualReview,
    manualReviewNote,
  });

  if (dataUnavailable) {
    const guardedReport: AuditReportData = {
      provider_meta: providerMeta,
      keyword_performance: keywordPerformance,
      ...({
        data_unavailable: true,
        data_unavailable_reason:
          manualReviewNote ?? "External SEO provider data unavailable.",
        keywords_used: keywords,
      } as unknown as Partial<AuditReportData>),
    };

    return {
      reportData: guardedReport,
      provider,
      keywordsUsed: keywords,
      locationDetected: searchLocation,
      manualReview,
      manualReviewNote,
    };
  }

  const reportData: AuditReportData = {
    summary: {
      overall_score: score,
      performance_score: performanceScore,
      seo_score: seoScore,
      mobile_score: mobileScore,
      accessibility_score: accessibilityScore,
      score_version: SCORE_VERSION,
      overall_score_formula: overall.formula,
      overall_score_components: overall.components,
      overall_score_not_measured: overall.notMeasured,
      top_search_result: keywordPerformance.topSearchResult,
      bottom_search_result: keywordPerformance.bottomSearchResult,
      mean_position: keywordPerformance.meanPosition,
      measured_keywords: keywordPerformance.measuredKeywords,
      evaluated_keywords: keywordPerformance.evaluatedKeywords,
      max_tracked_position: keywordPerformance.maxTrackedPosition,
      unranked_position_value: keywordPerformance.unrankedPositionValue,
    },
    rankings:
      rankReports.length > 0
        ? rankReports.map((report) => ({
            keyword: report.keyword,
            position: report.targetResult.position ?? unrankedPositionValue,
            url: report.targetResult.url,
            search_volume: 0, // Serper free tier doesn't include search volume
          }))
        : [],
    competitors: competitorUrls.map((url) => {
      const domain = extractDomain(url);
      const domainRanks = rankReports
        .map((report) => {
          const match = report.competitorResults.find(
            (c) => c.domain === domain,
          );
          if (!match?.position) return null;
          return { keyword: report.keyword, position: match.position };
        })
        .filter(
          (entry): entry is { keyword: string; position: number } =>
            entry !== null,
        );

      const topKeywords = domainRanks
        .sort((a, b) => a.position - b.position)
        .slice(0, 5)
        .map((entry) => entry.keyword);

      const locality = competitorLocality.get(url);

      return {
        url,
        domain,
        domain_authority: 0, // Phase 3: add Moz/Ahrefs integration
        keywords_ranking: domainRanks.length,
        estimated_traffic: 0,
        top_keywords: topKeywords,
        is_local: locality?.isLocal ?? null,
        competitor_detected_location: locality?.detectedLocation ?? null,
        source: discoveredCompetitorUrls.has(url)
          ? ("discovered" as const)
          : ("typed" as const),
      };
    }),
    competitor_discovery: {
      discovered_count: mergedCompetitors.discoveredUrls.length,
      places_status: placesStatus,
      note:
        competitorUrls.length === 0
          ? "No local competitors could be identified for this search, so the competitor comparison was skipped."
          : null,
    },
    technical_issues: [
      ...(onPage?.findings.map((f) => ({
        severity: f.severity,
        type: f.id,
        description: `${f.title}. ${f.description}`,
        url: f.url,
      })) ?? []),
      ...(pageSpeed?.diagnostics.map((d) => ({
        severity: "warning" as const,
        type: d.id,
        description: d.title,
        url: targetUrl,
      })) ?? []),
      ...(pageSpeed?.opportunities
        .filter((o) => o.impact === "critical")
        .map((o) => ({
          severity: "critical" as const,
          type: o.id,
          description: o.title,
          url: targetUrl,
        })) ?? []),
    ],
    page_speed: pageSpeed
      ? {
          mobile: {
            lcp: pageSpeed.mobile.lcp,
            fid: pageSpeed.mobile.fid,
            cls: pageSpeed.mobile.cls,
            ttfb: pageSpeed.mobile.ttfb,
          },
          desktop: {
            lcp: pageSpeed.desktop.lcp,
            fid: pageSpeed.desktop.fid,
            cls: pageSpeed.desktop.cls,
            ttfb: pageSpeed.desktop.ttfb,
          },
        }
      : undefined,
    backlinks: {
      total: 0, // Phase 3: Ahrefs/Moz integration
      referring_domains: 0,
      domain_authority: 0,
    },
    // Ranked by impact, then effort (quick wins first); see findings.ts.
    opportunities: buildOpportunities({
      missingKeywords: gapAnalysis.missingKeywords,
      speed: pageSpeed?.opportunities ?? [],
      gbp: gbpFindings,
      onPage: onPage?.findings ?? [],
    }),
    ...(gbp ? { gbp } : {}),
    provider_meta: providerMeta,
    local_pack: localPack
      ? {
          keyword: localPack.keyword,
          location: localPack.location,
          places: localPack.places,
          target: localPack.target,
          competitors: localPack.competitorResults,
        }
      : null,
    // Extended data stored in report_data for the UI
    ...({
      leaderboard,
      gap_analysis: gapAnalysis,
      grade,
      page_speed_full: pageSpeed,
      keywords_used: keywords,
      keyword_performance: keywordPerformance,
    } as unknown as Partial<AuditReportData>),
  };

  return {
    reportData,
    provider,
    keywordsUsed: keywords,
    locationDetected: searchLocation,
    manualReview,
    manualReviewNote,
  };
}

// Re-export sub-module types so consumers can import from the directory
export type { KeywordGap, GapAnalysis } from "./gap-analysis";
export type {
  LeaderboardEntry,
  KeywordResultSummary,
  KeywordPerformanceSummary,
} from "./leaderboard";
