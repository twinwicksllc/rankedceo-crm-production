import test from "node:test";
import assert from "node:assert/strict";
import {
  EFFORT_LABEL,
  buildOpportunities,
  effortForType,
  humanizeFindingType,
  normalizeImpact,
  rankOpportunities,
  taglineFromOpportunities,
  type OpportunityInputs,
} from "./findings";
import type { AuditOpportunity } from "../../types";

function opp(
  type: string,
  impact: AuditOpportunity["estimated_impact"],
  description = type,
): AuditOpportunity {
  return { type, description, estimated_impact: impact };
}

test("normalizeImpact: both vocabularies map to high/medium/low", () => {
  assert.equal(normalizeImpact("high"), "high");
  assert.equal(normalizeImpact("critical"), "high");
  assert.equal(normalizeImpact("medium"), "medium");
  assert.equal(normalizeImpact("warning"), "medium");
  assert.equal(normalizeImpact("low"), "low");
  assert.equal(normalizeImpact("info"), "low");
});

test("normalizeImpact: anything unrecognised is low", () => {
  assert.equal(normalizeImpact(undefined), "low");
  assert.equal(normalizeImpact(null), "low");
  assert.equal(normalizeImpact(""), "low");
  assert.equal(normalizeImpact("HIGH"), "low");
  assert.equal(normalizeImpact(3), "low");
});

test("effortForType: settings and tags are low", () => {
  for (const id of [
    "on_page_missing_title",
    "on_page_title_length",
    "on_page_missing_meta_description",
    "on_page_meta_description_length",
    "on_page_missing_h1",
    "on_page_multiple_h1",
    "on_page_missing_canonical",
    "on_page_missing_lang",
    "on_page_missing_viewport",
    "on_page_noindex",
    "on_page_robots_disallow_all",
    "on_page_missing_robots_txt",
    "on_page_missing_sitemap",
    "on_page_pages_noindex",
  ]) {
    assert.equal(effortForType(id), "low", id);
  }
});

test("effortForType: new pages are high, schema/copy/keywords are medium", () => {
  assert.equal(effortForType("on_page_no_service_pages"), "high");
  assert.equal(effortForType("on_page_no_location_pages"), "high");
  assert.equal(effortForType("on_page_missing_schema"), "medium");
  assert.equal(effortForType("on_page_thin_content"), "medium");
  assert.equal(effortForType("missing_keyword"), "medium");
});

test("effortForType: PageSpeed ids are high", () => {
  assert.equal(effortForType("render-blocking-resources"), "high");
  assert.equal(effortForType("uses-optimized-images"), "high");
});

test("effort labels cover every effort value", () => {
  assert.deepEqual(Object.keys(EFFORT_LABEL).sort(), ["high", "low", "medium"]);
});

test("rank: impact first, then least effort, then original order", () => {
  const ranked = rankOpportunities([
    opp("missing_keyword", "high"), // high, medium effort
    opp("on_page_no_service_pages", "high"), // high, high effort
    opp("on_page_missing_title", "high"), // high, low effort
    opp("on_page_missing_lang", "low"), // low, low effort
    opp("on_page_title_length", "medium"), // medium, low effort
    opp("render-blocking-resources", "medium"), // medium, high effort
  ]);
  assert.deepEqual(
    ranked.map((o) => o.type),
    [
      "on_page_missing_title",
      "missing_keyword",
      "on_page_no_service_pages",
      "on_page_title_length",
      "render-blocking-resources",
      "on_page_missing_lang",
    ],
  );
});

test("rank: equal impact and effort keep their input order (stable)", () => {
  const ranked = rankOpportunities([
    opp("on_page_missing_h1", "medium", "first"),
    opp("on_page_missing_lang", "medium", "second"),
    opp("on_page_missing_viewport", "medium", "third"),
  ]);
  assert.deepEqual(
    ranked.map((o) => o.description),
    ["first", "second", "third"],
  );
});

test("rank: stored audits with critical/warning/info are normalised and sorted", () => {
  // Written by the engine before this fix: gap impacts were cast as-is.
  const stored = [
    { type: "x", description: "a", estimated_impact: "info" },
    { type: "missing_keyword", description: "b", estimated_impact: "critical" },
    { type: "y", description: "c", estimated_impact: "warning" },
  ] as unknown as AuditOpportunity[];
  const ranked = rankOpportunities(stored);
  assert.deepEqual(
    ranked.map((o) => [o.description, o.estimated_impact]),
    [
      ["b", "high"],
      ["c", "medium"],
      ["a", "low"],
    ],
  );
});

test("rank: does not mutate its input and adds effort", () => {
  const input = [opp("on_page_missing_title", "high")];
  const before = JSON.stringify(input);
  const ranked = rankOpportunities(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(ranked[0].effort, "low");
  assert.notEqual(ranked[0], input[0]);
});

test("rank: empty input", () => {
  assert.deepEqual(rankOpportunities([]), []);
});

const baseInput: OpportunityInputs = {
  missingKeywords: [],
  speed: [],
  onPage: [],
};

test("buildOpportunities: a critical missing keyword is HIGH, not low (the bug)", () => {
  const result = buildOpportunities({
    ...baseInput,
    missingKeywords: [{ description: "plumber austin", impact: "critical" }],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "missing_keyword");
  assert.equal(result[0].estimated_impact, "high");
});

test("buildOpportunities: PageSpeed critical/warning/info map to high/medium/low", () => {
  const result = buildOpportunities({
    ...baseInput,
    speed: [
      { id: "a", title: "A", savings_ms: 1500, impact: "info" },
      { id: "b", title: "B", savings_ms: 900, impact: "critical" },
    ],
  });
  assert.deepEqual(
    result.map((o) => [o.type, o.estimated_impact]),
    [
      ["b", "high"],
      ["a", "low"],
    ],
  );
  assert.equal(result[0].description, "B (saves ~0.9s)");
  assert.equal(result[1].description, "A (saves ~1.5s)");
});

test("buildOpportunities: on-page uses its own impact, skips info severity, adds the fix", () => {
  const result = buildOpportunities({
    ...baseInput,
    onPage: [
      {
        id: "on_page_missing_title",
        title: "Homepage has no title tag",
        fix: "Add a title.",
        severity: "critical",
        impact: "high",
      },
      {
        id: "on_page_missing_schema",
        title: "No schema",
        fix: "Add JSON-LD.",
        severity: "info",
        impact: "high",
      },
    ],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].description, "Homepage has no title tag. Add a title.");
  assert.equal(result[0].estimated_impact, "high");
});

test("buildOpportunities: keeps the per-source caps (3 keywords, 2 speed, 3 on-page)", () => {
  const result = buildOpportunities({
    missingKeywords: Array.from({ length: 5 }, (_, i) => ({
      description: `kw${i}`,
      impact: "warning",
    })),
    speed: Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      title: `S${i}`,
      savings_ms: 100,
      impact: "warning",
    })),
    onPage: Array.from({ length: 5 }, (_, i) => ({
      id: `on_page_missing_h${i}`,
      title: `T${i}`,
      fix: "f",
      severity: "warning",
      impact: "medium",
    })),
  });
  assert.equal(result.length, 8);
  assert.equal(result.filter((o) => o.type === "missing_keyword").length, 3);
  assert.equal(result.filter((o) => o.type.startsWith("s")).length, 2);
  assert.equal(result.filter((o) => o.type.startsWith("on_page_")).length, 3);
});

test("buildOpportunities: quick high-impact fixes outrank a high-impact keyword gap", () => {
  const result = buildOpportunities({
    missingKeywords: [{ description: "kw", impact: "critical" }],
    speed: [{ id: "slow", title: "Slow", savings_ms: 2000, impact: "critical" }],
    onPage: [
      {
        id: "on_page_missing_title",
        title: "No title",
        fix: "Add it.",
        severity: "critical",
        impact: "high",
      },
    ],
  });
  assert.deepEqual(
    result.map((o) => o.type),
    ["on_page_missing_title", "missing_keyword", "slow"],
  );
});

test("buildOpportunities: nothing in, nothing out", () => {
  assert.deepEqual(buildOpportunities(baseInput), []);
});

test("humanizeFindingType: no machine ids in text shown to people", () => {
  assert.equal(humanizeFindingType("on_page_missing_title"), "missing title");
  assert.equal(humanizeFindingType("missing_keyword"), "missing keyword");
  assert.equal(
    humanizeFindingType("render-blocking-resources"),
    "render blocking resources",
  );
  assert.equal(humanizeFindingType("on_page_pages_thin"), "pages thin");
});

test("tagline: reads words, not machine ids (the bug)", () => {
  assert.equal(
    taglineFromOpportunities([opp("on_page_missing_title", "high")]),
    "Improving missing title for better performance.",
  );
});

test("tagline: uses the top two after ranking, high impact only", () => {
  const tagline = taglineFromOpportunities([
    opp("on_page_missing_lang", "low"),
    opp("render-blocking-resources", "high"), // high, high effort
    opp("on_page_missing_title", "high"), // high, low effort -> first
    opp("on_page_missing_h1", "high"), // third: cut off
  ]);
  assert.equal(
    tagline,
    "Improving missing title and missing h1 for better performance.",
  );
});

test("tagline: stored audits with the old impact words still produce one", () => {
  const stored = [
    { type: "missing_keyword", description: "d", estimated_impact: "critical" },
  ] as unknown as AuditOpportunity[];
  assert.equal(
    taglineFromOpportunities(stored),
    "Improving missing keyword for better performance.",
  );
});

test("tagline: null when nothing is high impact or there is no list", () => {
  assert.equal(taglineFromOpportunities([opp("on_page_missing_lang", "low")]), null);
  assert.equal(taglineFromOpportunities([]), null);
  assert.equal(taglineFromOpportunities(undefined), null);
  assert.equal(taglineFromOpportunities(null), null);
});

test("effortForType: GBP details are quick, reviews and map presence take work", () => {
  assert.equal(effortForType("nap_mismatch"), "low");
  assert.equal(effortForType("gbp_incomplete"), "low");
  assert.equal(effortForType("review_gap"), "medium");
  assert.equal(effortForType("gbp_not_found"), "medium");
});

test("buildOpportunities: GBP findings are pooled, capped at 3 and ranked with the rest", () => {
  const gbp = [
    { id: "nap_mismatch", title: "Phone differs", fix: "Match it", impact: "high" },
    { id: "review_gap", title: "Few reviews", fix: "Ask", impact: "high" },
    { id: "gbp_incomplete", title: "Incomplete", fix: "Fill in", impact: "medium" },
    { id: "gbp_not_found", title: "Extra", fix: "Extra", impact: "medium" },
  ];
  const out = buildOpportunities({ missingKeywords: [], speed: [], onPage: [], gbp });
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((o) => o.type),
    ["nap_mismatch", "review_gap", "gbp_incomplete"],
  );
  assert.equal(out[0].effort, "low");
  assert.match(out[0].description, /Phone differs\. Match it/);
});

test("buildOpportunities: omitting gbp behaves as before", () => {
  const out = buildOpportunities({ missingKeywords: [], speed: [], onPage: [] });
  assert.deepEqual(out, []);
});
