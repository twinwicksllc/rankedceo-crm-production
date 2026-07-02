// lib/waas/services/keyword-generator/index.ts

import { DEFAULT_LOCATION } from "./types";
import type { KeywordGenerationResult, AiKeywordPlan } from "./types";
import { normalizeTargetUrl, dedupeAndLimit } from "./text-utils";
import { collectSiteSignals } from "./site-scraper";
import {
  computeConfidence,
  fallbackKeywords,
  generateWithGemini,
  generateWithPerplexity,
  parseGeminiKeywords,
  parseAiKeywordPlan,
} from "./ai-providers";

// Test hook for parser behavior; keeps runtime code path unchanged.
export function parseGeminiKeywordsForTest(text: string): string[] {
  return parseGeminiKeywords(text);
}

// Test hook for AI plan JSON parser.
export function parseAiKeywordPlanForTest(text: string): AiKeywordPlan | null {
  return parseAiKeywordPlan(text);
}

export async function generateIndustryKeywordPlan(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  maxKeywords: number = 5,
): Promise<KeywordGenerationResult> {
  const normalizedUrl = normalizeTargetUrl(targetUrl);
  const siteSignals = await collectSiteSignals(normalizedUrl);

  const fallbackLocation =
    location ?? siteSignals.locationHint ?? DEFAULT_LOCATION;
  const fallbackIndustry = industry ?? null;
  const fallback = fallbackKeywords(
    normalizedUrl,
    fallbackIndustry,
    fallbackLocation,
    maxKeywords,
  );

  const geminiPlan = await generateWithGemini(
    siteSignals,
    industry,
    location,
    maxKeywords,
  );
  if (geminiPlan && geminiPlan.keywords.length > 0) {
    const confidence = computeConfidence(siteSignals, "gemini");
    return {
      keywords:
        geminiPlan.keywords.length < maxKeywords
          ? dedupeAndLimit([...geminiPlan.keywords, ...fallback], maxKeywords)
          : geminiPlan.keywords,
      detectedIndustry: geminiPlan.industry ?? fallbackIndustry,
      detectedLocation:
        geminiPlan.location ?? siteSignals.locationHint ?? location,
      detectedAddress: geminiPlan.address ?? siteSignals.addressHint,
      provider: "gemini",
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      confidenceReasons: confidence.reasons,
    };
  }

  const perplexityPlan = await generateWithPerplexity(
    siteSignals,
    industry,
    location,
    maxKeywords,
  );
  if (perplexityPlan && perplexityPlan.keywords.length > 0) {
    const confidence = computeConfidence(siteSignals, "perplexity");
    return {
      keywords:
        perplexityPlan.keywords.length < maxKeywords
          ? dedupeAndLimit(
              [...perplexityPlan.keywords, ...fallback],
              maxKeywords,
            )
          : perplexityPlan.keywords,
      detectedIndustry: perplexityPlan.industry ?? fallbackIndustry,
      detectedLocation:
        perplexityPlan.location ?? siteSignals.locationHint ?? location,
      detectedAddress: perplexityPlan.address ?? siteSignals.addressHint,
      provider: "perplexity",
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      confidenceReasons: confidence.reasons,
    };
  }

  const confidence = computeConfidence(siteSignals, "fallback");
  return {
    keywords: fallback,
    detectedIndustry: fallbackIndustry,
    detectedLocation: siteSignals.locationHint ?? location,
    detectedAddress: siteSignals.addressHint,
    provider: "fallback",
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
    confidenceReasons: confidence.reasons,
  };
}

export async function generateTopIndustryKeywords(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  maxKeywords: number = 5,
): Promise<string[]> {
  const result = await generateIndustryKeywordPlan(
    targetUrl,
    industry,
    location,
    maxKeywords,
  );
  return result.keywords;
}

// Barrel re-exports
export type {
  KeywordGenerationResult,
  SiteSignals,
  AiKeywordPlan,
} from "./types";
export {
  normalizeKeyword,
  dedupeAndLimit,
  normalizeTargetUrl,
  cleanText,
  stripHtml,
  extractTagContent,
  extractMetaDescription,
} from "./text-utils";
export {
  extractInternalLinks,
  extractAddressHint,
  extractLocationHint,
  fetchHtml,
  collectSiteSignals,
} from "./site-scraper";
export {
  computeConfidence,
  fallbackKeywords,
  parseGeminiKeywords,
  parseAiKeywordPlan,
  generateWithGemini,
  generateWithPerplexity,
} from "./ai-providers";
