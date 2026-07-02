import type {
  AEOItemContent,
  AnswerFirstAEOSectionContent,
  ResolvedTenant,
  SectionConfig,
} from "@/lib/waas/templates/types";

interface AnswerFirstAEOSectionProps {
  tenant: ResolvedTenant;
  config: SectionConfig["config"];
  content?: AnswerFirstAEOSectionContent;
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

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarketingFiller(value: string): string {
  let next = value;
  for (const pattern of FLUFF_PATTERNS) {
    next = next.replace(pattern, "");
  }
  return collapseWhitespace(next);
}

function truncateWords(value: string, maxWords: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function normalizeQuestion(value: string): string {
  const compact = collapseWhitespace(value);
  if (!compact) return "What should I know first?";
  return /[?.!]$/.test(compact) ? compact : `${compact}?`;
}

function normalizeAnswer(value: string, maxWords: number): string {
  const stripped = stripMarketingFiller(value);
  if (!stripped)
    return "Contact dispatch for a direct, fact-based service assessment.";
  return truncateWords(stripped, maxWords);
}

function toFaqJsonLd(
  items: Array<{ question: string; answer: string }>,
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

export function AnswerFirstAEOSection({
  tenant,
  config,
  content,
}: AnswerFirstAEOSectionProps) {
  const configuredMaxItems = config.maxItems;
  const maxItems =
    typeof configuredMaxItems === "number"
      ? configuredMaxItems
      : typeof configuredMaxItems === "string"
        ? Number(configuredMaxItems)
        : DEFAULT_MAX_ITEMS;

  const configuredMaxAnswerWords = config.maxAnswerWords;
  const maxAnswerWords =
    typeof configuredMaxAnswerWords === "number"
      ? configuredMaxAnswerWords
      : typeof configuredMaxAnswerWords === "string"
        ? Number(configuredMaxAnswerWords)
        : DEFAULT_MAX_ANSWER_WORDS;

  const configuredIncludeJsonLd = config.includeJsonLd;
  const includeJsonLd =
    typeof configuredIncludeJsonLd === "boolean"
      ? configuredIncludeJsonLd
      : configuredIncludeJsonLd === "true";

  const trade = tenant.primary_trade ?? tenant.target_industry ?? "service";
  const location = tenant.target_location ?? "your local area";

  const fallbackItems: AEOItemContent[] = [
    {
      question: `How fast can ${trade.toLowerCase()} service be dispatched in ${location}`,
      answer:
        "Priority calls are triaged first. Dispatch windows depend on technician availability, issue severity, and distance from your service zone.",
      keyFacts: [
        "Priority triage based on urgency",
        "Dispatch depends on active zone coverage",
      ],
      sourceLabel: "Dispatch policy",
    },
    {
      question: "What does the initial visit include",
      answer:
        "The first visit confirms symptoms, checks safety risks, defines repair scope, and provides next-step options before major work proceeds.",
      keyFacts: [
        "Scope confirmation before major work",
        "Safety checks included in triage",
      ],
      sourceLabel: "Field workflow",
    },
    {
      question: "Do you provide clear pricing before work starts",
      answer:
        "Yes. Pricing is presented after diagnostics and scope confirmation, with options tied to the actual condition found onsite.",
      keyFacts: [
        "Pricing shown after diagnostics",
        "No scope assumptions before onsite review",
      ],
      sourceLabel: "Pricing standard",
    },
  ];

  const normalizedItems = (
    content?.items?.length ? content.items : fallbackItems
  )
    .slice(0, Math.max(1, maxItems))
    .map((item) => ({
      ...item,
      question: normalizeQuestion(item.question),
      answer: normalizeAnswer(item.answer, Math.max(20, maxAnswerWords)),
      keyFacts: (item.keyFacts ?? [])
        .map(collapseWhitespace)
        .filter(Boolean)
        .slice(0, 4),
      sourceLabel: item.sourceLabel
        ? collapseWhitespace(item.sourceLabel)
        : undefined,
      lastUpdated: item.lastUpdated
        ? collapseWhitespace(item.lastUpdated)
        : undefined,
    }));

  const eyebrow = content?.eyebrow ?? "Answer-First AEO";
  const sectionHeadline = content?.headline ?? `Answer-First ${trade} Q&A`;
  const sectionIntro =
    content?.intro ??
    `Direct answers for high-intent ${trade.toLowerCase()} questions in ${location}. Each response is concise, factual, and structured for fast scanning.`;

  return (
    <section
      className="py-16 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--brand-background)" }}
      aria-label="Answer-first service questions"
    >
      {includeJsonLd && normalizedItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(toFaqJsonLd(normalizedItems)),
          }}
        />
      )}

      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p
            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{
              backgroundColor: "var(--brand-accent)",
              color: "var(--brand-primary)",
            }}
          >
            {eyebrow}
          </p>
          <h2
            className="mt-3 font-brand-heading text-3xl sm:text-4xl font-bold"
            style={{ color: "var(--brand-text)" }}
          >
            {sectionHeadline}
          </h2>
          <p
            className="mt-3 font-brand-body text-base sm:text-lg max-w-3xl"
            style={{ color: "var(--brand-text)", opacity: 0.76 }}
          >
            {sectionIntro}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {normalizedItems.map((item, index) => (
            <article
              key={`${item.question}-${index}`}
              className="rounded-2xl border p-5"
              style={{
                borderColor: "var(--brand-accent)",
                backgroundColor: "rgba(255,255,255,0.9)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--brand-primary)" }}
              >
                Question
              </p>
              <h3
                className="mt-2 font-brand-heading text-lg font-semibold leading-snug"
                style={{ color: "var(--brand-text)" }}
              >
                {item.question}
              </h3>

              <p
                className="mt-4 text-xs font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--brand-primary)" }}
              >
                Direct Answer
              </p>
              <p
                className="mt-2 font-brand-body text-sm leading-relaxed"
                style={{ color: "var(--brand-text)", opacity: 0.82 }}
              >
                {item.answer}
              </p>

              {item.keyFacts && item.keyFacts.length > 0 && (
                <div className="mt-4">
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Key Facts
                  </p>
                  <ul className="mt-2 space-y-2">
                    {item.keyFacts.map((fact) => (
                      <li
                        key={fact}
                        className="rounded-lg border px-3 py-2 text-sm"
                        style={{
                          borderColor: "var(--brand-accent)",
                          color: "var(--brand-text)",
                        }}
                      >
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(item.sourceLabel || item.lastUpdated) && (
                <div
                  className="mt-4 flex flex-wrap gap-2 text-xs"
                  style={{ color: "var(--brand-text)", opacity: 0.65 }}
                >
                  {item.sourceLabel && (
                    <span
                      className="rounded-full border px-2.5 py-1"
                      style={{ borderColor: "var(--brand-accent)" }}
                    >
                      Source: {item.sourceLabel}
                    </span>
                  )}
                  {item.lastUpdated && (
                    <span
                      className="rounded-full border px-2.5 py-1"
                      style={{ borderColor: "var(--brand-accent)" }}
                    >
                      Updated: {item.lastUpdated}
                    </span>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
