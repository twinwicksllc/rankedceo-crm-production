import { extractDomain, type SearchRankReport } from "../serper";

export interface LeaderboardEntry {
  rank: number;
  url: string;
  domain: string;
  bestPosition: number | null; // best Google position across all keywords
  isTarget: boolean;
  badge: string; // emoji badge
}

export interface KeywordResultSummary {
  keyword: string;
  position: number | null;
}

export interface KeywordPerformanceSummary {
  topSearchResult: KeywordResultSummary | null;
  bottomSearchResult: KeywordResultSummary | null;
  meanPosition: number | null;
  measuredKeywords: number;
  evaluatedKeywords: number;
  maxTrackedPosition: number;
  unrankedPositionValue: number;
}

export function computeKeywordPerformance(
  rankReports: SearchRankReport[],
  evaluatedKeywords: number,
  maxTrackedPosition: number,
): KeywordPerformanceSummary {
  const entries = rankReports.map((report) => ({
    keyword: report.keyword,
    position: report.targetResult.position,
  }));

  const rankedEntries = entries.filter(
    (entry): entry is { keyword: string; position: number } =>
      entry.position !== null,
  );
  const topSearchResult =
    rankedEntries.length > 0
      ? [...rankedEntries].sort((a, b) => a.position - b.position)[0]
      : null;
  const bottomSearchResult =
    rankedEntries.length > 0
      ? [...rankedEntries].sort((a, b) => b.position - a.position)[0]
      : null;

  // Include non-ranked keywords as (maxTrackedPosition + 1) so the mean reflects all evaluated terms.
  const unrankedPositionValue = maxTrackedPosition + 1;
  const positions = entries.map(
    (entry) => entry.position ?? unrankedPositionValue,
  );
  const meanPosition =
    positions.length > 0
      ? Number(
          (
            positions.reduce((sum, value) => sum + value, 0) / positions.length
          ).toFixed(1),
        )
      : null;

  return {
    topSearchResult,
    bottomSearchResult,
    meanPosition,
    measuredKeywords: rankedEntries.length,
    evaluatedKeywords,
    maxTrackedPosition,
    unrankedPositionValue,
  };
}

export function buildLeaderboard(
  targetUrl: string,
  competitorUrls: string[],
  rankReports: SearchRankReport[],
): LeaderboardEntry[] {
  const allUrls = [targetUrl, ...competitorUrls];

  const entries: LeaderboardEntry[] = allUrls.map((url) => {
    const domain = extractDomain(url);
    let bestPosition: number | null = null;

    for (const report of rankReports) {
      const result =
        url === targetUrl
          ? report.targetResult
          : report.competitorResults.find(
              (c) => c.url === url || c.domain === domain,
            );

      if (
        result?.position &&
        (bestPosition === null || result.position < bestPosition)
      ) {
        bestPosition = result.position;
      }
    }

    return {
      rank: 0,
      url,
      domain,
      bestPosition,
      isTarget: url === targetUrl,
      badge: "",
    };
  });

  // Sort: ranked first (ascending position), then unranked
  entries.sort((a, b) => {
    if (a.bestPosition === null && b.bestPosition === null) return 0;
    if (a.bestPosition === null) return 1;
    if (b.bestPosition === null) return -1;
    return a.bestPosition - b.bestPosition;
  });

  // Assign ranks + badges
  const badges = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  entries.forEach((e, i) => {
    e.rank = i + 1;
    e.badge = badges[i] ?? `${i + 1}.`;
  });

  return entries;
}
