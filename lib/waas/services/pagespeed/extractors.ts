// lib/waas/services/pagespeed/extractors.ts
import {
  PageSpeedMetrics,
  PageSpeedCategoryScores,
  PageSpeedOpportunity,
  PageSpeedDiagnostic,
  PageSpeedDataError,
  REQUIRED_CATEGORIES,
} from "./types";

// ----------------------------------------------------------------------------
// Convert 0-1 score to letter grade
// ----------------------------------------------------------------------------
export function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// ----------------------------------------------------------------------------
// Extract metrics from PageSpeed API response
// ----------------------------------------------------------------------------
export function extractMetrics(
  lighthouseResult: Record<string, any>,
): PageSpeedMetrics {
  const audits = lighthouseResult?.audits ?? {};

  return {
    lcp: Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0),
    fid: Math.round(audits["total-blocking-time"]?.numericValue ?? 0),
    cls: parseFloat(
      (audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3),
    ),
    ttfb: Math.round(audits["server-response-time"]?.numericValue ?? 0),
    fcp: Math.round(audits["first-contentful-paint"]?.numericValue ?? 0),
    si: Math.round(audits["speed-index"]?.numericValue ?? 0),
    tbt: Math.round(audits["total-blocking-time"]?.numericValue ?? 0),
  };
}

// ----------------------------------------------------------------------------
// Extract category scores
// ----------------------------------------------------------------------------
export function extractCategoryScores(
  lighthouseResult: Record<string, any>,
  strategy: "mobile" | "desktop",
): PageSpeedCategoryScores {
  const cats = lighthouseResult?.categories ?? {};

  const scores: Record<(typeof REQUIRED_CATEGORIES)[number], number> = {
    performance: 0,
    seo: 0,
    accessibility: 0,
    "best-practices": 0,
  };

  for (const category of REQUIRED_CATEGORIES) {
    const rawScore = cats?.[category]?.score;

    if (rawScore === null || rawScore === undefined) {
      throw new PageSpeedDataError(
        `[PageSpeed] ${strategy} response missing category score for "${category}".`,
      );
    }

    if (typeof rawScore !== "number" || Number.isNaN(rawScore)) {
      throw new PageSpeedDataError(
        `[PageSpeed] ${strategy} response has invalid category score for "${category}": ${String(rawScore)}`,
      );
    }

    scores[category] = Math.round(rawScore * 100);
  }

  const perf = scores.performance;
  const seo = scores.seo;
  const a11y = scores.accessibility;
  const bp = scores["best-practices"];

  return {
    performance: { score: perf, grade: scoreToGrade(perf) },
    seo: { score: seo, grade: scoreToGrade(seo) },
    accessibility: { score: a11y, grade: scoreToGrade(a11y) },
    bestPractices: { score: bp, grade: scoreToGrade(bp) },
  };
}

// ----------------------------------------------------------------------------
// Extract improvement opportunities
// ----------------------------------------------------------------------------
export function extractOpportunities(
  lighthouseResult: Record<string, any>,
): PageSpeedOpportunity[] {
  const audits = lighthouseResult?.audits ?? {};
  const opportunities: PageSpeedOpportunity[] = [];

  const opportunityIds = [
    "render-blocking-resources",
    "unused-css-rules",
    "unused-javascript",
    "uses-optimized-images",
    "uses-webp-images",
    "uses-text-compression",
    "uses-long-cache-ttl",
    "efficient-animated-content",
  ];

  for (const id of opportunityIds) {
    const audit = audits[id];
    if (!audit || audit.score === 1) continue;

    const savings = audit.details?.overallSavingsMs ?? 0;

    opportunities.push({
      id,
      title: audit.title ?? id,
      description: audit.description ?? "",
      savings_ms: Math.round(savings),
      impact: savings > 1000 ? "critical" : savings > 300 ? "warning" : "info",
    });
  }

  return opportunities.sort((a, b) => b.savings_ms - a.savings_ms).slice(0, 5);
}

// ----------------------------------------------------------------------------
// Extract SEO diagnostics
// ----------------------------------------------------------------------------
export function extractDiagnostics(
  lighthouseResult: Record<string, any>,
): PageSpeedDiagnostic[] {
  const audits = lighthouseResult?.audits ?? {};
  const diagnosticIds = [
    "document-title",
    "meta-description",
    "http-status-code",
    "link-text",
    "crawlable-anchors",
    "is-crawlable",
    "robots-txt",
    "image-alt",
    "hreflang",
    "canonical",
    "structured-data",
  ];

  return diagnosticIds
    .filter((id) => audits[id])
    .map((id) => ({
      id,
      title: audits[id].title ?? id,
      description: audits[id].description ?? "",
      score:
        audits[id].score !== null
          ? Math.round((audits[id].score ?? 0) * 100)
          : null,
    }))
    .filter((d) => d.score !== null && d.score < 100)
    .slice(0, 8);
}
