// lib/waas/services/pagespeed/index.ts
import { PageSpeedReport, PageSpeedDataError } from "./types";
import {
  extractMetrics,
  extractCategoryScores,
  extractOpportunities,
  extractDiagnostics,
  scoreToGrade,
} from "./extractors";
import { fetchPageSpeed } from "./api-client";

// ----------------------------------------------------------------------------
// Main: Run full PageSpeed audit (mobile + desktop)
// ----------------------------------------------------------------------------
export async function runPageSpeedAudit(
  url: string,
): Promise<PageSpeedReport | null> {
  // Run mobile and desktop in parallel
  const [mobileResult, desktopResult] = await Promise.all([
    fetchPageSpeed(url, "mobile"),
    fetchPageSpeed(url, "desktop"),
  ]);

  const mobileData = mobileResult.data;
  const desktopData = desktopResult.data;

  if (!mobileData && !desktopData) {
    throw new PageSpeedDataError(
      `Both PageSpeed strategies failed. mobile=${mobileResult.error?.reason ?? "unknown"} desktop=${desktopResult.error?.reason ?? "unknown"}`,
    );
  }

  // We use mobile categories as the primary SEO/UX signal in report summaries.
  // If mobile is unavailable, we still cannot produce stable summary fields.
  if (!mobileData) return null;

  const desktopTimedOut = desktopResult.error?.reason === "timeout";
  if (!desktopData && desktopTimedOut) {
    console.warn(
      "[PageSpeed] Desktop strategy timed out; using mobile metrics/categories as fallback for desktop.",
    );
  } else if (!desktopData) {
    console.warn(
      "[PageSpeed] Desktop strategy unavailable; using mobile-only fallback for desktop metrics.",
    );
  }

  const mobileLH = mobileData?.lighthouseResult ?? {};
  const desktopLH = desktopData?.lighthouseResult ?? mobileLH;

  const mobileMetrics = extractMetrics(mobileLH);
  const desktopMetrics = extractMetrics(desktopLH);

  const mobileCats = extractCategoryScores(mobileLH, "mobile");
  const desktopCats = extractCategoryScores(desktopLH, "desktop");

  const opportunities = extractOpportunities(mobileLH);
  const diagnostics = extractDiagnostics(mobileLH);

  // Overall score = weighted avg (mobile performance counts more for local biz)
  const overallScore = Math.round(
    mobileCats.performance.score * 0.35 +
      mobileCats.seo.score * 0.3 +
      desktopCats.performance.score * 0.2 +
      mobileCats.accessibility.score * 0.15,
  );

  return {
    url,
    mobile: { ...mobileMetrics, categoryScores: mobileCats },
    desktop: { ...desktopMetrics, categoryScores: desktopCats },
    overallScore,
    grade: scoreToGrade(overallScore),
    opportunities,
    diagnostics,
    fetchedAt: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// MOCK: Realistic data for dev/testing (no API key needed)
// ----------------------------------------------------------------------------
export function getMockPageSpeedReport(url: string): PageSpeedReport {
  // Mock poor scores for the prospect (that's the point — show them they need help)
  const mobilePerf = Math.floor(Math.random() * 25) + 20; // 20-45 (poor)
  const mobileSeo = Math.floor(Math.random() * 20) + 35; // 35-55 (mediocre)
  const desktopPerf = Math.floor(Math.random() * 20) + 45; // 45-65 (average)
  const overallScore = Math.round(
    mobilePerf * 0.35 + mobileSeo * 0.3 + desktopPerf * 0.2 + 50 * 0.15,
  );

  return {
    url,
    mobile: {
      lcp: 4200 + Math.random() * 2000,
      fid: 380 + Math.random() * 200,
      cls: 0.18 + Math.random() * 0.15,
      ttfb: 820 + Math.random() * 400,
      fcp: 3100 + Math.random() * 1000,
      si: 5200 + Math.random() * 2000,
      tbt: 650 + Math.random() * 300,
      categoryScores: {
        performance: { score: mobilePerf, grade: scoreToGrade(mobilePerf) },
        seo: { score: mobileSeo, grade: scoreToGrade(mobileSeo) },
        accessibility: { score: 62, grade: "C" },
        bestPractices: { score: 58, grade: "C" },
      },
    },
    desktop: {
      lcp: 2100 + Math.random() * 1000,
      fid: 120 + Math.random() * 100,
      cls: 0.08 + Math.random() * 0.08,
      ttfb: 420 + Math.random() * 200,
      fcp: 1800 + Math.random() * 600,
      si: 3200 + Math.random() * 1000,
      tbt: 280 + Math.random() * 150,
      categoryScores: {
        performance: { score: desktopPerf, grade: scoreToGrade(desktopPerf) },
        seo: { score: mobileSeo + 8, grade: scoreToGrade(mobileSeo + 8) },
        accessibility: { score: 68, grade: "C" },
        bestPractices: { score: 65, grade: "C" },
      },
    },
    overallScore,
    grade: scoreToGrade(overallScore),
    opportunities: [
      {
        id: "unused-javascript",
        title: "Remove Unused JavaScript",
        description:
          "Reduce unused JS to decrease bytes consumed by network activity.",
        savings_ms: 1840,
        impact: "critical",
      },
      {
        id: "render-blocking-resources",
        title: "Eliminate Render-Blocking Resources",
        description: "Resources are blocking the first paint of your page.",
        savings_ms: 1230,
        impact: "critical",
      },
      {
        id: "uses-optimized-images",
        title: "Efficiently Encode Images",
        description:
          "Optimized images load faster and consume less cellular data.",
        savings_ms: 890,
        impact: "warning",
      },
      {
        id: "uses-text-compression",
        title: "Enable Text Compression",
        description: "Text-based resources should be served with compression.",
        savings_ms: 420,
        impact: "warning",
      },
      {
        id: "uses-webp-images",
        title: "Serve Images in Next-Gen Formats",
        description:
          "WebP and AVIF provide better compression than PNG or JPEG.",
        savings_ms: 310,
        impact: "info",
      },
    ],
    diagnostics: [
      {
        id: "meta-description",
        title: "Document does not have a meta description",
        description: "Meta descriptions may be included in search results.",
        score: 0,
      },
      {
        id: "structured-data",
        title: "Structured data is not valid",
        description: "Run validation for structured data errors.",
        score: 0,
      },
      {
        id: "image-alt",
        title: "Image elements do not have alt attributes",
        description:
          "Informative elements should aim for short, descriptive alt text.",
        score: 0,
      },
    ],
    fetchedAt: new Date().toISOString(),
  };
}

// Barrel re-exports — public API surface
export type {
  PageSpeedMetrics,
  PageSpeedCategoryScore,
  PageSpeedReport,
  PageSpeedCategoryScores,
  PageSpeedOpportunity,
  PageSpeedDiagnostic,
} from "./types";
export { PageSpeedDataError } from "./types";
export {
  scoreToGrade,
  extractMetrics,
  extractCategoryScores,
  extractOpportunities,
  extractDiagnostics,
} from "./extractors";
export { sleep, isTimeoutError, fetchPageSpeed } from "./api-client";
