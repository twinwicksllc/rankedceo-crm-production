import test from "node:test";
import assert from "node:assert/strict";
import {
  computeOverallScore,
  computeOverallScoreV2,
  getDisplayScore,
  gradeFromScore,
  positionToPoints,
  searchVisibilityScore,
  SCORE_VERSION,
  type ScoreInputs,
} from "./scoring";

const full: ScoreInputs = {
  visibility: 80,
  competitive: 70,
  localPack: 60,
  speed: 90,
  seo: 100,
  accessibility: 100,
  bestPractices: 100,
};

test("positionToPoints: anchors, interpolation, unranked", () => {
  assert.equal(positionToPoints(1), 100);
  assert.equal(positionToPoints(3), 90);
  assert.equal(positionToPoints(10), 60);
  assert.equal(positionToPoints(100), 0);
  assert.equal(positionToPoints(null), 0);
  assert.equal(positionToPoints(250), 0);
  assert.equal(positionToPoints(0), 0);
  assert.ok(positionToPoints(6) < 90 && positionToPoints(6) > 60);
});

test("searchVisibilityScore: unranked keywords count as 0, empty is null", () => {
  assert.equal(searchVisibilityScore([]), null);
  assert.equal(searchVisibilityScore([1, null]), 50);
  assert.equal(searchVisibilityScore([null, null, null]), 0);
});

test("v2: weights sum to 1 and score matches hand calculation", () => {
  const r = computeOverallScoreV2(full);
  const sum = r.components.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 0.001);
  // .35*80 + .15*70 + .10*60 + .15*90 + .15*100 + .05*100 + .05*100 = 28+10.5+6+13.5+15+5+5
  assert.equal(r.score, 83);
  assert.equal(r.grade, "A");
  assert.equal(r.version, SCORE_VERSION);
  assert.deepEqual(r.notMeasured, []);
});

test("v2: a fast site that is invisible in Google does NOT score well", () => {
  const r = computeOverallScoreV2({
    ...full,
    visibility: 0,
    competitive: 0,
    localPack: 0,
    speed: 100,
    seo: 100,
    accessibility: 100,
    bestPractices: 100,
  });
  // legacy formula would give 100 here
  assert.ok(r.score <= 40, `expected <= 40, got ${r.score}`);
  assert.equal(
    computeOverallScore(100, 100, 100, 100).score,
    100,
    "documents the old behaviour",
  );
});

test("v2: unmeasured components share their weight and are listed", () => {
  const r = computeOverallScoreV2({
    ...full,
    localPack: null,
    competitive: null,
  });
  assert.deepEqual(r.notMeasured, [
    "Competitive position",
    "Google Maps (local pack)",
  ]);
  const sum = r.components.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 0.001);
  assert.ok(r.components.find((c) => c.key === "local_pack")?.weight === 0);
});

test("v2: nothing measured gives 0 and no divide-by-zero", () => {
  const r = computeOverallScoreV2({
    visibility: null,
    competitive: null,
    localPack: null,
    speed: null,
    seo: null,
    accessibility: null,
    bestPractices: null,
  });
  assert.equal(r.score, 0);
  assert.equal(r.grade, "F");
  assert.equal(r.notMeasured.length, 7);
});

test("v2: inputs are clamped to 0-100", () => {
  const r = computeOverallScoreV2({ ...full, speed: 250, seo: -5 });
  assert.equal(r.components.find((c) => c.key === "speed")?.score, 100);
  assert.equal(r.components.find((c) => c.key === "seo")?.score, 0);
});

test("grade thresholds", () => {
  assert.equal(gradeFromScore(80), "A");
  assert.equal(gradeFromScore(79), "B");
  assert.equal(gradeFromScore(65), "B");
  assert.equal(gradeFromScore(50), "C");
  assert.equal(gradeFromScore(35), "D");
  assert.equal(gradeFromScore(34), "F");
});

test("getDisplayScore: legacy summary keeps the old formula and score", () => {
  const d = getDisplayScore({
    performance_score: 90,
    seo_score: 80,
    mobile_score: 90,
    accessibility_score: 70,
    overall_score: 85,
  });
  assert.equal(d.version, 1);
  assert.equal(d.score, Math.round(90 * 0.4 + 80 * 0.3 + 90 * 0.2 + 70 * 0.1));
  assert.equal(d.components.length, 4);
});

test("getDisplayScore: v2 summary returns the stored breakdown", () => {
  const r = computeOverallScoreV2(full);
  const d = getDisplayScore({
    performance_score: 90,
    seo_score: 100,
    mobile_score: 90,
    accessibility_score: 100,
    overall_score: r.score,
    score_version: SCORE_VERSION,
    overall_score_components: r.components,
    overall_score_formula: r.formula,
  });
  assert.equal(d.version, SCORE_VERSION);
  assert.equal(d.score, r.score);
  assert.equal(d.components.length, 7);
});

test("getDisplayScore: v2 flag without components falls back to legacy", () => {
  const d = getDisplayScore({
    performance_score: 50,
    seo_score: 50,
    mobile_score: 50,
    accessibility_score: 50,
    score_version: SCORE_VERSION,
  });
  assert.equal(d.version, 1);
  assert.equal(d.score, 50);
});
