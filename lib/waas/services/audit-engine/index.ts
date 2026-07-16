import {
  getSearchRankings,
  getMockSearchRankings,
  getLocalPackRankings,
  getMockLocalPackRankings,
  LOCAL_PACK_ENABLED,
  extractDomain,
  type SearchRankReport,
  type LocalPackReport,
} from "../serper";
import { extractCityFromAddress } from "../serper/location-utils";
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
import { computeOverallScore } from "./scoring";

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
  competitorUrls: string[],
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
  const detectedLocation =
    location ?? keywordPlan.detectedLocation ?? "Chicago, IL";
  const searchLocation =
    extractCityFromAddress(keywordPlan.detectedAddress ?? null) ??
    detectedLocation;
  const keywords = keywordPlan.keywords;
  const totalKeywords = keywords.length;
  let manualReview = false;
  let manualReviewNote: string | null = null;

  auditDebug("audit:start", {
    provider,
    targetUrl,
    competitorCount: competitorUrls.length,
    industryHint: industry,
    locationHint: location,
    detectedLocation,
    searchLocation,
    keywordProvider: keywordPlan.provider,
    keywords,
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

  // Kick off Google Maps Local Pack tracking (if enabled) in parallel too.
  // Only the primary keyword is checked to cap the added Serper /places cost.
  const primaryKeyword = keywords[0];
  const localPackPromise: Promise<LocalPackReport | null> =
    LOCAL_PACK_ENABLED && primaryKeyword
      ? provider === "mock"
        ? Promise.resolve(
            getMockLocalPackRankings(
              targetUrl,
              competitorUrls,
              primaryKeyword,
              searchLocation,
            ),
          )
        : getLocalPackRankings(
            targetUrl,
            competitorUrls,
            primaryKeyword,
            searchLocation,
          ).catch((err) => {
            auditDebug("places:error", { error: String(err).slice(0, 200) });
            return null;
          })
      : Promise.resolve(null);

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
  if (LOCAL_PACK_ENABLED) {
    auditDebug("places:complete", {
      available: localPack !== null,
      targetPosition: localPack?.target.position ?? null,
    });
  }

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
  const mobileScore = pageSpeed?.mobile.categoryScores.performance.score ?? 0;
  const accessibilityScore =
    pageSpeed?.mobile.categoryScores.accessibility.score ?? 0;
  const { score, grade } = computeOverallScore(
    performanceScore,
    seoScore,
    mobileScore,
    accessibilityScore,
  );

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

  const targetDomain = extractDomain(targetUrl);

  const reportData: AuditReportData = {
    summary: {
      overall_score: score,
      performance_score: performanceScore,
      seo_score: seoScore,
      mobile_score: mobileScore,
      accessibility_score: accessibilityScore,
      overall_score_formula:
        "0.40*performance + 0.30*seo + 0.20*mobile + 0.10*accessibility",
      overall_score_components: [
        {
          label: "Performance",
          weight: 0.4,
          score: performanceScore,
          contribution: Number((performanceScore * 0.4).toFixed(1)),
        },
        {
          label: "SEO",
          weight: 0.3,
          score: seoScore,
          contribution: Number((seoScore * 0.3).toFixed(1)),
        },
        {
          label: "Mobile",
          weight: 0.2,
          score: mobileScore,
          contribution: Number((mobileScore * 0.2).toFixed(1)),
        },
        {
          label: "Accessibility",
          weight: 0.1,
          score: accessibilityScore,
          contribution: Number((accessibilityScore * 0.1).toFixed(1)),
        },
      ],
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
      };
    }),
    technical_issues: [
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
    opportunities: [
      ...gapAnalysis.missingKeywords.slice(0, 3).map((g) => ({
        type: "missing_keyword",
        description: g.description,
        estimated_impact: g.impact as "high" | "medium" | "low",
      })),
      ...(pageSpeed?.opportunities.slice(0, 2).map((o) => ({
        type: o.id,
        description: `${o.title} (saves ~${Math.round(o.savings_ms / 100) / 10}s)`,
        estimated_impact:
          o.impact === "critical"
            ? ("high" as const)
            : o.impact === "warning"
              ? ("medium" as const)
              : ("low" as const),
      })) ?? []),
    ],
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
