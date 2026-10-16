import test from "node:test";
import assert from "node:assert/strict";
import { computeGapAnalysis } from "./gap-analysis";
import type { RankResult, SearchRankReport } from "../serper/types";

const TARGET = "https://www.acme.com/";

function rank(domain: string, position: number | null): RankResult {
  return {
    url: `https://${domain}/`,
    domain,
    position,
    title: domain,
    snippet: "",
  };
}

function report(
  keyword: string,
  targetPosition: number | null,
  competitors: Array<[string, number | null]>,
  maxTrackedPosition = 20,
): SearchRankReport {
  return {
    keyword,
    location: "Austin, TX",
    queryUsed: keyword,
    resultsReturned: maxTrackedPosition,
    maxTrackedPosition,
    targetResult: rank("acme.com", targetPosition),
    competitorResults: competitors.map(([d, p]) => rank(d, p)),
    allResults: [],
    searchedAt: "2026-10-16T00:00:00.000Z",
  };
}

test("no reports: competitive summary, zero score, no gaps", () => {
  const result = computeGapAnalysis(TARGET, []);
  assert.deepEqual(result.missingKeywords, []);
  assert.deepEqual(result.rankingGaps, []);
  assert.equal(result.opportunityScore, 0);
  assert.equal(
    result.summary,
    "acme.com is competitive for the searched keywords.",
  );
  assert.equal(result.nationalCompetitorNote, undefined);
});

test("missing keyword: competitor ranks, target does not (top 3 = critical)", () => {
  const result = computeGapAnalysis(TARGET, [
    report("plumber austin", null, [
      ["rival.com", 2],
      ["other.com", 7],
    ]),
  ]);
  assert.equal(result.missingKeywords.length, 2);
  const [first, second] = result.missingKeywords;
  assert.equal(first.competitorDomain, "rival.com");
  assert.equal(first.impact, "critical");
  assert.equal(first.yourRank, null);
  assert.equal(second.competitorDomain, "other.com");
  assert.equal(second.impact, "warning");
  assert.match(first.description, /rival\.com ranks #2/);
  assert.match(first.description, /acme\.com does not appear in top 20/);
  assert.deepEqual(result.rankingGaps, []);
});

test("a competitor that does not rank either is not a gap", () => {
  const result = computeGapAnalysis(TARGET, [
    report("plumber austin", null, [["rival.com", null]]),
  ]);
  assert.deepEqual(result.missingKeywords, []);
  assert.deepEqual(result.rankingGaps, []);
  assert.equal(result.opportunityScore, 0);
});

test("ranking gap impact thresholds: >20 critical, >5 warning, else info", () => {
  const result = computeGapAnalysis(TARGET, [
    report("a", 30, [["crit.com", 5]]), // gap 25
    report("b", 20, [["warn.com", 14]]), // gap 6
    report("c", 10, [["info.com", 5]]), // gap 5 (boundary: not > 5)
    report("d", 21, [["edge.com", 1]]), // gap 20 (boundary: not > 20)
    report("e", 22, [["edge2.com", 1]]), // gap 21 (boundary: first critical)
  ]);
  const impactByDomain = Object.fromEntries(
    result.rankingGaps.map((g) => [g.competitorDomain, g.impact]),
  );
  assert.equal(impactByDomain["crit.com"], "critical");
  assert.equal(impactByDomain["warn.com"], "warning");
  assert.equal(impactByDomain["info.com"], "info");
  assert.equal(impactByDomain["edge.com"], "warning");
  assert.equal(impactByDomain["edge2.com"], "critical");
});

test("missing keyword impact boundary: #3 is critical, #4 is warning", () => {
  const result = computeGapAnalysis(TARGET, [
    report("a", null, [
      ["third.com", 3],
      ["fourth.com", 4],
    ]),
  ]);
  const impactByDomain = Object.fromEntries(
    result.missingKeywords.map((g) => [g.competitorDomain, g.impact]),
  );
  assert.equal(impactByDomain["third.com"], "critical");
  assert.equal(impactByDomain["fourth.com"], "warning");
});

test("a competitor ranking below the target is not a gap", () => {
  const result = computeGapAnalysis(TARGET, [
    report("a", 3, [["rival.com", 9]]),
    report("b", 4, [["same.com", 4]]),
  ]);
  assert.deepEqual(result.rankingGaps, []);
  assert.deepEqual(result.missingKeywords, []);
  assert.match(result.summary, /competitive/);
});

test("opportunity score: 15/missing + 10/critical + 5/ranking gap", () => {
  // One critical missing keyword: 15 + 10 = 25.
  const missing = computeGapAnalysis(TARGET, [
    report("a", null, [["rival.com", 1]]),
  ]);
  assert.equal(missing.opportunityScore, 25);

  // One critical ranking gap: 5 + 10 = 15.
  const gap = computeGapAnalysis(TARGET, [report("a", 40, [["rival.com", 2]])]);
  assert.equal(gap.opportunityScore, 15);

  // One warning ranking gap: 5.
  const warning = computeGapAnalysis(TARGET, [
    report("a", 20, [["rival.com", 12]]),
  ]);
  assert.equal(warning.opportunityScore, 5);
});

test("opportunity score is capped at 100", () => {
  const reports = Array.from({ length: 6 }, (_, i) =>
    report(`kw${i}`, null, [["rival.com", 1]]),
  );
  assert.equal(computeGapAnalysis(TARGET, reports).opportunityScore, 100);
});

test("national competitors are weighted 0.4; unknown locality counts in full", () => {
  const reports = [report("a", null, [["big.com", 1]])];

  // Critical missing keyword: (15 + 10) * 0.4 = 10.
  const national = computeGapAnalysis(
    TARGET,
    reports,
    new Map([["big.com", false]]),
  );
  assert.equal(national.opportunityScore, 10);

  // null = unclassified, treated as local: full 25.
  const unknown = computeGapAnalysis(
    TARGET,
    reports,
    new Map([["big.com", null]]),
  );
  assert.equal(unknown.opportunityScore, 25);

  // true = local: full 25.
  const local = computeGapAnalysis(
    TARGET,
    reports,
    new Map([["big.com", true]]),
  );
  assert.equal(local.opportunityScore, 25);

  // No map at all: full 25.
  assert.equal(computeGapAnalysis(TARGET, reports).opportunityScore, 25);
});

test("national note names the domains and only appears for national gaps", () => {
  const reports = [
    report("a", null, [
      ["big.com", 1],
      ["huge.com", 2],
    ]),
  ];
  const both = computeGapAnalysis(
    TARGET,
    reports,
    new Map([
      ["big.com", false],
      ["huge.com", false],
    ]),
  );
  assert.ok(both.nationalCompetitorNote);
  assert.match(both.nationalCompetitorNote, /^2 of your tracked competitors/);
  assert.match(both.nationalCompetitorNote, /big\.com/);
  assert.match(both.nationalCompetitorNote, /huge\.com/);

  const one = computeGapAnalysis(
    TARGET,
    [report("a", null, [["big.com", 1]])],
    new Map([["big.com", false]]),
  );
  assert.match(one.nationalCompetitorNote ?? "", /^1 of your tracked competitor /);

  // Locality map given but the national domain has no gap: no note.
  const noGap = computeGapAnalysis(
    TARGET,
    [report("a", 1, [["big.com", 5]])],
    new Map([["big.com", false]]),
  );
  assert.equal(noGap.nationalCompetitorNote, undefined);
});

test("results are capped at 5 and sorted: missing by best competitor rank, gaps by widest gap", () => {
  const missingReports = [9, 4, 12, 1, 7, 3, 15].map((p, i) =>
    report(`kw${i}`, null, [[`c${p}.com`, p]]),
  );
  const missing = computeGapAnalysis(TARGET, missingReports).missingKeywords;
  assert.equal(missing.length, 5);
  assert.deepEqual(
    missing.map((g) => g.competitorRank),
    [1, 3, 4, 7, 9],
  );

  const gapReports = [
    report("a", 10, [["a.com", 8]]), // gap 2
    report("b", 50, [["b.com", 5]]), // gap 45
    report("c", 30, [["c.com", 10]]), // gap 20
  ];
  const gaps = computeGapAnalysis(TARGET, gapReports).rankingGaps;
  assert.deepEqual(
    gaps.map((g) => g.competitorDomain),
    ["b.com", "c.com", "a.com"],
  );
});

test("ranking gaps are capped at 5, keeping the five widest", () => {
  // Seven ranking gaps with distinct widths (yourRank - competitorRank):
  // 45, 30, 20, 12, 8, 5, 2. Only the five widest should survive the cap.
  const gapReports = [
    report("w45", 50, [["w45.com", 5]]),
    report("w30", 35, [["w30.com", 5]]),
    report("w20", 30, [["w20.com", 10]]),
    report("w12", 20, [["w12.com", 8]]),
    report("w08", 15, [["w08.com", 7]]),
    report("w05", 25, [["w05.com", 20]]),
    report("w02", 10, [["w02.com", 8]]),
  ];
  const gaps = computeGapAnalysis(TARGET, gapReports).rankingGaps;
  assert.equal(gaps.length, 5);
  assert.deepEqual(
    gaps.map((g) => g.competitorDomain),
    ["w45.com", "w30.com", "w20.com", "w12.com", "w08.com"],
  );
});

test("summary: counts, singular/plural, average gap, top competitor", () => {
  const result = computeGapAnalysis(TARGET, [
    report("a", null, [["rival.com", 2]]),
    report("b", 30, [["rival.com", 5]]), // gap 25
    report("c", 15, [["rival.com", 10]]), // gap 5
  ]);
  assert.equal(
    result.summary,
    "acme.com is missing 1 key keyword that rival.com is using to win local leads. There are 2 ranking gaps where competitors outrank you by an average of 15 positions.",
  );

  const single = computeGapAnalysis(TARGET, [
    report("b", 30, [["rival.com", 5]]),
  ]);
  assert.match(single.summary, /^acme\.com is missing 0 key keywords/);
  assert.match(single.summary, /There is 1 ranking gap where/);
  assert.match(single.summary, /average of 25 positions\.$/);
});
