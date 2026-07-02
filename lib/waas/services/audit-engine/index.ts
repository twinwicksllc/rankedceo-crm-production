import {
  getSearchRankings,
  getMockSearchRankings,
  extractDomain,
  type SearchRankReport,
} from "../serper";
import { generateIndustryKeywordPlan } from "../keyword-generator";
import {
  runPageSpeedAudit,
  getMockPageSpeedReport,
  type PageSpeedReport,
} from "../pagespeed";
import type { AuditReportData, AuditSeoProvider } from "../../types";
import { computeGapAnalysis } from "./gap-analysis";
import { buildLeaderboard, computeKeywordPerformance } from "./leaderboard";
import { computeOverallScore } from "./scoring";

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
  const provider = (process.env.WAAS_SEO_PROVIDER ??
    "mock") as AuditSeoProvider;
  const usingLiveProviders = provider !== "mock";
  const keywordPlan = await generateIndustryKeywordPlan(
    targetUrl,
    industry,
    location,
    5,
  );
  const detectedLocation =
    location ?? keywordPlan.detectedLocation ?? "Chicago, IL";
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
          detectedLocation,
        ),
      );
    }
    auditDebug("rankings:mock_complete", {
      keywordCount: keywords.length,
    });
  } else {
    const searchResults = await Promise.allSettled(
      keywords.map((keyword) =>
        getSearchRankings(targetUrl, competitorUrls, keyword, detectedLocation),
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
  const gapAnalysis = computeGapAnalysis(targetUrl, rankReports);
  const leaderboard = buildLeaderboard(targetUrl, competitorUrls, rankReports);
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
      locationDetected: detectedLocation,
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

      return {
        url,
        domain,
        domain_authority: 0, // Phase 3: add Moz/Ahrefs integration
        keywords_ranking: domainRanks.length,
        estimated_traffic: 0,
        top_keywords: topKeywords,
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
    locationDetected: detectedLocation,
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
