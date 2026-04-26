// =============================================================================
// Audit Engine — Orchestrator
// Runs search rankings + PageSpeed, computes gap analysis, builds report_data
// =============================================================================

import {
  getSearchRankings,
  getMockSearchRankings,
  extractDomain,
  type SearchRankReport,
} from './serper'
import { generateIndustryKeywordPlan } from './keyword-generator'
import {
  runPageSpeedAudit,
  getMockPageSpeedReport,
  type PageSpeedReport,
} from './pagespeed'
import type { AuditReportData, AuditSeoProvider } from '../types'

// ---------------------------------------------------------------------------
// Gap Analysis
// ---------------------------------------------------------------------------

export interface KeywordGap {
  keyword:         string
  competitorDomain: string
  competitorRank:  number
  yourRank:        number | null
  impact:          'critical' | 'warning' | 'info'
  description:     string
}

export interface GapAnalysis {
  missingKeywords:   KeywordGap[]
  rankingGaps:       KeywordGap[]
  summary:           string
  opportunityScore:  number   // 0-100: how much room for improvement
}

function computeGapAnalysis(
  targetUrl:    string,
  rankReports:  SearchRankReport[]
): GapAnalysis {
  const missingKeywords: KeywordGap[] = []
  const rankingGaps:     KeywordGap[] = []
  const targetDomain = extractDomain(targetUrl)

  for (const report of rankReports) {
    const targetPos = report.targetResult.position

    for (const comp of report.competitorResults) {
      if (!comp.position) continue  // competitor not ranking either

      if (!targetPos) {
        // We're not ranking at all for this keyword
        missingKeywords.push({
          keyword:          report.keyword,
          competitorDomain: comp.domain,
          competitorRank:   comp.position,
          yourRank:         null,
          impact:           comp.position <= 3 ? 'critical' : 'warning',
          description:      `"${report.keyword}" — ${comp.domain} ranks #${comp.position} but ${targetDomain} does not appear in top 100.`,
        })
      } else if (comp.position < targetPos) {
        // Competitor outranks us
        const gap = targetPos - comp.position
        rankingGaps.push({
          keyword:          report.keyword,
          competitorDomain: comp.domain,
          competitorRank:   comp.position,
          yourRank:         targetPos,
          impact:           gap > 20 ? 'critical' : gap > 5 ? 'warning' : 'info',
          description:      `"${report.keyword}" — You rank #${targetPos} but ${comp.domain} ranks #${comp.position} (${gap} positions ahead).`,
        })
      }
    }
  }

  // Build natural language summary
  const totalGaps    = missingKeywords.length + rankingGaps.length
  const criticalGaps = [...missingKeywords, ...rankingGaps].filter(g => g.impact === 'critical').length
  const topCompetitor = rankReports[0]?.competitorResults
    .filter(c => c.position !== null)
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0]

  let summary = ''
  if (totalGaps === 0) {
    summary = `${targetDomain} is competitive for the searched keywords.`
  } else {
    summary = `${targetDomain} is missing ${missingKeywords.length} key keyword${missingKeywords.length !== 1 ? 's' : ''}`
    if (topCompetitor?.position) {
      summary += ` that ${topCompetitor.domain} is using to win local leads`
    }
    summary += `. There ${rankingGaps.length === 1 ? 'is' : 'are'} ${rankingGaps.length} ranking gap${rankingGaps.length !== 1 ? 's' : ''} where competitors outrank you by an average of ${
      rankingGaps.length > 0
        ? Math.round(rankingGaps.reduce((s, g) => s + (g.yourRank ?? 50) - g.competitorRank, 0) / rankingGaps.length)
        : 0
    } positions.`
  }

  // Opportunity score: higher = more room to improve
  const opportunityScore = Math.min(100, Math.round(
    (missingKeywords.length * 15) +
    (criticalGaps * 10) +
    (rankingGaps.length * 5)
  ))

  return {
    missingKeywords: missingKeywords.sort((a, b) => a.competitorRank - b.competitorRank).slice(0, 5),
    rankingGaps:     rankingGaps.sort((a, b) => (b.yourRank ?? 0) - b.competitorRank - ((a.yourRank ?? 0) - a.competitorRank)).slice(0, 5),
    summary,
    opportunityScore,
  }
}

// ---------------------------------------------------------------------------
// Build Leaderboard (all URLs ranked by best position across keywords)
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank:         number
  url:          string
  domain:       string
  bestPosition: number | null   // best Google position across all keywords
  isTarget:     boolean
  badge:        string           // emoji badge
}

export interface KeywordResultSummary {
  keyword:  string
  position: number | null
}

export interface KeywordPerformanceSummary {
  topSearchResult:    KeywordResultSummary | null
  bottomSearchResult: KeywordResultSummary | null
  meanPosition:       number | null
  measuredKeywords:   number
  evaluatedKeywords:  number
}

function computeKeywordPerformance(
  rankReports: SearchRankReport[],
  evaluatedKeywords: number
): KeywordPerformanceSummary {
  const entries = rankReports.map(report => ({
    keyword: report.keyword,
    position: report.targetResult.position,
  }))

  const rankedEntries = entries.filter((entry): entry is { keyword: string; position: number } => entry.position !== null)
  const topSearchResult = rankedEntries.length > 0
    ? [...rankedEntries].sort((a, b) => a.position - b.position)[0]
    : null
  const bottomSearchResult = rankedEntries.length > 0
    ? [...rankedEntries].sort((a, b) => b.position - a.position)[0]
    : null

  // Include non-ranked keywords as position 101 so the mean reflects all evaluated terms.
  const positions = entries.map(entry => entry.position ?? 101)
  const meanPosition = positions.length > 0
    ? Number((positions.reduce((sum, value) => sum + value, 0) / positions.length).toFixed(1))
    : null

  return {
    topSearchResult,
    bottomSearchResult,
    meanPosition,
    measuredKeywords: rankedEntries.length,
    evaluatedKeywords,
  }
}

function buildLeaderboard(
  targetUrl:       string,
  competitorUrls:  string[],
  rankReports:     SearchRankReport[]
): LeaderboardEntry[] {
  const allUrls = [targetUrl, ...competitorUrls]

  const entries: LeaderboardEntry[] = allUrls.map(url => {
    const domain = extractDomain(url)
    let bestPosition: number | null = null

    for (const report of rankReports) {
      const result = url === targetUrl
        ? report.targetResult
        : report.competitorResults.find(c => c.url === url || c.domain === domain)

      if (result?.position && (bestPosition === null || result.position < bestPosition)) {
        bestPosition = result.position
      }
    }

    return {
      rank:         0,
      url,
      domain,
      bestPosition,
      isTarget:     url === targetUrl,
      badge:        '',
    }
  })

  // Sort: ranked first (ascending position), then unranked
  entries.sort((a, b) => {
    if (a.bestPosition === null && b.bestPosition === null) return 0
    if (a.bestPosition === null) return 1
    if (b.bestPosition === null) return -1
    return a.bestPosition - b.bestPosition
  })

  // Assign ranks + badges
  const badges = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
  entries.forEach((e, i) => {
    e.rank  = i + 1
    e.badge = badges[i] ?? `${i + 1}.`
  })

  return entries
}

// ---------------------------------------------------------------------------
// Compute overall audit score (0-100)
// ---------------------------------------------------------------------------
function computeOverallScore(
  pageSpeed:   PageSpeedReport | null,
  rankReports: SearchRankReport[],
  targetUrl:   string
): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' } {
  let score = 0
  let weight = 0

  // PageSpeed performance (40% weight)
  if (pageSpeed) {
    score  += pageSpeed.overallScore * 0.40
    weight += 0.40
  }

  // Ranking (60% weight — split across keywords)
  const targetDomain = extractDomain(targetUrl)
  if (rankReports.length > 0) {
    const rankScores: number[] = rankReports.map(report => {
      const pos = report.targetResult.position
      if (!pos) return 0
      if (pos <= 3)  return 95
      if (pos <= 10) return 75
      if (pos <= 20) return 50
      if (pos <= 50) return 25
      return 10
    })
    const avgRankScore = rankScores.reduce((s, v) => s + v, 0) / rankScores.length
    score  += avgRankScore * 0.60
    weight += 0.60
  }

  const finalScore = weight > 0 ? Math.round(score / weight) : 0

  let grade: 'A' | 'B' | 'C' | 'D' | 'F'
  if (finalScore >= 80) grade = 'A'
  else if (finalScore >= 65) grade = 'B'
  else if (finalScore >= 50) grade = 'C'
  else if (finalScore >= 35) grade = 'D'
  else grade = 'F'

  return { score: finalScore, grade }
}

// ---------------------------------------------------------------------------
// MAIN: Run full audit
// ---------------------------------------------------------------------------

export interface AuditEngineResult {
  reportData:       AuditReportData
  provider:         AuditSeoProvider
  keywordsUsed:     string[]
  locationDetected: string
  manualReview:     boolean
  manualReviewNote: string | null
}

export async function runFullAudit(
  targetUrl:       string,
  competitorUrls:  string[],
  industry:        string | null = null,
  location:        string | null = null
): Promise<AuditEngineResult> {
  const provider   = (process.env.WAAS_SEO_PROVIDER ?? 'mock') as AuditSeoProvider
  const usingLiveProviders = provider !== 'mock'
  const keywordPlan = await generateIndustryKeywordPlan(targetUrl, industry, location, 5)
  const detectedLocation = location ?? keywordPlan.detectedLocation ?? 'Chicago, IL'
  const keywords = keywordPlan.keywords
  const totalKeywords = keywords.length
  let   manualReview     = false
  let   manualReviewNote: string | null = null

  // ── 1. Get search rankings ──────────────────────────────────────────────
  const rankReports: SearchRankReport[] = []

  if (provider === 'mock') {
    for (const keyword of keywords) {
      rankReports.push(getMockSearchRankings(targetUrl, competitorUrls, keyword, detectedLocation))
    }
  } else {
    const searchResults = await Promise.allSettled(
      keywords.map(keyword => getSearchRankings(targetUrl, competitorUrls, keyword, detectedLocation))
    )

    for (const result of searchResults) {
      if (result.status === 'fulfilled' && result.value) {
        rankReports.push(result.value)
      }
    }

    if (rankReports.length === 0) {
      manualReview = true
      manualReviewNote = 'Search API failed for all evaluated keywords.'
    }
  }

  const failedKeywordFetches = Math.max(0, totalKeywords - rankReports.length)
  if (failedKeywordFetches > 0 && rankReports.length > 0) {
    manualReviewNote = `${failedKeywordFetches} keyword search request(s) failed and were excluded from ranking analysis.`
  }

  // ── 2. Run PageSpeed ────────────────────────────────────────────────────
  let pageSpeed: PageSpeedReport | null = null

  if (provider === 'mock') {
    pageSpeed = getMockPageSpeedReport(targetUrl)
  } else {
    try {
      pageSpeed = await runPageSpeedAudit(targetUrl)
      if (!pageSpeed && !manualReview) {
        manualReview = true
        manualReviewNote = 'PageSpeed API returned no analyzable data.'
      }
    } catch (err) {
      console.error('[AuditEngine] PageSpeed failed:', err)
      if (!manualReview) {
        manualReview     = true
        manualReviewNote = `PageSpeed API failed: ${String(err).slice(0, 200)}`
      }
    }
  }

  // If both APIs failed, mark for manual review
  if (rankReports.length === 0 && !pageSpeed) {
    manualReview     = true
    manualReviewNote = 'Both search rankings and PageSpeed APIs failed. Site may be unscrapable.'
  }

  // Persist guard: when live provider dependencies fail, avoid writing synthetic 0/100 summaries.
  const dataUnavailable = usingLiveProviders && (rankReports.length === 0 || !pageSpeed)

  // ── 3. Compute gap analysis ─────────────────────────────────────────────
  const gapAnalysis  = computeGapAnalysis(targetUrl, rankReports)
  const leaderboard  = buildLeaderboard(targetUrl, competitorUrls, rankReports)
  const keywordPerformance = computeKeywordPerformance(rankReports, keywords.length)
  const { score, grade } = computeOverallScore(pageSpeed, rankReports, targetUrl)

  // ── 4. Build report_data ────────────────────────────────────────────────
  const providerMeta = {
    provider:   provider,
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
    } as Record<string, unknown>),
  }

  if (dataUnavailable) {
    const guardedReport: AuditReportData = {
      provider_meta: providerMeta,
      keyword_performance: keywordPerformance,
      ...(({
        data_unavailable: true,
        data_unavailable_reason: manualReviewNote ?? 'External SEO provider data unavailable.',
        keywords_used: keywords,
      }) as unknown as Partial<AuditReportData>),
    }

    return {
      reportData: guardedReport,
      provider,
      keywordsUsed:     keywords,
      locationDetected: detectedLocation,
      manualReview,
      manualReviewNote,
    }
  }

  const targetDomain = extractDomain(targetUrl)

  const reportData: AuditReportData = {
    summary: {
      overall_score:       score,
      performance_score:   pageSpeed?.mobile.categoryScores.performance.score  ?? 0,
      seo_score:           pageSpeed?.mobile.categoryScores.seo.score          ?? 0,
      mobile_score:        pageSpeed?.mobile.categoryScores.performance.score  ?? 0,
      accessibility_score: pageSpeed?.mobile.categoryScores.accessibility.score ?? 0,
      top_search_result:   keywordPerformance.topSearchResult,
      bottom_search_result: keywordPerformance.bottomSearchResult,
      mean_position:       keywordPerformance.meanPosition,
      measured_keywords:   keywordPerformance.measuredKeywords,
      evaluated_keywords:  keywordPerformance.evaluatedKeywords,
    },
    rankings: rankReports.length > 0
      ? rankReports.map(report => ({
          keyword:       report.keyword,
          position:      report.targetResult.position ?? 101,
          url:           report.targetResult.url,
          search_volume: 0,   // Serper free tier doesn't include search volume
        }))
      : [],
    competitors: competitorUrls.map(url => {
      const domain    = extractDomain(url)
      const domainRanks = rankReports
        .map(report => {
          const match = report.competitorResults.find(c => c.domain === domain)
          if (!match?.position) return null
          return { keyword: report.keyword, position: match.position }
        })
        .filter((entry): entry is { keyword: string; position: number } => entry !== null)

      const topKeywords = domainRanks
        .sort((a, b) => a.position - b.position)
        .slice(0, 5)
        .map(entry => entry.keyword)

      return {
        url,
        domain,
        domain_authority:  0,  // Phase 3: add Moz/Ahrefs integration
        keywords_ranking:  domainRanks.length,
        estimated_traffic: 0,
        top_keywords:      topKeywords,
      }
    }),
    technical_issues: [
      ...(pageSpeed?.diagnostics.map(d => ({
        severity:    'warning' as const,
        type:        d.id,
        description: d.title,
        url:         targetUrl,
      })) ?? []),
      ...(pageSpeed?.opportunities
        .filter(o => o.impact === 'critical')
        .map(o => ({
          severity:    'critical' as const,
          type:        o.id,
          description: o.title,
          url:         targetUrl,
        })) ?? []),
    ],
    page_speed: pageSpeed ? {
      mobile: {
        lcp:  pageSpeed.mobile.lcp,
        fid:  pageSpeed.mobile.fid,
        cls:  pageSpeed.mobile.cls,
        ttfb: pageSpeed.mobile.ttfb,
      },
      desktop: {
        lcp:  pageSpeed.desktop.lcp,
        fid:  pageSpeed.desktop.fid,
        cls:  pageSpeed.desktop.cls,
        ttfb: pageSpeed.desktop.ttfb,
      },
    } : undefined,
    backlinks: {
      total:             0,   // Phase 3: Ahrefs/Moz integration
      referring_domains: 0,
      domain_authority:  0,
    },
    opportunities: [
      ...gapAnalysis.missingKeywords.slice(0, 3).map(g => ({
        type:             'missing_keyword',
        description:      g.description,
        estimated_impact: g.impact as 'high' | 'medium' | 'low',
      })),
      ...(pageSpeed?.opportunities.slice(0, 2).map(o => ({
        type:             o.id,
        description:      `${o.title} (saves ~${Math.round(o.savings_ms / 100) / 10}s)`,
        estimated_impact: o.impact === 'critical' ? 'high' as const : o.impact === 'warning' ? 'medium' as const : 'low' as const,
      })) ?? []),
    ],
    provider_meta: providerMeta,
    // Extended data stored in report_data for the UI
    ...(({
      leaderboard,
      gap_analysis:    gapAnalysis,
      grade,
      page_speed_full: pageSpeed,
      keywords_used:   keywords,
      keyword_performance: keywordPerformance,
    }) as unknown as Partial<AuditReportData>),
  }

  return {
    reportData,
    provider,
    keywordsUsed:     keywords,
    locationDetected: detectedLocation,
    manualReview,
    manualReviewNote,
  }
}