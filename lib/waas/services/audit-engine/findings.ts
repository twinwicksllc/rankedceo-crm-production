// Pure helpers for audit "opportunities" (A8): one impact vocabulary, an
// effort estimate, a ranking, and readable labels. Type-only imports, so the
// engine, the report page (client), the PDF route and the onboarding pre-fill
// can all use it.
import type { AuditOpportunity, AuditOpportunityImpact } from "../../types";

export type AuditOpportunityEffort = "low" | "medium" | "high";

/**
 * Per-source caps, kept from before ranking existed so that one source (for
 * example PageSpeed) cannot crowd the others out. 3 + 2 + 3 = 8, which is also
 * how many the PDF shows.
 */
export const MAX_MISSING_KEYWORD_OPPORTUNITIES = 3;
export const MAX_SPEED_OPPORTUNITIES = 2;
export const MAX_ON_PAGE_OPPORTUNITIES = 3;

/**
 * The engine mixes two severity vocabularies: critical/warning/info (PageSpeed,
 * on-page severity, gap analysis) and high/medium/low (on-page impact, which is
 * what the report UI renders). Everything is mapped to high/medium/low here.
 * Anything unrecognised is "low". Audits stored before this fix hold
 * critical/warning/info in `estimated_impact`, so readers call this too.
 */
export function normalizeImpact(value: unknown): AuditOpportunityImpact {
  switch (value) {
    case "high":
    case "critical":
      return "high";
    case "medium":
    case "warning":
      return "medium";
    default:
      return "low";
  }
}

// Effort is an estimate made from what the fix involves, not a measurement.
const LOW_EFFORT_IDS = new Set([
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
]);
const HIGH_EFFORT_IDS = new Set([
  "on_page_no_service_pages",
  "on_page_no_location_pages",
]);

/**
 * Effort to fix, by finding id. A tag or a setting is low; schema, copy and
 * several pages are medium; new pages are high. PageSpeed ids (images,
 * scripts, hosting) are high because they usually need a developer. Other
 * on-page ids and missing keywords default to medium.
 */
export function effortForType(type: string): AuditOpportunityEffort {
  if (LOW_EFFORT_IDS.has(type)) return "low";
  if (HIGH_EFFORT_IDS.has(type)) return "high";
  if (type === "missing_keyword" || type.startsWith("on_page_")) {
    return "medium";
  }
  return "high";
}

export const EFFORT_LABEL: Record<AuditOpportunityEffort, string> = {
  low: "Quick fix",
  medium: "Some work",
  high: "Bigger project",
};

const IMPACT_ORDER: Record<AuditOpportunityImpact, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const EFFORT_ORDER: Record<AuditOpportunityEffort, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Highest impact first; within the same impact, least effort first (quick
 * wins); ties keep their original order. Returns new objects with a
 * normalised `estimated_impact` and an `effort`; the input is not changed.
 */
export function rankOpportunities<T extends AuditOpportunity>(
  items: readonly T[],
): Array<T & { effort: AuditOpportunityEffort }> {
  return items
    .map((item, index) => ({
      item: {
        ...item,
        estimated_impact: normalizeImpact(item.estimated_impact),
        effort: effortForType(item.type),
      },
      index,
    }))
    .sort(
      (a, b) =>
        IMPACT_ORDER[a.item.estimated_impact] -
          IMPACT_ORDER[b.item.estimated_impact] ||
        EFFORT_ORDER[a.item.effort] - EFFORT_ORDER[b.item.effort] ||
        a.index - b.index,
    )
    .map((entry) => entry.item);
}

export interface OpportunityInputs {
  missingKeywords: ReadonlyArray<{ description: string; impact: string }>;
  speed: ReadonlyArray<{
    id: string;
    title: string;
    savings_ms: number;
    impact: string;
  }>;
  onPage: ReadonlyArray<{
    id: string;
    title: string;
    fix: string;
    severity: string;
    impact: string;
  }>;
}

/**
 * Takes the first N of each source (callers pass them best-first), pools them,
 * and ranks the pool by impact then effort. On-page "info" findings are not
 * opportunities.
 */
export function buildOpportunities(
  input: OpportunityInputs,
): Array<AuditOpportunity & { effort: AuditOpportunityEffort }> {
  const pool: AuditOpportunity[] = [
    ...input.missingKeywords
      .slice(0, MAX_MISSING_KEYWORD_OPPORTUNITIES)
      .map((g) => ({
      type: "missing_keyword",
      description: g.description,
      estimated_impact: normalizeImpact(g.impact),
    })),
    ...input.speed.slice(0, MAX_SPEED_OPPORTUNITIES).map((o) => ({
      type: o.id,
      description: `${o.title} (saves ~${Math.round(o.savings_ms / 100) / 10}s)`,
      estimated_impact: normalizeImpact(o.impact),
    })),
    ...input.onPage
      .filter((f) => f.severity !== "info")
      .slice(0, MAX_ON_PAGE_OPPORTUNITIES)
      .map((f) => ({
        type: f.id,
        description: `${f.title}. ${f.fix}`,
        estimated_impact: normalizeImpact(f.impact),
      })),
  ];
  return rankOpportunities(pool);
}

/**
 * The onboarding tagline suggestion built from the top high-impact
 * opportunities, or null when there are none. Reads the top two after ranking,
 * so stored audits with the old impact vocabulary work too.
 */
export function taglineFromOpportunities(
  opportunities: readonly AuditOpportunity[] | null | undefined,
): string | null {
  if (!Array.isArray(opportunities)) return null;
  const phrases = rankOpportunities(opportunities)
    .slice(0, 2)
    .filter((o) => o.type && o.estimated_impact === "high")
    .map((o) => humanizeFindingType(o.type));
  if (phrases.length === 0) return null;
  return `Improving ${phrases.join(" and ").toLowerCase()} for better performance.`;
}

/** "on_page_missing_title" -> "missing title"; for text shown to people. */
export function humanizeFindingType(type: string): string {
  return type
    .replace(/^on_page_/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}
