// =============================================================================
// WaaS: Shared FAQPage JSON-LD helpers
//
// Establishes a single source of truth for FAQ-style structured data so a
// page never emits more than one `FAQPage` JSON-LD node, even when both the
// `answer-first-aeo` section and the `faq` section are enabled on the same
// template (confirmed: 6 of 10 templates run both simultaneously).
//
// Per Google's structured data guidance, multiple `FAQPage` nodes on one
// page can cause rich-result eligibility to be dropped for both, or trigger
// Search Console warnings. See AEO/Bento audit finding 1.2.
//
// Usage pattern: `AnswerFirstAEOSection` and `FAQSection` each render their
// own visual Q&A cards (and import the *same* fallback-content builders
// from this module so their rendered copy never drifts from what the page
// describes in JSON-LD), but neither section renders its own JSON-LD
// `<script>` tag directly anymore. Instead, the page
// (`app/_sites/[site]/page.tsx`) collects normalized Q&A items from every
// enabled FAQ-style section via `collectFaqItemsFromSections()`, dedupes
// them, and emits exactly one `FAQPage` JSON-LD block for the whole page —
// mirroring how `LocalBusiness` schema is already emitted once at the page
// level.
// =============================================================================

import type { ResolvedTenant, SectionConfig } from "@/lib/waas/templates/types";
import { readConfigInt, readConfigBool } from "@/lib/waas/utils/section-config";

export interface FaqJsonLdItem {
  question: string;
  answer: string;
}

const DEFAULT_MAX_ITEMS = 6;
const DEFAULT_MAX_ANSWER_WORDS = 70;

const FLUFF_PATTERNS: RegExp[] = [
  /\bwe\s+are\s+dedicated\s+to\s+excellence\b/gi,
  /\bcommitted\s+to\s+customer\s+satisfaction\b/gi,
  /\bstate-of-the-art\b/gi,
  /\bleading\s+provider\b/gi,
  /\bunparalleled\s+service\b/gi,
  /\bworld-class\b/gi,
  /\byour\s+trusted\s+partner\b/gi,
];

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripMarketingFiller(value: string): string {
  let next = value;
  for (const pattern of FLUFF_PATTERNS) {
    next = next.replace(pattern, "");
  }
  return collapseWhitespace(next);
}

export function truncateWords(value: string, maxWords: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function normalizeQuestion(value: string): string {
  const compact = collapseWhitespace(value);
  if (!compact) return "What should I know first?";
  return /[?.!]$/.test(compact) ? compact : `${compact}?`;
}

export function normalizeAnswer(value: string, maxWords: number): string {
  const stripped = stripMarketingFiller(value);
  if (!stripped)
    return "Contact dispatch for a direct, fact-based service assessment.";
  return truncateWords(stripped, maxWords);
}

/**
 * Key used to detect duplicate questions across sections: lowercased,
 * whitespace-collapsed, trailing punctuation stripped.
 */
function faqDedupeKey(question: string): string {
  return collapseWhitespace(question).toLowerCase().replace(/[?.!]+$/, "");
}

/**
 * Deduplicate FAQ items by normalized question text, keeping the first
 * occurrence (earlier sections in page order win).
 */
export function dedupeFaqItems(items: FaqJsonLdItem[]): FaqJsonLdItem[] {
  const seen = new Set<string>();
  const out: FaqJsonLdItem[] = [];
  for (const item of items) {
    const key = faqDedupeKey(item.question);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function toFaqPageJsonLd(
  items: FaqJsonLdItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

type AeoContentLike = { items?: Array<{ question: string; answer: string }> };
type FaqContentLike = { items?: Array<{ question: string; answer: string }> };

/**
 * Fallback AEO Q&A content, matching `AnswerFirstAEOSection`'s own
 * `fallbackItems` exactly so the JSON-LD emitted for a tenant with no
 * custom AEO content still describes what actually renders on the page.
 * `AnswerFirstAEOSection` imports this same function to render its cards,
 * so there is exactly one definition of this fallback content.
 */
export function buildAeoFallbackItems(
  trade: string,
  location: string,
): FaqJsonLdItem[] {
  return [
    {
      question: `How fast can ${trade.toLowerCase()} service be dispatched in ${location}`,
      answer:
        "Priority calls are triaged first. Dispatch windows depend on technician availability, issue severity, and distance from your service zone.",
    },
    {
      question: "What does the initial visit include",
      answer:
        "The first visit confirms symptoms, checks safety risks, defines repair scope, and provides next-step options before major work proceeds.",
    },
    {
      question: "Do you provide clear pricing before work starts",
      answer:
        "Yes. Pricing is presented after diagnostics and scope confirmation, with options tied to the actual condition found onsite.",
    },
  ];
}

/**
 * Fallback FAQ Q&A content, matching `FAQSection`'s own default `items`
 * exactly. `FAQSection` imports this same function to render its cards.
 */
export function buildFaqFallbackItems(
  trade: string,
  location: string,
): FaqJsonLdItem[] {
  return [
    {
      question: "How quickly can you schedule service?",
      answer:
        "Most appointments can be scheduled quickly based on current availability and urgency.",
    },
    {
      question: "Do you provide upfront pricing?",
      answer:
        "Yes. We review scope and provide clear pricing before work begins.",
    },
    {
      question: "What areas do you serve?",
      answer: `We serve ${location} and nearby communities.`,
    },
  ];
}

/**
 * Collect normalized, deduped FAQ items across every enabled FAQ-style
 * section (`answer-first-aeo` and `faq`) on a page, honoring each section's
 * own config (`answer-first-aeo`'s `includeJsonLd` toggle lets an admin opt
 * a tenant fully out of FAQ schema; `maxItems`/`maxAnswerWords` cap and trim
 * the AEO items the same way the section renders them visually).
 *
 * Falls back to the same default Q&A content each component renders when a
 * section has no custom `content.items`, so the JSON-LD never diverges from
 * what a visitor actually sees on the page (a schema/visible-content
 * mismatch that Google's structured data guidelines explicitly warn against).
 *
 * Returns an empty array when nothing is eligible, in which case the caller
 * should skip emitting a `FAQPage` script entirely.
 */
export function collectFaqItemsFromSections(
  sections: SectionConfig[],
  tenant: Pick<
    ResolvedTenant,
    "primary_trade" | "target_industry" | "target_location"
  >,
): FaqJsonLdItem[] {
  const collected: FaqJsonLdItem[] = [];

  const trade = tenant.primary_trade ?? tenant.target_industry ?? "service";
  const location = tenant.target_location ?? "your local area";

  const enabledSorted = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  for (const section of enabledSorted) {
    if (section.section === "answer-first-aeo") {
      const includeJsonLd = readConfigBool(
        section.config,
        "includeJsonLd",
        true,
      );
      if (!includeJsonLd) continue;

      const maxItems = readConfigInt(
        section.config,
        "maxItems",
        DEFAULT_MAX_ITEMS,
      );
      const maxAnswerWords = readConfigInt(
        section.config,
        "maxAnswerWords",
        DEFAULT_MAX_ANSWER_WORDS,
      );

      const content = section.content as AeoContentLike | undefined;
      const rawItems = content?.items?.length
        ? content.items
        : buildAeoFallbackItems(trade, location);

      for (const item of rawItems.slice(0, Math.max(1, maxItems))) {
        if (!item?.question || !item?.answer) continue;
        collected.push({
          question: normalizeQuestion(item.question),
          answer: normalizeAnswer(item.answer, Math.max(20, maxAnswerWords)),
        });
      }
    } else if (section.section === "faq") {
      const content = section.content as FaqContentLike | undefined;
      const rawItems = content?.items?.length
        ? content.items
        : buildFaqFallbackItems(trade, location);

      for (const item of rawItems.slice(0, 8)) {
        if (!item?.question || !item?.answer) continue;
        collected.push({
          question: normalizeQuestion(item.question),
          answer: collapseWhitespace(item.answer),
        });
      }
    }
  }

  return dedupeFaqItems(collected);
}
