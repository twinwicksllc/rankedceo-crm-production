// =============================================================================
// WaaS Template Recommender — PR #92
// Upgraded to use the full 10-template registry with:
//   • Industry-aware deterministic scoring via INDUSTRY_TEMPLATE_MAP
//   • SEO strategy context passed to Gemini prompt
//   • Aesthetic + mood metadata in recommendation output
//   • Graceful fallback when Gemini is unavailable
// =============================================================================

import type { SiteTemplate, SectionConfig } from "@/lib/waas/templates/types";
import {
  INDUSTRY_TEMPLATE_MAP,
  DEFAULT_INDUSTRY_TEMPLATES,
  getRecommendedTemplateSlugs,
} from "@/lib/waas/templates/registry";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.5-flash";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TemplateRecommendation {
  templateSlug: string;
  label: string;
  rationale: string;
  /** Why this template helps SEO for this specific business */
  seoRationale: string;
  confidence: number;
  highlights: string[];
  /** Aesthetic category for the badge shown on the card */
  aesthetic: string;
  /** Mood tagline for the card subtitle */
  mood: string;
}

interface TenantProfile {
  businessName: string;
  industry: string | null;
  location: string | null;
  usp: string | null;
  financingEnabled: boolean;
  hasBooking: boolean;
  tone: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildHighlights(sections: SectionConfig[]): string[] {
  return sections
    .filter((s) => s.enabled)
    .slice(0, 4)
    .map((s) => s.section);
}

// ---------------------------------------------------------------------------
// Deterministic fallback scoring
// Uses INDUSTRY_TEMPLATE_MAP as the primary signal so the "Recommended for you"
// shortlist always makes sense without an API call.
// ---------------------------------------------------------------------------

function fallbackRecommendations(
  tenant: TenantProfile,
  templates: SiteTemplate[],
): TemplateRecommendation[] {
  const industry = tenant.industry ?? "";
  const recommendedSlugs = getRecommendedTemplateSlugs(industry);

  // Build base score map — recommended slugs get a head-start
  const industryScore: Record<string, number> = {};
  recommendedSlugs.forEach((slug, i) => {
    industryScore[slug] = 90 - i * 6; // 90 / 84 / 78
  });

  const scoreTemplate = (t: SiteTemplate): number => {
    let score = industryScore[t.slug] ?? 60; // non-recommended start at 60

    // Boost by financing signal
    if (
      tenant.financingEnabled &&
      ["bold", "conversion", "consultative", "emergency"].includes(t.slug)
    ) {
      score += 4;
    }

    // Boost by booking signal
    if (
      tenant.hasBooking &&
      ["conversion", "emergency", "modern", "local-pro"].includes(t.slug)
    ) {
      score += 3;
    }

    // Boost by tone
    const tone = (tenant.tone ?? "").toLowerCase();
    if (
      tone.includes("professional") &&
      ["modern", "premium", "consultative"].includes(t.slug)
    )
      score += 3;
    if (
      tone.includes("friendly") &&
      ["community", "local-pro"].includes(t.slug)
    )
      score += 3;
    if (
      tone.includes("urgent") &&
      ["emergency", "bold", "conversion"].includes(t.slug)
    )
      score += 3;

    // USP length signals depth — favour consultative / trust for longer USPs
    const uspLen = (tenant.usp ?? "").length;
    if (
      uspLen > 60 &&
      ["consultative", "trust-first", "premium"].includes(t.slug)
    )
      score += 3;

    return Math.min(97, score);
  };

  // Build SEO rationale per template based on strategy
  const seoRationaleMap: Record<string, string> = {
    modern: `Clean semantic structure with a single H1 and clear service sections helps Google quickly understand your [City] ${industry || "service"} offering.`,
    bold: `Strong H1 with location + trade keyword, combined with a prominent phone CTA, targets high-intent "[City] ${industry || "service"}\" searches.`,
    "trust-first": `Review schema and credential badges directly support Google's E-E-A-T signals, improving visibility for reputation-sensitive searches.`,
    "local-pro": `Location badge, NAP schema, and service-area content drive "[Trade] near me" and "[City] [Trade]" local pack rankings.`,
    premium: `Gallery schema, project captions, and portfolio-structured content support image SEO and "best [trade] [city]" queries.`,
    emergency: `24/7 and emergency keywords in hero H1 and trust bar target high-urgency searches like "emergency ${industry || "service"} [city]" with strong click signals.`,
    showcase: `Image-rich layout with structured captions and gallery schema unlocks image search traffic and "before/after [trade]" queries.`,
    consultative: `FAQ schema markup, How It Works H2s, and process content can earn rich results and "how much does [service] cost" featured snippets.`,
    community: `Owner name + personal story content builds local E-E-A-T; FAQ section targets neighbourhood-level long-tail queries.`,
    conversion: `Offer-keyword rich meta prompts, booking schema, and financing content target "cheap [service] [city]" and coupon-intent searches.`,
  };

  return templates
    .map((t) => ({
      templateSlug: t.slug,
      label: t.name,
      rationale: `${t.name} is a strong match for ${industry || "service"} businesses: ${(t as { mood?: string }).mood ?? ""}.`,
      seoRationale:
        seoRationaleMap[t.slug] ??
        `${t.name} is optimised for ${(t as { seo_strategy?: string }).seo_strategy ?? "local service"} SEO.`,
      confidence: scoreTemplate(t),
      highlights: buildHighlights(t.default_layout_json),
      aesthetic: (t as { aesthetic?: string }).aesthetic ?? "",
      mood: (t as { mood?: string }).mood ?? "",
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// Sanitise raw Gemini output into typed recommendations
// ---------------------------------------------------------------------------

function sanitizeRecommendations(
  raw: unknown,
  templates: SiteTemplate[],
  tenant: TenantProfile,
): TemplateRecommendation[] {
  if (!Array.isArray(raw)) return [];

  const templateBySlug = new Map(templates.map((t) => [t.slug, t]));
  const out: TemplateRecommendation[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const templateSlug =
      typeof rec.templateSlug === "string" ? rec.templateSlug : "";
    const template = templateBySlug.get(templateSlug);
    if (!template) continue;

    const label =
      typeof rec.label === "string" && rec.label.trim()
        ? rec.label.trim()
        : template.name;

    const rationale =
      typeof rec.rationale === "string" && rec.rationale.trim()
        ? rec.rationale.trim()
        : `${template.name} is a strong fit for this business profile.`;

    const seoRationale =
      typeof rec.seoRationale === "string" && rec.seoRationale.trim()
        ? rec.seoRationale.trim()
        : `${template.name} is optimised for ${(template as { seo_strategy?: string }).seo_strategy ?? "local service"} SEO.`;

    const confidenceRaw =
      typeof rec.confidence === "number" ? rec.confidence : 75;
    const confidence = Math.max(50, Math.min(99, Math.round(confidenceRaw)));

    const highlightsRaw = Array.isArray(rec.highlights) ? rec.highlights : [];
    const highlights = highlightsRaw
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, 5);

    out.push({
      templateSlug,
      label,
      rationale,
      seoRationale,
      confidence,
      highlights:
        highlights.length > 0
          ? highlights
          : buildHighlights(template.default_layout_json),
      aesthetic: (template as { aesthetic?: string }).aesthetic ?? "",
      mood: (template as { mood?: string }).mood ?? "",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// recommendTemplates — main export
//
// Returns exactly 3 recommendations sorted by confidence.
// Uses Gemini when the API key is available; deterministic fallback otherwise.
// Always returns the same 3 that INDUSTRY_TEMPLATE_MAP would suggest unless
// Gemini has a compelling reason to override (it often confirms the map).
// ---------------------------------------------------------------------------

export async function recommendTemplates(
  tenant: TenantProfile,
  templates: SiteTemplate[],
): Promise<TemplateRecommendation[]> {
  const fallback = fallbackRecommendations(tenant, templates);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return fallback.slice(0, 3);

  // Build allowed slugs from the recommended industry map + a couple extras
  // so Gemini has some choice but is guided toward the right 3.
  const recSlugs = getRecommendedTemplateSlugs(tenant.industry);
  const allowedSet = new Set([
    ...recSlugs,
    ...fallback.slice(0, 5).map((r) => r.templateSlug),
  ]);
  const allowed = templates.filter((t) => allowedSet.has(t.slug));

  const templateDescriptions = allowed
    .map((t) =>
      [
        `  slug: ${t.slug}`,
        `  name: ${t.name}`,
        `  mood: ${(t as { mood?: string }).mood ?? ""}`,
        `  seo_strategy: ${(t as { seo_strategy?: string }).seo_strategy ?? ""}`,
        `  industry_fit: ${(t as { industry_fit?: string[] }).industry_fit?.join(", ") ?? ""}`,
        `  feature_highlights: ${(t as { feature_highlights?: string[] }).feature_highlights?.join(" | ") ?? ""}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = [
    "You are a website template expert for a local trades/service business platform.",
    "Your job is to select the BEST 3 templates for this specific business.",
    "Consider both visual/brand fit AND search engine optimisation benefits.",
    "Return JSON only — an array of exactly 3 objects with keys:",
    "  templateSlug, label, rationale, seoRationale, confidence, highlights",
    `Allowed templateSlug values: ${allowed.map((t) => t.slug).join(", ")}`,
    "confidence must be 50–99 (integer).",
    "highlights: array of 3–4 short strings describing key layout features.",
    "seoRationale: 1–2 sentences on why this template helps SEO for THIS specific business.",
    "",
    "=== Business Profile ===",
    `Business name: ${tenant.businessName}`,
    `Industry/Trade: ${tenant.industry ?? "unknown"}`,
    `Location: ${tenant.location ?? "unknown"}`,
    `USP: ${tenant.usp ?? "none provided"}`,
    `Financing enabled: ${tenant.financingEnabled}`,
    `Has booking URL: ${tenant.hasBooking}`,
    `Tone preference: ${tenant.tone ?? "not set"}`,
    "",
    "=== Available Templates ===",
    templateDescriptions,
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
            temperature: 0.3,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(8000), // 8 s timeout — must not block onboarding step
      },
    );

    if (!response.ok) return fallback.slice(0, 3);

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) return fallback.slice(0, 3);

    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    const cleaned = sanitizeRecommendations(parsed, templates, tenant);
    if (cleaned.length === 0) return fallback.slice(0, 3);

    // Always return exactly 3 — Gemini output first, filled with fallback if short
    const used = new Set(cleaned.map((r) => r.templateSlug));
    const missing = fallback.filter((r) => !used.has(r.templateSlug));

    return [...cleaned, ...missing].slice(0, 3);
  } catch {
    return fallback.slice(0, 3);
  }
}

// ---------------------------------------------------------------------------
// getIndustryTemplateMap
// Exported so Step 4 can directly read the map without calling Gemini.
// ---------------------------------------------------------------------------

export { INDUSTRY_TEMPLATE_MAP, DEFAULT_INDUSTRY_TEMPLATES };
