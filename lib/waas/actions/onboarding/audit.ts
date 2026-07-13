"use server";

import type { AuditReportData } from "@/lib/waas/types";
import { getRawClient } from "./_shared";

// ---------------------------------------------------------------------------
// Audit Data Extraction Helper
// Fetches audit and pre-fills brand_config with keywords, competitors, etc.
// ---------------------------------------------------------------------------

/**
 * Step 1 pre-fill data derived from audit.
 * All fields are optional and flagged as "From your audit" suggestions.
 * Users always see these as editable pre-fills, never auto-submitted.
 */
export interface AuditPreFillData {
  business_name_guess?: string | null;
  services_list?: string[] | null;
  suggested_tagline?: string | null;
  city_guess?: string | null;
  state_guess?: string | null;
}

/**
 * Extract location parts from a string like "New York, NY" or "Chicago, Illinois"
 */
function parseLocationString(location: string | null | undefined): {
  city: string | null;
  state: string | null;
} {
  if (!location) return { city: null, state: null };

  const parts = location.split(",").map((p) => p.trim());
  if (parts.length === 2) {
    return { city: parts[0] || null, state: parts[1] || null };
  }
  if (parts.length === 1) {
    // Might be just a city or just a state — return as city
    return { city: parts[0] || null, state: null };
  }
  return { city: null, state: null };
}

/**
 * Guess business name from audit metadata.
 * Derives from: keyword patterns, industry, or confidence hints.
 */
function guessBusinessName(report: AuditReportData): string | null {
  // If we have keywords, try to extract business name clues from them
  if (
    report.rankings &&
    Array.isArray(report.rankings) &&
    report.rankings.length > 0
  ) {
    // Look for keywords that might include a business type or pattern
    // e.g., "ACME Plumbing Chicago" might suggest "ACME" as business
    const firstKeyword = report.rankings[0]?.keyword || "";

    // Simple heuristic: capitalize first major word(s)
    // This is a guess; user will always override
    const words = firstKeyword.split(" ");
    if (words.length > 1) {
      // Assume first word(s) before location/service words are business name
      // Return joined first 1-2 words as guess
      const guess = words.slice(0, 1).join(" ");
      if (guess.length >= 2 && guess.length <= 50) {
        return guess;
      }
    }
  }

  // Fallback: try detected industry from provider_meta
  if (report.provider_meta?.keyword_detected_industry) {
    return null; // Industry alone is not a business name, skip
  }

  return null;
}

/**
 * Extract services list from audit keywords and opportunities.
 */
function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .map((part) =>
      part.length <= 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function normalizeServicePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s&/+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanKeywordToServicePhrase(
  keyword: string,
  locationWords: Set<string>,
): string | null {
  if (!keyword) return null;

  let cleaned = normalizeServicePhrase(keyword)
    // Strip common local SEO fillers while keeping core service phrases.
    .replace(/\b(near me|in my area|in the area|company|companies|contractor|contractors|services|service|best|top|local|quote|quotes|cost|pricing|price)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  const parts = cleaned
    .split(" ")
    .filter((part) => part.length > 0 && !locationWords.has(part));

  if (parts.length === 0) return null;

  cleaned = parts.join(" ").trim();
  if (!cleaned) return null;

  // Keep realistic service phrase lengths (1-5 words).
  if (parts.length > 5) {
    cleaned = parts.slice(0, 5).join(" ");
  }

  return cleaned;
}

function extractServicesList(report: AuditReportData): string[] | null {
  const services = new Set<string>();

  const detectedLocation = report.provider_meta?.keyword_detected_location;
  const locationWords = new Set(
    normalizeServicePhrase(detectedLocation ?? "")
      .split(" ")
      .filter((w) => w.length > 1),
  );

  // Prefer full keyword phrases so input like
  // "web design, ai development" stays phrase-level in prefill.
  if (report.rankings && Array.isArray(report.rankings)) {
    report.rankings.slice(0, 8).forEach((r) => {
      const phrase = cleanKeywordToServicePhrase(r.keyword ?? "", locationWords);
      if (phrase) {
        services.add(phrase);
      }
    });
  }

  // Secondary source when rankings are sparse.
  if (services.size === 0 && report.opportunities && Array.isArray(report.opportunities)) {
    report.opportunities.slice(0, 4).forEach((opp) => {
      const phrase = cleanKeywordToServicePhrase(
        `${opp.type ?? ""} ${opp.description ?? ""}`,
        locationWords,
      );
      if (phrase) {
        services.add(phrase);
      }
    });
  }

  if (services.size === 0) return null;

  return Array.from(services)
    .slice(0, 6)
    .map((service) => titleCaseWords(service));
}

/**
 * Suggest a tagline based on audit opportunities and scores.
 */
function suggestTagline(report: AuditReportData): string | null {
  // Build tagline from top opportunities and performance summary
  if (!report.summary) return null;

  const opportunities: string[] = [];

  if (report.opportunities && Array.isArray(report.opportunities)) {
    report.opportunities.slice(0, 2).forEach((opp) => {
      if (opp.type && opp.estimated_impact === "high") {
        opportunities.push(opp.type);
      }
    });
  }

  // If we have high-impact opportunities, suggest improving them
  if (opportunities.length > 0) {
    return `Improving ${opportunities.join(" and ").toLowerCase()} for better performance.`;
  }

  // Fallback: generic tagline based on overall score
  if (report.summary.overall_score && report.summary.overall_score < 70) {
    return "Your complete digital transformation partner.";
  }

  return null;
}

export async function extractAuditDataForPreFill(
  auditId: string | null | undefined,
): Promise<{ audit_enhancements: Record<string, unknown> | null }> {
  if (!auditId) return { audit_enhancements: null };

  try {
    const supabase = getRawClient();
    const { data: audit } = await supabase
      .from("audits")
      .select("report_data")
      .eq("id", auditId)
      .single();

    if (!audit) return { audit_enhancements: null };

    const report = (audit as { report_data: unknown } | null)
      ?.report_data as AuditReportData | null;
    if (!report) return { audit_enhancements: null };

    const enhancements: Record<string, unknown> = {};

    // Extract keywords from rankings
    if (
      report.rankings &&
      Array.isArray(report.rankings) &&
      report.rankings.length > 0
    ) {
      const keywords = report.rankings.slice(0, 5).map((r) => r.keyword);
      enhancements.keywords_from_audit = keywords;
    }

    // Extract location and industry from provider_meta
    if (report.provider_meta) {
      if (report.provider_meta.keyword_detected_location) {
        enhancements.detected_location =
          report.provider_meta.keyword_detected_location;
      }
      if (report.provider_meta.keyword_detected_industry) {
        enhancements.detected_industry =
          report.provider_meta.keyword_detected_industry;
      }
    }

    // Extract competitors for "interesting sites" reference
    if (
      report.competitors &&
      Array.isArray(report.competitors) &&
      report.competitors.length > 0
    ) {
      const competitors_data = report.competitors.map((c) => ({
        url: c.url,
        domain_authority: c.domain_authority,
        keywords_ranking: c.keywords_ranking,
        top_keywords: c.top_keywords || [],
      }));
      enhancements.competitors_from_audit = competitors_data;
    }

    // Store page speed metrics for builder recommendations
    if (report.page_speed) {
      enhancements.page_speed_from_audit = report.page_speed;
    }

    // Store audit scores for reference
    if (report.summary) {
      enhancements.audit_scores = {
        overall: report.summary.overall_score,
        performance: report.summary.performance_score,
        seo: report.summary.seo_score,
        mobile: report.summary.mobile_score,
        accessibility: report.summary.accessibility_score,
      };
    }

    return {
      audit_enhancements:
        Object.keys(enhancements).length > 0 ? enhancements : null,
    };
  } catch (err) {
    console.error("Error extracting audit data:", err);
    return { audit_enhancements: null };
  }
}

/**
 * Aggressive audit-to-onboarding pre-fill.
 * Derives Step 1 fields from audit metadata to minimize manual entry.
 * All values are optional and always shown as editable suggestions ("From your audit").
 * Never silently submitted — user always reviews and confirms.
 */
export async function extractAuditPreFillForStep1(
  auditId: string | null | undefined,
): Promise<AuditPreFillData> {
  if (!auditId) return {};

  try {
    const supabase = getRawClient();
    const { data: audit } = await supabase
      .from("audits")
      .select("report_data")
      .eq("id", auditId)
      .single();

    if (!audit) return {};

    const report = (audit as { report_data: unknown } | null)
      ?.report_data as AuditReportData | null;
    if (!report) return {};

    const preFill: AuditPreFillData = {};

    // Guess business name from keywords/metadata
    preFill.business_name_guess = guessBusinessName(report);

    // Extract services from keywords and opportunities
    preFill.services_list = extractServicesList(report);

    // Suggest tagline from top opportunities
    preFill.suggested_tagline = suggestTagline(report);

    // Parse location from provider_meta
    if (report.provider_meta?.keyword_detected_location) {
      const { city, state } = parseLocationString(
        report.provider_meta.keyword_detected_location,
      );
      preFill.city_guess = city;
      preFill.state_guess = state;
    }

    return preFill;
  } catch (err) {
    console.error("Error extracting Step 1 pre-fill data:", err);
    return {};
  }
}
