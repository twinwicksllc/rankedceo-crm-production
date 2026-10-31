/**
 * Audit scoring: the ONLY place the overall score formula lives.
 *
 * v2 (score_version 2) mixes real local-search signals with Lighthouse scores
 * so a site that is fast but invisible in Google does not get a good grade.
 * v3 (score_version 3) adds a Google Business Profile component (A3) and
 * rebalances the weights. Stored v2 and v3 reports are shown exactly as stored.
 * Legacy audits (no score_version) were scored 0.40 performance + 0.30 seo +
 * 0.20 "mobile" + 0.10 accessibility, where "mobile" was a copy of mobile
 * performance. They keep that formula so stored reports do not change.
 */

export type Grade = "A" | "B" | "C" | "D" | "F";

export const SCORE_VERSION = 3;

/** First version whose breakdown is stored in the report and shown as stored. */
const FIRST_STORED_BREAKDOWN_VERSION = 2;

export function gradeFromScore(score: number): Grade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

// ---------------------------------------------------------------------------
// Legacy formula (kept for audits stored before v2)
// ---------------------------------------------------------------------------
export function computeOverallScore(
  performanceScore: number,
  seoScore: number,
  mobileScore: number,
  accessibilityScore: number,
): { score: number; grade: Grade } {
  const weightedTotal =
    performanceScore * 0.4 +
    seoScore * 0.3 +
    mobileScore * 0.2 +
    accessibilityScore * 0.1;
  const score = Math.round(weightedTotal);
  return { score, grade: gradeFromScore(score) };
}

// ---------------------------------------------------------------------------
// v2 building blocks
// ---------------------------------------------------------------------------

// Points for a Google position. Linear between anchors; not ranked = 0.
const POSITION_ANCHORS: Array<[number, number]> = [
  [1, 100],
  [3, 90],
  [10, 60],
  [20, 35],
  [50, 10],
  [100, 0],
];

export function positionToPoints(position: number | null | undefined): number {
  if (position == null || !Number.isFinite(position) || position < 1) return 0;
  const first = POSITION_ANCHORS[0];
  const last = POSITION_ANCHORS[POSITION_ANCHORS.length - 1];
  if (position <= first[0]) return first[1];
  if (position >= last[0]) return last[1];
  for (let i = 1; i < POSITION_ANCHORS.length; i++) {
    const [x1, y1] = POSITION_ANCHORS[i];
    const [x0, y0] = POSITION_ANCHORS[i - 1];
    if (position <= x1) {
      return y0 + ((position - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 0;
}

/**
 * Average points over every keyword requested; keywords where the site is not
 * found count as 0. Returns null (not measured) when there are no results or
 * when fewer keyword searches succeeded than were requested: a failed search
 * is unknown, not "not found", and averaging only the successes would inflate
 * the score during a partial provider outage.
 */
export function searchVisibilityScore(
  positions: Array<number | null>,
  requestedKeywords: number = positions.length,
): number | null {
  if (positions.length === 0 || positions.length < requestedKeywords) {
    return null;
  }
  const total = positions.reduce<number>(
    (sum, p) => sum + positionToPoints(p),
    0,
  );
  return Math.round(total / positions.length);
}

export type ScoreComponentKey =
  | "visibility"
  | "competitive"
  | "local_pack"
  | "gbp"
  | "on_page"
  | "speed"
  | "seo"
  | "accessibility"
  | "best_practices";

const COMPONENTS: Array<{
  key: ScoreComponentKey;
  label: string;
  weight: number;
}> = [
  { key: "visibility", label: "Google search visibility", weight: 0.3 },
  { key: "competitive", label: "Competitive position", weight: 0.15 },
  { key: "local_pack", label: "Google Maps (local pack)", weight: 0.1 },
  // A3: Google Business Profile completeness and NAP consistency, taken from
  // the same /places lookup as the local pack. Not measured when the client's
  // listing is not in the results.
  { key: "gbp", label: "Google Business Profile", weight: 0.1 },
  // A5: real on-page crawl (title/meta/H1/schema/sitemap/...). The PageSpeed
  // "SEO" category is a Lighthouse heuristic that overlaps heavily with the
  // crawl, so it is kept as a small "Lighthouse SEO" component and the crawl
  // takes the larger on-page weight.
  { key: "on_page", label: "On-page SEO", weight: 0.1 },
  { key: "speed", label: "Site speed (mobile)", weight: 0.15 },
  { key: "seo", label: "Lighthouse SEO", weight: 0.04 },
  { key: "accessibility", label: "Accessibility", weight: 0.03 },
  { key: "best_practices", label: "Best practices", weight: 0.03 },
];

export interface ScoreInputs {
  /** Average points of the keyword positions (see searchVisibilityScore). null = no ranking data. */
  visibility: number | null;
  /** 100 minus the gap-analysis opportunity score. null = no competitor ranking data. */
  competitive: number | null;
  /** Points for the Google Maps position. null = local pack not measured. */
  localPack: number | null;
  /** GBP completeness + NAP consistency (0-100). null = listing not found / not measured. */
  gbp: number | null;
  /** Real on-page crawl score (0-100). null = homepage could not be crawled. */
  onPage: number | null;
  /** Lighthouse mobile scores 0-100. null = PageSpeed unavailable. */
  speed: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
}

export interface ScoreComponent {
  key: ScoreComponentKey;
  label: string;
  /** Weight after redistributing the weight of components that were not measured. */
  weight: number;
  score: number | null;
  contribution: number;
  measured: boolean;
}

export interface OverallScoreV2 {
  version: number;
  score: number;
  grade: Grade;
  components: ScoreComponent[];
  /** Labels of components that had no data; their weight was shared by the rest. */
  notMeasured: string[];
  formula: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Weighted score over the components that were actually measured. Weight of
 * missing components is shared proportionally, so a missing signal never
 * silently counts as 0 or as 100. Returns score 0 if nothing was measured.
 */
export function computeOverallScoreV2(inputs: ScoreInputs): OverallScoreV2 {
  const values: Record<ScoreComponentKey, number | null> = {
    visibility: inputs.visibility,
    competitive: inputs.competitive,
    local_pack: inputs.localPack,
    gbp: inputs.gbp,
    on_page: inputs.onPage,
    speed: inputs.speed,
    seo: inputs.seo,
    accessibility: inputs.accessibility,
    best_practices: inputs.bestPractices,
  };

  const measuredWeight = COMPONENTS.reduce(
    (sum, c) => (values[c.key] == null ? sum : sum + c.weight),
    0,
  );

  const components: ScoreComponent[] = COMPONENTS.map((c) => {
    const raw = values[c.key];
    if (raw == null || measuredWeight === 0) {
      return {
        key: c.key,
        label: c.label,
        weight: 0,
        score: null,
        contribution: 0,
        measured: false,
      };
    }
    const weight = c.weight / measuredWeight;
    const score = Math.round(clamp(raw));
    return {
      key: c.key,
      label: c.label,
      weight: Number(weight.toFixed(4)),
      score,
      contribution: Number((score * weight).toFixed(1)),
      measured: true,
    };
  });

  const total = components.reduce(
    (sum, c) => (c.score == null ? sum : sum + c.score * c.weight),
    0,
  );
  const score = Math.round(total);
  const measured = components.filter((c) => c.measured);

  return {
    version: SCORE_VERSION,
    score,
    grade: gradeFromScore(score),
    components,
    notMeasured: components.filter((c) => !c.measured).map((c) => c.label),
    formula: measured
      .map((c) => `${Math.round(c.weight * 100)}% ${c.label}`)
      .join(" + "),
  };
}

// ---------------------------------------------------------------------------
// Reading a stored summary (v2 or legacy) for display
// ---------------------------------------------------------------------------
export interface StoredScoreSummary {
  overall_score?: number;
  performance_score: number;
  seo_score: number;
  mobile_score: number;
  accessibility_score: number;
  score_version?: number;
  overall_score_components?: Array<{
    label: string;
    weight: number;
    score: number | null;
    contribution: number;
    measured?: boolean;
  }>;
  overall_score_formula?: string;
}

export interface DisplayScore {
  version: number;
  score: number;
  grade: Grade;
  formula: string;
  components: Array<{
    label: string;
    weight: number;
    score: number | null;
    contribution: number;
    measured: boolean;
  }>;
  notMeasured: string[];
}

/**
 * Single reader for every screen, PDF and email. v2 audits return what was
 * stored at audit time; legacy audits are recomputed with the old formula.
 */
export function getDisplayScore(summary: StoredScoreSummary): DisplayScore {
  if (
    typeof summary.score_version === "number" &&
    summary.score_version >= FIRST_STORED_BREAKDOWN_VERSION &&
    Array.isArray(summary.overall_score_components) &&
    typeof summary.overall_score === "number"
  ) {
    const components = summary.overall_score_components.map((c) => ({
      label: c.label,
      weight: c.weight,
      score: c.score,
      contribution: c.contribution,
      measured: c.measured ?? c.score != null,
    }));
    const score = Math.round(summary.overall_score);
    return {
      version: summary.score_version,
      score,
      grade: gradeFromScore(score),
      formula: summary.overall_score_formula ?? "",
      components,
      notMeasured: components.filter((c) => !c.measured).map((c) => c.label),
    };
  }

  const legacy: Array<[string, number, number]> = [
    ["Performance", 0.4, summary.performance_score],
    ["SEO", 0.3, summary.seo_score],
    ["Mobile", 0.2, summary.mobile_score],
    ["Accessibility", 0.1, summary.accessibility_score],
  ];
  const { score, grade } = computeOverallScore(
    summary.performance_score,
    summary.seo_score,
    summary.mobile_score,
    summary.accessibility_score,
  );
  return {
    version: 1,
    score,
    grade,
    formula: "0.40*performance + 0.30*seo + 0.20*mobile + 0.10*accessibility",
    components: legacy.map(([label, weight, s]) => ({
      label,
      weight,
      score: s,
      contribution: Number((s * weight).toFixed(1)),
      measured: true,
    })),
    notMeasured: [],
  };
}
