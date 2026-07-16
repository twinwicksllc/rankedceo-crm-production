import { extractDomain, type SearchRankReport } from "../serper";

// Gaps against competitors classified as non-local (national/regional
// companies) are weighted lower — a small local business realistically
// can't out-market a national player, so these gaps are shown for context
// but shouldn't dominate the opportunity score.
const NATIONAL_COMPETITOR_WEIGHT = 0.4;

export interface KeywordGap {
  keyword: string;
  competitorDomain: string;
  competitorRank: number;
  yourRank: number | null;
  impact: "critical" | "warning" | "info";
  description: string;
}

export interface GapAnalysis {
  missingKeywords: KeywordGap[];
  rankingGaps: KeywordGap[];
  summary: string;
  opportunityScore: number; // 0-100: how much room for improvement
  nationalCompetitorNote?: string;
}

export function computeGapAnalysis(
  targetUrl: string,
  rankReports: SearchRankReport[],
  competitorLocalityByDomain?: Map<string, boolean | null>,
): GapAnalysis {
  const missingKeywords: KeywordGap[] = [];
  const rankingGaps: KeywordGap[] = [];
  const targetDomain = extractDomain(targetUrl);

  const localityWeight = (domain: string): number =>
    competitorLocalityByDomain?.get(domain) === false
      ? NATIONAL_COMPETITOR_WEIGHT
      : 1;

  for (const report of rankReports) {
    const targetPos = report.targetResult.position;

    for (const comp of report.competitorResults) {
      if (!comp.position) continue; // competitor not ranking either

      if (!targetPos) {
        // We're not ranking at all for this keyword
        missingKeywords.push({
          keyword: report.keyword,
          competitorDomain: comp.domain,
          competitorRank: comp.position,
          yourRank: null,
          impact: comp.position <= 3 ? "critical" : "warning",
          description: `"${report.keyword}" — ${comp.domain} ranks #${comp.position} but ${targetDomain} does not appear in top ${report.maxTrackedPosition ?? 100}.`,
        });
      } else if (comp.position < targetPos) {
        // Competitor outranks us
        const gap = targetPos - comp.position;
        rankingGaps.push({
          keyword: report.keyword,
          competitorDomain: comp.domain,
          competitorRank: comp.position,
          yourRank: targetPos,
          impact: gap > 20 ? "critical" : gap > 5 ? "warning" : "info",
          description: `"${report.keyword}" — You rank #${targetPos} but ${comp.domain} ranks #${comp.position} (${gap} positions ahead).`,
        });
      }
    }
  }

  // Build natural language summary
  const totalGaps = missingKeywords.length + rankingGaps.length;
  const criticalGaps = [...missingKeywords, ...rankingGaps].filter(
    (g) => g.impact === "critical",
  ).length;
  const topCompetitor = rankReports[0]?.competitorResults
    .filter((c) => c.position !== null)
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0];

  let summary = "";
  if (totalGaps === 0) {
    summary = `${targetDomain} is competitive for the searched keywords.`;
  } else {
    summary = `${targetDomain} is missing ${missingKeywords.length} key keyword${missingKeywords.length !== 1 ? "s" : ""}`;
    if (topCompetitor?.position) {
      summary += ` that ${topCompetitor.domain} is using to win local leads`;
    }
    summary += `. There ${rankingGaps.length === 1 ? "is" : "are"} ${rankingGaps.length} ranking gap${rankingGaps.length !== 1 ? "s" : ""} where competitors outrank you by an average of ${
      rankingGaps.length > 0
        ? Math.round(
            rankingGaps.reduce(
              (s, g) => s + (g.yourRank ?? 50) - g.competitorRank,
              0,
            ) / rankingGaps.length,
          )
        : 0
    } positions.`;
  }

  // Opportunity score: higher = more room to improve. Gaps against
  // non-local competitors are weighted down (see NATIONAL_COMPETITOR_WEIGHT)
  // since they're less realistically closeable than gaps against genuine
  // local competitors.
  const missingKeywordsWeight = missingKeywords.reduce(
    (sum, g) => sum + localityWeight(g.competitorDomain),
    0,
  );
  const rankingGapsWeight = rankingGaps.reduce(
    (sum, g) => sum + localityWeight(g.competitorDomain),
    0,
  );
  const criticalGapsWeight = [...missingKeywords, ...rankingGaps]
    .filter((g) => g.impact === "critical")
    .reduce((sum, g) => sum + localityWeight(g.competitorDomain), 0);

  const opportunityScore = Math.min(
    100,
    Math.round(
      missingKeywordsWeight * 15 +
        criticalGapsWeight * 10 +
        rankingGapsWeight * 5,
    ),
  );

  // Surface a caveat when gaps are being shown against non-local competitors.
  let nationalCompetitorNote: string | undefined;
  if (competitorLocalityByDomain) {
    const nationalDomains = new Set(
      [...missingKeywords, ...rankingGaps]
        .filter((g) => competitorLocalityByDomain.get(g.competitorDomain) === false)
        .map((g) => g.competitorDomain),
    );
    if (nationalDomains.size > 0) {
      const list = [...nationalDomains].slice(0, 3).join(", ");
      const plural = nationalDomains.size !== 1;
      nationalCompetitorNote = `${nationalDomains.size} of your tracked competitor${plural ? "s" : ""} (${list}) appear${plural ? "" : "s"} to be a larger regional/national company rather than a direct local competitor. These gaps are shown for context but are weighted less in your opportunity score.`;
    }
  }

  return {
    missingKeywords: missingKeywords
      .sort((a, b) => a.competitorRank - b.competitorRank)
      .slice(0, 5),
    rankingGaps: rankingGaps
      .sort(
        (a, b) =>
          (b.yourRank ?? 0) -
          b.competitorRank -
          ((a.yourRank ?? 0) - a.competitorRank),
      )
      .slice(0, 5),
    summary,
    opportunityScore,
    nationalCompetitorNote,
  };
}
