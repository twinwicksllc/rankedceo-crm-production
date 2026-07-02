/**
 * llm-relocate.ts — Self-Healing Stub (v1)
 *
 * PURPOSE
 * -------
 * Reads a critical-halt GitHub Issue body, extracts the embedded selfHealPayload
 * JSON block, constructs an LLM prompt, and (in v1.5) sends it to a language
 * model to get a selector/pattern fix proposal.
 *
 * v1 BEHAVIOUR
 * ------------
 * - Extracts the payload
 * - Logs the constructed LLM prompt to stdout
 * - Returns null (no actual LLM call)
 *
 * v1.5 ACTIVATION
 * ---------------
 * 1. Set SELF_HEAL_PROVIDER=openai or SELF_HEAL_PROVIDER=anthropic
 * 2. Set OPENAI_API_KEY or ANTHROPIC_API_KEY
 * 3. Replace the stub block in callLlm() with the actual SDK call
 * 4. See docs/qa-agent/self-healing.md for full activation guide
 *
 * USAGE
 * -----
 * Called automatically by EscalationEngine after a critical halt GitHub Issue
 * is created. Can also be invoked manually:
 *
 *   npx tsx qa-agent/src/self-healing/llm-relocate.ts \
 *     --issue-number 42 \
 *     --repo twinwicksllc/rankedceo-crm-production
 */

import * as https from "node:https";
import type {
  SelfHealPayload,
  SelfHealProposal,
  SelfHealConfig,
} from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** JSON block marker used in GitHub Issue bodies */
const PAYLOAD_START = "<!-- SELF_HEAL_PAYLOAD_START -->";
const PAYLOAD_END = "<!-- SELF_HEAL_PAYLOAD_END -->";

/** Default config when no env vars are set */
const DEFAULT_CONFIG: SelfHealConfig = {
  provider: "stub",
  model: "gpt-4o",
  minConfidence: 0.7,
};

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Given a GitHub Issue body string, extracts the selfHealPayload, constructs
 * an LLM prompt, and returns a SelfHealProposal (or null in v1 stub mode).
 */
export async function relocate(
  issueBody: string,
  config: SelfHealConfig = DEFAULT_CONFIG,
): Promise<SelfHealProposal | null> {
  const payload = extractPayload(issueBody);
  if (!payload) {
    console.warn("[llm-relocate] No selfHealPayload found in issue body.");
    return null;
  }

  const prompt = buildPrompt(payload);

  if (config.provider === "stub") {
    // v1: log the prompt and return null
    console.log(
      "\n[llm-relocate] ── v1 STUB ───────────────────────────────────────",
    );
    console.log("[llm-relocate] Self-healing hook is ready. To activate, set:");
    console.log("[llm-relocate]   SELF_HEAL_PROVIDER=openai");
    console.log("[llm-relocate]   OPENAI_API_KEY=sk-...");
    console.log(
      "[llm-relocate] See docs/qa-agent/self-healing.md for full guide.",
    );
    console.log(
      "\n[llm-relocate] Constructed LLM prompt (would be sent in v1.5):",
    );
    console.log("─".repeat(60));
    console.log(prompt);
    console.log("─".repeat(60));
    return null;
  }

  // v1.5: call the LLM
  return await callLlm(prompt, payload, config);
}

/**
 * Reads a GitHub Issue by number and calls relocate() on its body.
 * Convenience wrapper for CLI and EscalationEngine use.
 */
export async function relocateFromIssue(
  issueNumber: number,
  repo: string,
  githubToken: string,
  config: SelfHealConfig = DEFAULT_CONFIG,
): Promise<SelfHealProposal | null> {
  const issueBody = await fetchIssueBody(issueNumber, repo, githubToken);
  if (!issueBody) {
    console.warn(
      `[llm-relocate] Could not fetch body of issue #${issueNumber}`,
    );
    return null;
  }
  return relocate(issueBody, config);
}

// ─── Payload Extraction ───────────────────────────────────────────────────────

function extractPayload(issueBody: string): SelfHealPayload | null {
  const start = issueBody.indexOf(PAYLOAD_START);
  const end = issueBody.indexOf(PAYLOAD_END);
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = issueBody
    .slice(start + PAYLOAD_START.length, end)
    .replace(/```json\n?/, "")
    .replace(/\n?```/, "")
    .trim();

  try {
    return JSON.parse(jsonStr) as SelfHealPayload;
  } catch {
    console.warn(
      "[llm-relocate] Failed to parse selfHealPayload JSON:",
      jsonStr.slice(0, 200),
    );
    return null;
  }
}

// ─── Prompt Construction ──────────────────────────────────────────────────────

function buildPrompt(payload: SelfHealPayload): string {
  const selectorSection = payload.failedSelector
    ? `**Failed selector:** \`${payload.failedSelector}\``
    : payload.failedPattern
      ? `**Failed URL pattern:** \`${payload.failedPattern}\``
      : "No selector or pattern recorded.";

  const domSection = payload.domSnippet
    ? `**DOM snippet at time of failure (truncated):**\n\`\`\`html\n${payload.domSnippet}\n\`\`\``
    : "No DOM snapshot available.";

  return `You are a QA automation engineer specialising in Playwright test repair.

A QA agent scenario step has critically failed. Your task is to analyse the failure
and suggest a repaired selector or URL pattern that will make the step pass again.

## Step Information

- **Step ID:** ${payload.stepId}
- **Step type:** ${payload.stepType}
- **Persona:** ${payload.persona}
- **Scenario:** ${payload.scenario}
- **Error message:** ${payload.errorMessage}
- **Failed at:** ${payload.failedAt}

${selectorSection}

## Step Intent

The original author described the step's purpose as:

> ${payload.intent}

## DOM Context

${domSection}

## Instructions

1. Analyse the error message and intent to understand what the step was trying to find.
2. If a DOM snippet is provided, scan it for elements that match the intent.
3. Propose a new selector (or URL pattern) that will reliably target the intended element.
4. Prefer \`data-testid\` selectors over CSS class or text selectors.
5. If no DOM snippet is available, reason from the intent and error alone.
6. Provide a confidence score between 0.0 and 1.0.
7. Return your answer as a JSON object with this exact shape:

\`\`\`json
{
  "canFix": true,
  "confidence": 0.92,
  "proposedSelector": "[data-testid='new-selector']",
  "reasoning": "The original data-testid was renamed in the latest deploy...",
  "yamlPatch": "  - id: ${payload.stepId}\\n    type: ${payload.stepType}\\n    selector: \\"[data-testid='new-selector']\\"\\n    ...",
  "model": "MODEL_NAME"
}
\`\`\`

If you cannot determine a fix, set \`"canFix": false\` and explain in \`"reasoning"\`.`;
}

// ─── LLM Call (v1.5 implementation point) ────────────────────────────────────

async function callLlm(
  prompt: string,
  payload: SelfHealPayload,
  config: SelfHealConfig,
): Promise<SelfHealProposal | null> {
  // ── v1.5 OpenAI implementation ──────────────────────────────────────────────
  if (config.provider === "openai") {
    if (!config.apiKey) {
      console.warn(
        "[llm-relocate] OPENAI_API_KEY is required when SELF_HEAL_PROVIDER=openai",
      );
      return null;
    }

    const model = config.model ?? "gpt-4o-mini";
    const minConfidence = config.minConfidence ?? 0.7;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You repair Playwright selectors and URL assertions. Return strict JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[llm-relocate] OpenAI API error ${res.status}: ${text}`);
      return null;
    }

    type OpenAiResponse = {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { total_tokens?: number };
    };

    const data = (await res.json()) as OpenAiResponse;
    const content = data.choices?.[0]?.message?.content ?? "{}";

    let raw: Partial<SelfHealProposal>;
    try {
      raw = JSON.parse(content) as Partial<SelfHealProposal>;
    } catch {
      console.warn("[llm-relocate] OpenAI response was not valid JSON");
      return null;
    }

    const confidence = typeof raw.confidence === "number" ? raw.confidence : 0;
    if (confidence < minConfidence) {
      console.log(
        `[llm-relocate] Proposal below confidence threshold (${confidence} < ${minConfidence})`,
      );
      return null;
    }

    return {
      canFix: Boolean(raw.canFix),
      confidence,
      proposedSelector: raw.proposedSelector,
      proposedPattern: raw.proposedPattern,
      reasoning:
        raw.reasoning ??
        `Model returned no reasoning for step ${payload.stepId}`,
      yamlPatch: raw.yamlPatch,
      model,
      tokensUsed: data.usage?.total_tokens,
    };
  }

  // ── v1.5 Anthropic implementation ──────────────────────────────────────────
  if (config.provider === "anthropic") {
    // TODO v1.5: Replace this comment with the actual Anthropic SDK call:
    //
    // import Anthropic from '@anthropic-ai/sdk'
    // const client = new Anthropic({ apiKey: config.apiKey })
    // const response = await client.messages.create({
    //   model: config.model ?? 'claude-3-5-sonnet-20241022',
    //   max_tokens: 1024,
    //   messages: [{ role: 'user', content: prompt }],
    // })
    // const raw = JSON.parse((response.content[0] as any).text ?? '{}')
    // return { ...raw, model: config.model ?? 'claude-3-5-sonnet-20241022', tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens }

    console.warn(
      "[llm-relocate] Anthropic provider selected but not yet wired. See docs/qa-agent/self-healing.md",
    );
    return null;
  }

  return null;
}

// ─── GitHub Issue Fetcher ─────────────────────────────────────────────────────

function fetchIssueBody(
  issueNumber: number,
  repo: string,
  token: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${repo}/issues/${issueNumber}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "rankedceo-qa-agent/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.body ?? null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

// Allow running directly: npx tsx llm-relocate.ts --issue-number 42 --repo owner/repo
if (
  process.argv[1]?.endsWith("llm-relocate.ts") ||
  process.argv[1]?.endsWith("llm-relocate.js")
) {
  const args = process.argv.slice(2);
  const issueArg = args.indexOf("--issue-number");
  const repoArg = args.indexOf("--repo");

  if (issueArg === -1 || repoArg === -1) {
    console.error(
      "Usage: npx tsx llm-relocate.ts --issue-number <N> --repo owner/repo",
    );
    process.exit(1);
  }

  const issueNumber = parseInt(args[issueArg + 1], 10);
  const repo = args[repoArg + 1];
  const token = process.env.GITHUB_TOKEN ?? "";

  if (!token) {
    console.error("GITHUB_TOKEN env var is required");
    process.exit(1);
  }

  const provider = (process.env.SELF_HEAL_PROVIDER ??
    "stub") as SelfHealConfig["provider"];
  const config: SelfHealConfig = {
    provider,
    model: process.env.SELF_HEAL_MODEL,
    apiKey:
      provider === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY,
    minConfidence: parseFloat(process.env.SELF_HEAL_MIN_CONFIDENCE ?? "0.7"),
  };

  relocateFromIssue(issueNumber, repo, token, config)
    .then((proposal) => {
      if (proposal) {
        console.log("\n[llm-relocate] Proposal:");
        console.log(JSON.stringify(proposal, null, 2));
      } else {
        console.log(
          "\n[llm-relocate] No proposal generated (stub mode or low confidence).",
        );
      }
    })
    .catch((err) => {
      console.error("[llm-relocate] Error:", err);
      process.exit(1);
    });
}
