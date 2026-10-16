import test from "node:test";
import assert from "node:assert/strict";
import { buildLeaderboard, computeKeywordPerformance } from "./leaderboard";
import type { RankResult, SearchRankReport } from "../serper/types";

function rank(url: string, domain: string, position: number | null): RankResult {
  return { url, domain, position, title: domain, snippet: "" };
}

function report(
  keyword: string,
  targetPosition: number | null,
  competitors: RankResult[] = [],
  maxTrackedPosition = 20,
): SearchRankReport {
  return {
    keyword,
    location: "Austin, TX",
    queryUsed: keyword,
    resultsReturned: maxTrackedPosition,
    maxTrackedPosition,
    targetResult: rank("https://acme.com/", "acme.com", targetPosition),
    competitorResults: competitors,
    allResults: [],
    searchedAt: "2026-10-16T00:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// computeKeywordPerformance
// ---------------------------------------------------------------------------

test("keyword performance: no reports gives nulls and the unranked value", () => {
  const result = computeKeywordPerformance([], 0, 20);
  assert.equal(result.topSearchResult, null);
  assert.equal(result.bottomSearchResult, null);
  assert.equal(result.meanPosition, null);
  assert.equal(result.measuredKeywords, 0);
  assert.equal(result.evaluatedKeywords, 0);
  assert.equal(result.maxTrackedPosition, 20);
  assert.equal(result.unrankedPositionValue, 21);
});

test("keyword performance: top, bottom and mean count unranked as max+1", () => {
  const result = computeKeywordPerformance(
    [report("a", 3), report("b", null), report("c", 10)],
    5,
    20,
  );
  assert.deepEqual(result.topSearchResult, { keyword: "a", position: 3 });
  assert.deepEqual(result.bottomSearchResult, { keyword: "c", position: 10 });
  // (3 + 21 + 10) / 3 = 11.33 -> one decimal
  assert.equal(result.meanPosition, 11.3);
  assert.equal(result.measuredKeywords, 2);
  // evaluatedKeywords is passed through, not derived from the reports
  assert.equal(result.evaluatedKeywords, 5);
});

test("keyword performance: all unranked has no top/bottom and mean = max+1", () => {
  const result = computeKeywordPerformance(
    [report("a", null), report("b", null)],
    2,
    20,
  );
  assert.equal(result.topSearchResult, null);
  assert.equal(result.bottomSearchResult, null);
  assert.equal(result.meanPosition, 21);
  assert.equal(result.measuredKeywords, 0);
});

test("keyword performance: a single ranked keyword is both top and bottom", () => {
  const result = computeKeywordPerformance([report("only", 7)], 1, 20);
  assert.deepEqual(result.topSearchResult, { keyword: "only", position: 7 });
  assert.deepEqual(result.bottomSearchResult, { keyword: "only", position: 7 });
  assert.equal(result.meanPosition, 7);
});

// ---------------------------------------------------------------------------
// buildLeaderboard
// ---------------------------------------------------------------------------

test("leaderboard: best position across keywords, sorted, ranked and badged", () => {
  const rival = rank("https://rival.com/", "rival.com", 2);
  const rivalWorse = rank("https://rival.com/", "rival.com", 9);
  const other = rank("https://other.com/", "other.com", 1);

  const entries = buildLeaderboard(
    "https://acme.com/",
    ["https://rival.com/", "https://other.com/"],
    [
      report("a", 5, [rivalWorse, other]),
      report("b", 4, [rival, rank("https://other.com/", "other.com", null)]),
    ],
  );

  assert.deepEqual(
    entries.map((e) => [e.rank, e.domain, e.bestPosition, e.isTarget]),
    [
      [1, "other.com", 1, false],
      [2, "rival.com", 2, false],
      [3, "acme.com", 4, true],
    ],
  );
  assert.deepEqual(
    entries.map((e) => e.badge),
    ["🥇", "🥈", "🥉"],
  );
});

test("leaderboard: unranked entries sort last and keep input order", () => {
  const entries = buildLeaderboard(
    "https://acme.com/",
    ["https://a.com/", "https://b.com/"],
    [report("k", null, [])],
  );
  assert.deepEqual(
    entries.map((e) => [e.domain, e.bestPosition, e.rank]),
    [
      ["acme.com", null, 1],
      ["a.com", null, 2],
      ["b.com", null, 3],
    ],
  );
});

test("leaderboard: ranked entries come before unranked ones", () => {
  const entries = buildLeaderboard(
    "https://acme.com/",
    ["https://rival.com/"],
    [report("k", null, [rank("https://rival.com/", "rival.com", 6)])],
  );
  assert.equal(entries[0].domain, "rival.com");
  assert.equal(entries[0].rank, 1);
  assert.equal(entries[1].domain, "acme.com");
  assert.equal(entries[1].bestPosition, null);
});

test("leaderboard: competitor URL matches by domain when the URL differs", () => {
  const entries = buildLeaderboard(
    "https://acme.com/",
    ["https://www.rival.com/services"],
    [report("k", 8, [rank("https://rival.com/", "rival.com", 3)])],
  );
  const rival = entries.find((e) => e.domain === "rival.com");
  assert.equal(rival?.bestPosition, 3);
});

test("leaderboard: badges run out after five entries and fall back to a number", () => {
  const urls = ["a", "b", "c", "d", "e"].map((d) => `https://${d}.com/`);
  const entries = buildLeaderboard(
    "https://acme.com/",
    urls,
    [
      report(
        "k",
        1,
        urls.map((u, i) => rank(u, new URL(u).hostname, i + 2)),
      ),
    ],
  );
  assert.equal(entries.length, 6);
  assert.deepEqual(
    entries.map((e) => e.badge),
    ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6."],
  );
});

test("leaderboard: the target is always present and marked, locality unset", () => {
  const entries = buildLeaderboard("https://acme.com/", [], []);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].isTarget, true);
  assert.equal(entries[0].rank, 1);
  assert.equal(entries[0].bestPosition, null);
  assert.equal(entries[0].isLocal, undefined);
});
