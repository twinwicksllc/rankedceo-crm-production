"use server";

import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import type { SectionConfig, SectionId } from "@/lib/waas/templates/types";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";

// =============================================================================
// 10. regenerateSection   (PR #102)
//
// Regenerates ALL text/long-text fields for a single named section using AI.
// The client can optionally provide a short hint ("keep it under 120 chars",
// "focus on emergency services") which is forwarded to the model.
//
// Returns a map of { [jsonPath]: newValue } so the editor-shell can:
//   1. Optimistically update its local field state in one batch
//   2. Persist each change via updateClientVariantContent individually
//      (so the audit log captures each field update independently)
//
// The server action itself does NOT write to the DB — the client decides
// whether to accept and then calls updateClientVariantContent per field.
// This keeps the action stateless and safe to retry.
// =============================================================================

export interface RegenerateSectionArgs {
  /** Identifies the client; must be valid and unlocked. */
  reviewToken: string;
  /** Which variant index to source existing content from. */
  variantIndex: number;
  /** The section id to regenerate, e.g. "hero", "about", "faq". */
  sectionId: SectionId;
  /**
   * Optional freeform client hint forwarded to the model verbatim,
   * e.g. "make it punchier" or "focus on 24/7 emergency service".
   */
  hint?: string;
}

export interface RegeneratedField {
  /** Same JSON path format used by updateClientVariantContent. */
  path: string;
  /** Human-readable label so the UI can display a diff. */
  label: string;
  /** Original value before regeneration (sourced from the live variant). */
  original: string;
  /** AI-suggested replacement. */
  suggested: string;
}

export interface RegenerateSectionResult {
  /** Fields that the AI produced suggestions for. */
  fields: RegeneratedField[];
  tokensUsed: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Leaf text fields the regeneration action will rewrite per section. */
const REGENERATABLE_LEAF_FIELDS: Partial<
  Record<
    SectionId,
    Array<{
      key: string;
      label: string;
      maxLen: number;
      isArray?: false;
    }>
  >
> = {
  hero: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "primaryCtaLabel", label: "Primary CTA", maxLen: 40 },
    { key: "secondaryCtaLabel", label: "Secondary CTA", maxLen: 40 },
    { key: "locationBadge", label: "Location Badge", maxLen: 80 },
  ],
  "answer-first-aeo": [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "intro", label: "Intro", maxLen: 300 },
  ],
  "bento-emergency": [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "bottomCtaText", label: "Bottom CTA", maxLen: 60 },
  ],
  services: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "bottomCtaText", label: "Bottom CTA", maxLen: 60 },
  ],
  trust: [
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
  ],
  about: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "body", label: "Body", maxLen: 800 },
  ],
  faq: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "intro", label: "Intro", maxLen: 300 },
  ],
  "how-it-works": [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "intro", label: "Intro", maxLen: 300 },
  ],
  booking: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "primaryCtaLabel", label: "Primary CTA", maxLen: 40 },
  ],
  reviews: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
  ],
  gallery: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
  ],
  financing: [
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
  ],
};

/**
 * Builds the OpenAI prompt for regenerating all fields in a section at once.
 * Returns a JSON schema that maps field keys to regenerated values.
 */
function buildSectionRegeneratePrompt(
  sectionId: SectionId,
  existingContent: Record<string, unknown>,
  businessName: string,
  trade: string,
  location: string,
  hint: string | undefined,
  leafFields: Array<{ key: string; label: string; maxLen: number }>,
): { system: string; user: string } {
  const fieldList = leafFields
    .map((f) => `"${f.key}" (${f.label}, max ${f.maxLen} chars)`)
    .join(", ");

  const existingSnippet = leafFields
    .map((f) => {
      const v = existingContent[f.key];
      return `  ${f.key}: ${v ? `"${String(v).slice(0, 120)}"` : "(empty)"}`;
    })
    .join("\n");

  const system = [
    "You are a professional website copywriter helping a local home-services business.",
    "Regenerate the text fields for one website section in a single JSON response.",
    `Return ONLY valid JSON with keys: ${leafFields.map((f) => `"${f.key}"`).join(", ")}.`,
    "Each value must be a plain string (no HTML, no markdown).",
    "Respect the max character limit per field.",
    "Match the tone and voice already present; improve clarity and conversion focus.",
    "Do NOT invent facts, certifications, or specific prices not already present.",
  ].join(" ");

  const userLines = [
    `Business name: ${businessName}`,
    `Trade / industry: ${trade}`,
    `Location: ${location}`,
    `Section to regenerate: ${sectionId}`,
    `Fields to rewrite: ${fieldList}`,
    "",
    "Current field values:",
    existingSnippet,
  ];
  if (hint?.trim()) {
    userLines.push("", `Client instruction: "${hint.trim()}"`);
  }

  return { system, user: userLines.join("\n") };
}

// ---------------------------------------------------------------------------
// Main exported server action
// ---------------------------------------------------------------------------

export async function regenerateSection(
  args: RegenerateSectionArgs,
): Promise<ActionResult<RegenerateSectionResult>> {
  const { reviewToken, variantIndex, sectionId, hint } = args;

  // --- Permission gate ---
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok)
    return { success: false, error: sessionResult.message };

  const session = sessionResult.session;
  if (!session.permissions.canEditText) {
    return {
      success: false,
      error: "Text editing is not available for this session.",
    };
  }
  if (session.permissions.isLocked) {
    return {
      success: false,
      error: "Editing is locked — approval has been submitted.",
    };
  }

  // --- Validate inputs ---
  if (variantIndex == null || variantIndex < 0) {
    return { success: false, error: "Invalid variantIndex." };
  }
  if (hint && hint.length > 500) {
    return { success: false, error: "Hint must be 500 characters or fewer." };
  }

  // --- Check we have leaf fields for this section ---
  const leafFields = REGENERATABLE_LEAF_FIELDS[sectionId];
  if (!leafFields || leafFields.length === 0) {
    return {
      success: false,
      error: `Section "${sectionId}" does not support AI regeneration.`,
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey)
    return { success: false, error: "AI regeneration is not configured." };

  // --- Load the current variant from DB to source existing content ---
  const supabase = getAdminClient();
  const { data: variantRow, error: variantErr } = await supabase
    .from("tenant_site_variants")
    .select("sections_json, id")
    .eq("tenant_id", session.tenantId)
    .order("variant_index", { ascending: true })
    .limit(10); // load all, then pick by index

  if (variantErr || !variantRow) {
    return { success: false, error: "Could not load site variant." };
  }

  // Find by variantIndex (offset in ordered list)
  const variantRows = variantRow as Array<{
    sections_json: unknown;
    id: string;
  }>;
  const targetRow = variantRows[variantIndex];
  if (!targetRow) {
    return {
      success: false,
      error: `Variant at index ${variantIndex} not found.`,
    };
  }

  const sectionsJson = targetRow.sections_json;
  const sections: SectionConfig[] = Array.isArray(sectionsJson)
    ? (sectionsJson as SectionConfig[])
    : [];

  const section = sections.find((s) => s.section === sectionId);
  if (!section) {
    return {
      success: false,
      error: `Section "${sectionId}" not found in this variant.`,
    };
  }

  const existingContent = (section.content ?? {}) as Record<string, unknown>;
  const sectionOrder = section.order;

  // --- Extract business context from tenant brand_config ---
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("waas_tenants")
    .select("brand_config, legal_name, primary_trade, target_industry")
    .eq("id", session.tenantId)
    .single();

  if (tenantErr || !tenantRow) {
    return { success: false, error: "Could not load tenant information." };
  }

  const brand = (tenantRow.brand_config ?? {}) as Record<string, unknown>;
  const contactInfo = (brand.contact ?? {}) as Record<string, unknown>;
  const businessName =
    typeof brand.business_name === "string" && brand.business_name
      ? brand.business_name
      : (tenantRow.legal_name ?? "Your Business");
  const trade =
    tenantRow.primary_trade ?? tenantRow.target_industry ?? "Local service";
  const location =
    [contactInfo.city, contactInfo.state].filter(Boolean).join(", ") ||
    "your area";

  // --- Build prompt + call OpenAI ---
  const { system, user } = buildSectionRegeneratePrompt(
    sectionId,
    existingContent,
    businessName,
    trade,
    location,
    hint,
    leafFields,
  );

  let tokensUsed = 0;
  let rawResponse: Record<string, string> = {};

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1200,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        success: false,
        error: `AI service error: ${resp.status} — ${errText.slice(0, 200)}`,
      };
    }

    const json = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };

    tokensUsed = json.usage?.total_tokens ?? 0;
    const raw = json.choices?.[0]?.message?.content ?? "";

    // Parse and extract only the expected string fields
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const lf of leafFields) {
      const val = parsed[lf.key];
      if (typeof val === "string" && val.trim()) {
        rawResponse[lf.key] = val.trim().slice(0, lf.maxLen * 2); // hard-cap at 2× to prevent abuse
      }
    }
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected AI error. Please try again.",
    };
  }

  // Must have produced at least one field
  if (Object.keys(rawResponse).length === 0) {
    return {
      success: false,
      error: "AI returned no usable content. Please try again.",
    };
  }

  // --- Build result — map AI keys back to JSON paths ---
  const fields: RegeneratedField[] = leafFields
    .filter((lf) => rawResponse[lf.key] !== undefined)
    .map((lf) => ({
      path: `sections[${sectionOrder}].content.${lf.key}`,
      label: lf.label,
      original:
        existingContent[lf.key] != null ? String(existingContent[lf.key]) : "",
      suggested: rawResponse[lf.key],
    }));

  return {
    success: true,
    data: { fields, tokensUsed },
  };
}
