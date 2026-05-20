import { extractDomain, type SearchRankReport } from '../serper'

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

export function computeGapAnalysis(
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
            description:      `"${report.keyword}" — ${comp.domain} ranks #${comp.position} but ${targetDomain} does not appear in top ${report.maxTrackedPosition ?? 100}.`,
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
