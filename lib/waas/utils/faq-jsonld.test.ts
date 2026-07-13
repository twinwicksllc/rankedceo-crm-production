import test from "node:test";
import assert from "node:assert/strict";

import type { SectionConfig } from "@/lib/waas/templates/types";
import {
  collapseWhitespace,
  stripMarketingFiller,
  truncateWords,
  normalizeQuestion,
  normalizeAnswer,
  dedupeFaqItems,
  toFaqPageJsonLd,
  buildAeoFallbackItems,
  buildFaqFallbackItems,
  collectFaqItemsFromSections,
} from "./faq-jsonld";

function aeoSection(overrides: Partial<SectionConfig> = {}): SectionConfig {
  return {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: {},
    ...overrides,
  };
}

function faqSection(overrides: Partial<SectionConfig> = {}): SectionConfig {
  return {
    section: "faq",
    enabled: true,
    order: 1,
    config: {},
    ...overrides,
  };
}

const tenant = {
  primary_trade: "Plumbing",
  target_industry: null,
  target_location: "Austin, TX",
};

// ---------------------------------------------------------------------------
// Pure string helpers
// ---------------------------------------------------------------------------

test("collapseWhitespace collapses internal whitespace and trims", () => {
  assert.equal(collapseWhitespace("  a   b\n\tc  "), "a b c");
});

test("stripMarketingFiller removes known fluff phrases", () => {
  const result = stripMarketingFiller(
    "We are dedicated to excellence and committed to customer satisfaction every day.",
  );
  assert.ok(!/dedicated to excellence/i.test(result));
  assert.ok(!/committed to customer satisfaction/i.test(result));
});

test("truncateWords leaves short text untouched", () => {
  assert.equal(truncateWords("short answer here", 10), "short answer here");
});

test("truncateWords truncates and appends ellipsis when over the limit", () => {
  const result = truncateWords("one two three four five", 3);
  assert.equal(result, "one two three...");
});

test("normalizeQuestion appends a question mark when missing terminal punctuation", () => {
  assert.equal(normalizeQuestion("What areas do you serve"), "What areas do you serve?");
});

test("normalizeQuestion leaves existing terminal punctuation alone", () => {
  assert.equal(normalizeQuestion("Do you serve Austin?"), "Do you serve Austin?");
});

test("normalizeQuestion falls back for empty input", () => {
  assert.equal(normalizeQuestion("   "), "What should I know first?");
});

test("normalizeAnswer strips fluff and truncates to maxWords", () => {
  const result = normalizeAnswer(
    "We are dedicated to excellence. " + "word ".repeat(30),
    5,
  );
  const words = result.replace("...", "").trim().split(/\s+/);
  assert.ok(words.length <= 6); // 5 + ellipsis-adjacent tolerance
});

test("normalizeAnswer falls back for empty/fluff-only input", () => {
  assert.equal(
    normalizeAnswer("state-of-the-art", 20),
    "Contact dispatch for a direct, fact-based service assessment.",
  );
});

// ---------------------------------------------------------------------------
// Dedup + JSON-LD shape
// ---------------------------------------------------------------------------

test("dedupeFaqItems keeps first occurrence and drops case/punctuation-insensitive dupes", () => {
  const items = [
    { question: "What areas do you serve?", answer: "Austin and nearby." },
    { question: "what areas do YOU serve", answer: "Different answer text." },
    { question: "Do you offer financing?", answer: "Yes." },
  ];
  const result = dedupeFaqItems(items);
  assert.equal(result.length, 2);
  assert.equal(result[0].answer, "Austin and nearby.");
  assert.equal(result[1].question, "Do you offer financing?");
});

test("toFaqPageJsonLd produces a single FAQPage node with Question/Answer entities", () => {
  const jsonLd = toFaqPageJsonLd([
    { question: "Q1?", answer: "A1." },
    { question: "Q2?", answer: "A2." },
  ]) as {
    "@context": string;
    "@type": string;
    mainEntity: Array<{
      "@type": string;
      name: string;
      acceptedAnswer: { "@type": string; text: string };
    }>;
  };

  assert.equal(jsonLd["@context"], "https://schema.org");
  assert.equal(jsonLd["@type"], "FAQPage");
  assert.equal(jsonLd.mainEntity.length, 2);
  assert.equal(jsonLd.mainEntity[0]["@type"], "Question");
  assert.equal(jsonLd.mainEntity[0].name, "Q1?");
  assert.equal(jsonLd.mainEntity[0].acceptedAnswer["@type"], "Answer");
  assert.equal(jsonLd.mainEntity[0].acceptedAnswer.text, "A1.");
});

// ---------------------------------------------------------------------------
// Fallback content builders
// ---------------------------------------------------------------------------

test("buildAeoFallbackItems interpolates trade and location", () => {
  const items = buildAeoFallbackItems("Plumbing", "Austin, TX");
  assert.equal(items.length, 3);
  assert.ok(items[0].question.includes("plumbing"));
  assert.ok(items[0].question.includes("Austin, TX"));
});

test("buildFaqFallbackItems interpolates location", () => {
  const items = buildFaqFallbackItems("Plumbing", "Austin, TX");
  assert.equal(items.length, 3);
  assert.ok(items[2].answer.includes("Austin, TX"));
});

// ---------------------------------------------------------------------------
// collectFaqItemsFromSections — the core dedup-guard behavior (finding 1.2)
// ---------------------------------------------------------------------------

test("collectFaqItemsFromSections returns empty array when no FAQ-style sections are enabled", () => {
  const sections: SectionConfig[] = [
    { section: "hero", enabled: true, order: 0, config: {} },
  ];
  assert.deepEqual(collectFaqItemsFromSections(sections, tenant), []);
});

test("collectFaqItemsFromSections returns empty array when includeJsonLd is false and no faq section exists", () => {
  const sections = [aeoSection({ config: { includeJsonLd: false } })];
  assert.deepEqual(collectFaqItemsFromSections(sections, tenant), []);
});

test("collectFaqItemsFromSections uses AEO fallback items when includeJsonLd defaults true and no custom content", () => {
  const sections = [aeoSection()];
  const result = collectFaqItemsFromSections(sections, tenant);
  assert.equal(result.length, 3);
  assert.ok(result[0].question.toLowerCase().includes("plumbing"));
});

test("collectFaqItemsFromSections respects maxItems cap on AEO section", () => {
  const sections = [aeoSection({ config: { maxItems: 1 } })];
  const result = collectFaqItemsFromSections(sections, tenant);
  assert.equal(result.length, 1);
});

test("collectFaqItemsFromSections uses custom AEO content.items when present", () => {
  const sections = [
    aeoSection({
      content: {
        items: [
          { question: "Custom AEO question", answer: "Custom AEO answer." },
        ],
      },
    }),
  ];
  const result = collectFaqItemsFromSections(sections, tenant);
  assert.equal(result.length, 1);
  assert.equal(result[0].question, "Custom AEO question?");
});

test("collectFaqItemsFromSections merges AEO + FAQ sections and dedupes overlapping questions", () => {
  const sections = [
    aeoSection({
      order: 0,
      content: {
        items: [
          { question: "What areas do you serve", answer: "Austin area." },
        ],
      },
    }),
    faqSection({
      order: 1,
      content: {
        items: [
          // Same question (different casing/punctuation) as the AEO item —
          // should be deduped, keeping the AEO (earlier order) version.
          { question: "What areas do YOU serve?", answer: "Different copy." },
          { question: "Do you offer financing?", answer: "Yes, we do." },
        ],
      },
    }),
  ];

  const result = collectFaqItemsFromSections(sections, tenant);
  assert.equal(result.length, 2, "expected exactly 2 deduped FAQ items");
  assert.equal(result[0].answer, "Austin area.");
  assert.equal(result[1].question, "Do you offer financing?");
});

test("collectFaqItemsFromSections uses FAQ fallback items when faq section has no custom content", () => {
  const sections = [faqSection()];
  const result = collectFaqItemsFromSections(sections, tenant);
  assert.equal(result.length, 3);
  assert.ok(result[2].answer.includes("Austin, TX"));
});

test("collectFaqItemsFromSections skips disabled sections", () => {
  const sections = [
    aeoSection({ enabled: false }),
    faqSection({ enabled: false }),
  ];
  assert.deepEqual(collectFaqItemsFromSections(sections, tenant), []);
});

test("collectFaqItemsFromSections honors page order (AEO before FAQ) for dedup precedence", () => {
  const sections = [
    faqSection({
      order: 0,
      content: {
        items: [{ question: "Shared question", answer: "FAQ version." }],
      },
    }),
    aeoSection({
      order: 1,
      content: {
        items: [{ question: "Shared question", answer: "AEO version." }],
      },
    }),
  ];
  const result = collectFaqItemsFromSections(sections, tenant);
  assert.equal(result.length, 1);
  // FAQ section has lower `order`, so it renders first and wins the dedup.
  assert.equal(result[0].answer, "FAQ version.");
});
