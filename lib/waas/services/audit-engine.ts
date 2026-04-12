// =============================================================================
// Audit Engine — Orchestrator
// Runs search rankings + PageSpeed, computes gap analysis, builds report_data
// =============================================================================

import {
  getSearchRankings,
  getMockSearchRankings,
  generateKeywords,
  extractDomain,
  type SearchRankReport,
} from './serper'
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
    const rankScores = rankReports.map(report => {
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
  const detectedLocation = location ?? 'Chicago, IL'
  const keywords   = generateKeywords(targetUrl, industry, detectedLocation)
  const primaryKw  = keywords[0]
  let   manualReview     = false
  let   manualReviewNote: string | null = null

  // ── 1. Get search rankings ──────────────────────────────────────────────
  let rankReport: SearchRankReport | null = null

  if (provider === 'mock') {
    rankReport = getMockSearchRankings(targetUrl, competitorUrls, primaryKw, detectedLocation)
  } else {
    try {
      rankReport = await getSearchRankings(targetUrl, competitorUrls, primaryKw, detectedLocation)
    } catch (err) {
      console.error('[AuditEngine] Search rankings failed:', err)
      manualReview     = true
      manualReviewNote = `Search API failed: ${String(err).slice(0, 200)}`
    }
  }

  // ── 2. Run PageSpeed ────────────────────────────────────────────────────
  let pageSpeed: PageSpeedReport | null = null

  if (provider === 'mock') {
    pageSpeed = getMockPageSpeedReport(targetUrl)
  } else {
    try {
      pageSpeed = await runPageSpeedAudit(targetUrl)
    } catch (err) {
      console.error('[AuditEngine] PageSpeed failed:', err)
      if (!manualReview) {
        manualReview     = true
        manualReviewNote = `PageSpeed API failed: ${String(err).slice(0, 200)}`
      }
    }
  }

  // If both APIs failed, mark for manual review
  if (!rankReport && !pageSpeed) {
    manualReview     = true
    manualReviewNote = 'Both search rankings and PageSpeed APIs failed. Site may be unscrapable.'
  }

  // ── 3. Compute gap analysis ─────────────────────────────────────────────
  const rankReports  = rankReport ? [rankReport] : []
  const gapAnalysis  = computeGapAnalysis(targetUrl, rankReports)
  const leaderboard  = buildLeaderboard(targetUrl, competitorUrls, rankReports)
  const { score, grade } = computeOverallScore(pageSpeed, rankReports, targetUrl)

  // ── 4. Build report_data ────────────────────────────────────────────────
  const targetDomain = extractDomain(targetUrl)

  const reportData: AuditReportData = {
    summary: {
      overall_score:       score,
      performance_score:   pageSpeed?.mobile.categoryScores.performance.score  ?? 0,
      seo_score:           pageSpeed?.mobile.categoryScores.seo.score          ?? 0,
      mobile_score:        pageSpeed?.mobile.categoryScores.performance.score  ?? 0,
      accessibility_score: pageSpeed?.mobile.categoryScores.accessibility.score ?? 0,
    },
    rankings: rankReport
      ? rankReport.allResults.map(r => ({
          keyword:       primaryKw,
          position:      r.position,
          url:           r.link,
          search_volume: 0,   // Serper free tier doesn't include search volume
        }))
      : [],
    competitors: competitorUrls.map(url => {
      const domain    = extractDomain(url)
      const compRank  = rankReport?.competitorResults.find(c => c.domain === domain)
      return {
        url,
        domain_authority:  0,  // Phase 3: add Moz/Ahrefs integration
        keywords_ranking:  compRank?.position ? 1 : 0,
        estimated_traffic: 0,
        top_keywords:      compRank?.position ? [primaryKw] : [],
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
    provider_meta: {
      provider:   provider,
      fetched_at: new Date().toISOString(),
      request_id: crypto.randomUUID(),
    },
    // Extended data stored in report_data for the UI (cast via unknown to avoid strict index errors)
    ...(({
      leaderboard,
      gap_analysis:    gapAnalysis,
      grade,
      page_speed_full: pageSpeed,
      keywords_used:   keywords,
    } as unknown) as Partial<AuditReportData>),
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