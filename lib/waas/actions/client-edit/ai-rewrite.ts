"use server";

import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import type { ActionResult } from "./_shared";

// =============================================================================
// 4. requestAiRewrite
//    Sends the current text + client intent to the AI rewrite service.
//    Returns the rewritten text.
//    Actual call to the AI API is kept in a separate service layer;
//    this action validates the token and calls it, returning the result.
// =============================================================================

export interface AiRewriteArgs {
  reviewToken: string;
  currentText: string;
  intent: string; // e.g. "make it sound more professional"
  fieldContext: string; // e.g. "headline for services section"
  maxLength?: number;
}

export interface AiRewriteResult {
  rewrittenText: string;
  tokensUsed?: number;
}

export async function requestAiRewrite(
  args: AiRewriteArgs,
): Promise<ActionResult<AiRewriteResult>> {
  const {
    reviewToken,
    currentText,
    intent,
    fieldContext,
    maxLength = 300,
  } = args;

  // Gate on text edit permission specifically
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }
  if (!sessionResult.session.permissions.canEditText) {
    return {
      success: false,
      error: "Text editing is not available for this session.",
    };
  }

  // Sanitize inputs
  if (!currentText?.trim()) {
    return { success: false, error: "currentText must not be empty" };
  }
  if (!intent?.trim()) {
    return { success: false, error: "intent must not be empty" };
  }
  if (currentText.length > 5000) {
    return {
      success: false,
      error: "currentText exceeds maximum length of 5000 characters",
    };
  }
  if (intent.length > 500) {
    return {
      success: false,
      error: "intent exceeds maximum length of 500 characters",
    };
  }

  try {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return {
        success: false,
        error: "AI rewrite is not configured for this environment.",
      };
    }

    const systemPrompt = [
      "You are a professional copywriter helping a small business owner improve their website.",
      "Rewrite the given text according to the client's intent.",
      "Keep the tone consistent with a small local business.",
      `Maximum output length: ${maxLength} characters.`,
      "Return ONLY the rewritten text. No explanations, no quotes, no formatting.",
    ].join(" ");

    const userPrompt = [
      `Field: ${fieldContext}`,
      `Current text: "${currentText}"`,
      `Client intent: "${intent}"`,
    ].join("\n");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: Math.ceil(maxLength * 1.5),
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return {
        success: false,
        error: `AI service error: ${resp.status} ${errBody.slice(0, 200)}`,
      };
    }

    const json = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };

    const rewrittenText = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rewrittenText) {
      return { success: false, error: "AI returned an empty response" };
    }

    return {
      success: true,
      data: {
        rewrittenText,
        tokensUsed: json.usage?.total_tokens,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error calling AI rewrite",
    };
  }
}

// =============================================================================
// 9. requestAiRewriteVariants
//    Returns 3 tone-labelled rewrites in a single OpenAI call so the client
//    can pick the best fit without multiple round trips.
//    Uses response_format: { type: 'json_object' } to enforce structured output.
//    Falls back to 3× sequential single-shot calls if the model returns
//    invalid JSON or the wrong shape.
// =============================================================================

export interface AiRewriteVariantsArgs {
  reviewToken: string;
  currentText: string;
  intent: string; // e.g. "make it sound more professional"
  fieldContext: string; // e.g. "headline for Services section, HVAC business"
  maxLength?: number; // default 300
  toneHints?: string[]; // optional tone presets, e.g. ['Professional','Bold','Friendly']
}

export interface AiRewriteVariant {
  tone: string; // label shown in the UI card, e.g. "Professional"
  text: string; // the rewritten content
}

export interface AiRewriteVariantsResult {
  variants: AiRewriteVariant[]; // always 3
  tokensUsed: number;
}

const DEFAULT_TONES = ["Professional", "Friendly", "Bold & concise"];

export async function requestAiRewriteVariants(
  args: AiRewriteVariantsArgs,
): Promise<ActionResult<AiRewriteVariantsResult>> {
  const {
    reviewToken,
    currentText,
    intent,
    fieldContext,
    maxLength = 300,
    toneHints = DEFAULT_TONES,
  } = args;

  // --- Permission gate ---
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok)
    return { success: false, error: sessionResult.message };
  if (!sessionResult.session.permissions.canEditText) {
    return {
      success: false,
      error: "Text editing is not available for this session.",
    };
  }

  // --- Input validation ---
  if (!currentText?.trim())
    return { success: false, error: "currentText must not be empty" };
  if (!intent?.trim())
    return { success: false, error: "intent must not be empty" };
  if (currentText.length > 5000)
    return { success: false, error: "currentText exceeds 5000 characters" };
  if (intent.length > 500)
    return { success: false, error: "intent exceeds 500 characters" };

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey)
    return { success: false, error: "AI rewrite is not configured." };

  const tones = toneHints.length >= 3 ? toneHints.slice(0, 3) : DEFAULT_TONES;

  const systemPrompt = [
    "You are a professional copywriter helping a small local business improve their website.",
    "Return ONLY valid JSON matching this exact schema:",
    '{ "variants": [ { "tone": "<label>", "text": "<rewritten>" }, ... ] }',
    "Provide exactly 3 variants with the tone labels requested.",
    `Maximum text length per variant: ${maxLength} characters.`,
    "No explanations, no markdown, no extra keys.",
  ].join(" ");

  const userPrompt = [
    `Field: ${fieldContext}`,
    `Current text: "${currentText}"`,
    `Client intent: "${intent}"`,
    `Write one variant each with these tones: ${tones.join(", ")}.`,
  ].join("\n");

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: Math.ceil(maxLength * 1.5 * 3 + 200),
        temperature: 0.75,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return {
        success: false,
        error: `AI service error: ${resp.status} — ${errBody.slice(0, 200)}`,
      };
    }

    const json = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };

    const raw = json.choices?.[0]?.message?.content ?? "";
    const tokensUsed = json.usage?.total_tokens ?? 0;

    // Parse + validate schema
    const parsed = tryParseVariants(raw, tones);
    if (parsed) {
      return { success: true, data: { variants: parsed, tokensUsed } };
    }

    // Fallback: 3× single-shot calls with explicit tones
    const fallbackVariants = await fallbackThreeCalls(
      openAiKey,
      currentText,
      intent,
      fieldContext,
      maxLength,
      tones,
    );
    if (!fallbackVariants) {
      return {
        success: false,
        error: "AI returned an unexpected response. Please try again.",
      };
    }
    return { success: true, data: { variants: fallbackVariants, tokensUsed } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error calling AI rewrite",
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseVariants(
  raw: string,
  tones: string[],
): AiRewriteVariant[] | null {
  try {
    const obj = JSON.parse(raw) as { variants?: unknown };
    if (!Array.isArray(obj.variants)) return null;
    const items = obj.variants as Array<{ tone?: unknown; text?: unknown }>;
    if (items.length < 3) return null;
    const result: AiRewriteVariant[] = items.slice(0, 3).map((item, i) => ({
      tone:
        typeof item.tone === "string" && item.tone.trim()
          ? item.tone.trim()
          : (tones[i] ?? `Option ${i + 1}`),
      text: typeof item.text === "string" ? item.text.trim() : "",
    }));
    if (result.some((v) => !v.text)) return null;
    return result;
  } catch {
    return null;
  }
}

async function fallbackThreeCalls(
  apiKey: string,
  currentText: string,
  intent: string,
  fieldContext: string,
  maxLength: number,
  tones: string[],
): Promise<AiRewriteVariant[] | null> {
  const results: AiRewriteVariant[] = [];

  for (const tone of tones.slice(0, 3)) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: Math.ceil(maxLength * 1.5),
          temperature: 0.75,
          messages: [
            {
              role: "system",
              content: `You are a professional copywriter for small local businesses. Rewrite text in a ${tone} tone. Return ONLY the rewritten text, no quotes, no explanation.`,
            },
            {
              role: "user",
              content: `Field: ${fieldContext}\nCurrent: "${currentText}"\nIntent: "${intent}"\nMax ${maxLength} characters.`,
            },
          ],
        }),
      });
      if (!resp.ok) continue;
      const j = (await resp.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const text = j.choices?.[0]?.message?.content?.trim() ?? "";
      if (text) results.push({ tone, text });
    } catch {
      // Skip failed tone
    }
  }

  return results.length === 3 ? results : null;
}
