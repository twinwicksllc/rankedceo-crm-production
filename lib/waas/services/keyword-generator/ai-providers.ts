// lib/waas/services/keyword-generator/ai-providers.ts

import { generateKeywords } from "../serper";
import { GEMINI_API_BASE, GEMINI_MODEL, DEFAULT_LOCATION } from "./types";
import type { SiteSignals, AiKeywordPlan } from "./types";
import { normalizeKeyword, dedupeAndLimit } from "./text-utils";

export function computeConfidence(
  signals: SiteSignals,
  provider: "gemini" | "perplexity" | "fallback",
): {
  score: number;
  label: "high" | "medium" | "low";
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  if (signals.fetchedPages >= 1) {
    score += 20;
    reasons.push("Website content fetched successfully");
  }

  if (signals.fetchedPages >= 2) {
    score += 12;
    reasons.push("Multiple internal pages analyzed");
  }

  if (signals.textSnippet.length >= 600) {
    score += 18;
    reasons.push("Sufficient on-site text evidence collected");
  } else if (signals.textSnippet.length >= 200) {
    score += 8;
    reasons.push("Limited on-site text evidence collected");
  }

  if (signals.titleHints.length > 0) {
    score += 10;
    reasons.push("Title/meta business hints detected");
  }

  if (signals.locationHint) {
    score += 18;
    reasons.push("Location signal found on site");
  }

  if (signals.addressHint) {
    score += 22;
    reasons.push("Street address signal found on site");
  }

  if (provider === "gemini") {
    score += 10;
    reasons.push("Gemini generated structured keyword plan");
  } else if (provider === "perplexity") {
    score += 8;
    reasons.push("Perplexity generated structured keyword plan");
  } else {
    reasons.push("Fallback keyword strategy used");
  }

  const bounded = Math.max(10, Math.min(99, score));
  const label: "high" | "medium" | "low" =
    bounded >= 75 ? "high" : bounded >= 50 ? "medium" : "low";

  return {
    score: bounded,
    label,
    reasons,
  };
}

export function fallbackKeywords(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  max: number,
): string[] {
  const seed = generateKeywords(targetUrl, industry, location);
  const city = (location ?? DEFAULT_LOCATION).split(",")[0]?.trim() || "local";

  const extras = [
    `${industry ?? "local business"} near me ${city}`,
    `${industry ?? "service"} ${city} reviews`,
    `${industry ?? "service"} ${city}`,
  ];

  return dedupeAndLimit([...seed, ...extras], max);
}

export function parseGeminiKeywords(text: string): string[] {
  const cleaned = text.trim().replace(/```json\n?|\n?```/g, "");

  try {
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }

    if (parsed && Array.isArray(parsed.keywords)) {
      return parsed.keywords.filter(
        (v: unknown): v is string => typeof v === "string",
      );
    }
  } catch {
    return [];
  }

  return [];
}

export function parseAiKeywordPlan(text: string): AiKeywordPlan | null {
  const cleaned = text.trim().replace(/```json\n?|\n?```/g, "");

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;

    const keywordsRaw = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    const keywords = keywordsRaw.filter(
      (value): value is string => typeof value === "string",
    );

    return {
      industry:
        typeof parsed.industry === "string" && parsed.industry.trim().length > 0
          ? parsed.industry.trim()
          : null,
      location:
        typeof parsed.location === "string" && parsed.location.trim().length > 0
          ? parsed.location.trim()
          : null,
      address:
        typeof parsed.address === "string" && parsed.address.trim().length > 0
          ? parsed.address.trim()
          : null,
      keywords,
    };
  } catch {
    return null;
  }
}

export async function generateWithGemini(
  signals: SiteSignals,
  industry: string | null,
  location: string | null,
  maxKeywords: number,
): Promise<AiKeywordPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    "Analyze this business website context and produce realistic local SEO keywords.",
    "Use website evidence first (title, services, address/location clues).",
    "Return ONLY valid JSON with this exact shape:",
    '{"industry":"string|null","location":"City, ST or null","address":"full address or null","keywords":["... exactly 5 strings ..."]}',
    "Keyword rules:",
    "- high-intent service keywords that a real buyer would search",
    "- include geographic intent tied to detected city/market",
    "- avoid generic filler and avoid the business name unless clearly transactional",
    "- each keyword must be 2-7 words",
    "",
    `Domain: ${signals.domain}`,
    `Homepage: ${signals.homepageUrl}`,
    `Provided industry hint: ${industry ?? "none"}`,
    `Provided location hint: ${location ?? "none"}`,
    `Detected address hint: ${signals.addressHint ?? "none"}`,
    `Detected location hint: ${signals.locationHint ?? "none"}`,
    `Title/meta hints: ${signals.titleHints.join(" | ") || "none"}`,
    `Website text excerpt: ${signals.textSnippet || "none"}`,
  ].join("\n");

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || text.trim().length === 0) return null;

    const parsed = parseAiKeywordPlan(text);
    if (!parsed) return null;

    return {
      ...parsed,
      keywords: dedupeAndLimit(parsed.keywords, maxKeywords),
    };
  } catch {
    return null;
  }
}

export async function generateWithPerplexity(
  signals: SiteSignals,
  industry: string | null,
  location: string | null,
  maxKeywords: number,
): Promise<AiKeywordPlan | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    "Use the provided website content to infer business type and local market.",
    "Return JSON only with keys industry, location, address, keywords.",
    "keywords must contain exactly 5 realistic local SEO queries.",
    "",
    `Domain: ${signals.domain}`,
    `Provided industry hint: ${industry ?? "none"}`,
    `Provided location hint: ${location ?? "none"}`,
    `Detected address hint: ${signals.addressHint ?? "none"}`,
    `Detected location hint: ${signals.locationHint ?? "none"}`,
    `Site excerpt: ${signals.textSnippet || "none"}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a local SEO strategist. Output strict JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) return null;

    const parsed = parseAiKeywordPlan(text);
    if (!parsed) return null;

    return {
      ...parsed,
      keywords: dedupeAndLimit(parsed.keywords, maxKeywords),
    };
  } catch {
    return null;
  }
}
