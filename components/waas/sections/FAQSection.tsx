import type {
  FAQSectionContent,
  ResolvedTenant,
} from "@/lib/waas/templates/types";
import { buildFaqFallbackItems } from "@/lib/waas/utils/faq-jsonld";

interface FAQSectionProps {
  tenant: ResolvedTenant;
  content?: FAQSectionContent;
}

// NOTE: This section intentionally does not render its own FAQPage JSON-LD.
// Structured data for FAQ-style sections (this section and
// `answer-first-aeo`) is collected and emitted exactly once, page-wide, by
// `collectFaqItemsFromSections()` in `app/_sites/[site]/page.tsx` — see 
// AEO/Bento audit finding 1.2 and `lib/waas/utils/faq-jsonld.ts`. Do not add
// a `<script type="application/ld+json">` here; doing so would reintroduce
// the duplicate-FAQPage-node risk this fix eliminates.
//
// The default `items` below are built from the same `buildFaqFallbackItems()`
// helper the page-level collector uses, so the visible cards and the JSON-LD
// never diverge when a tenant hasn't customized this section's content.

export function FAQSection({ tenant, content }: FAQSectionProps) {
  const trade = tenant.primary_trade ?? tenant.target_industry ?? "service";
  const location = tenant.target_location ?? "our local service area";
  const headline = content?.headline ?? "Frequently Asked Questions";
  const intro =
    content?.intro ??
    `Answers to common questions about our ${trade.toLowerCase()} services.`;
  const items = content?.items ?? buildFaqFallbackItems(trade, location);

  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--brand-accent)" }}
      aria-label="Frequently asked questions"
    >
      <div className="max-w-5xl mx-auto">
        {content?.eyebrow && (
          <p
            className="text-xs uppercase tracking-[0.18em] mb-3"
            style={{ color: "var(--brand-primary)" }}
          >
            {content.eyebrow}
          </p>
        )}

        <h2
          className="font-brand-heading text-3xl sm:text-4xl font-bold mb-3"
          style={{ color: "var(--brand-text)" }}
        >
          {headline}
        </h2>
        <p
          className="font-brand-body text-base mb-8"
          style={{ color: "var(--brand-text)", opacity: 0.72 }}
        >
          {intro}
        </p>

        <div className="space-y-3">
          {items.slice(0, 8).map((item, index) => (
            <div
              key={`${item.question}-${index}`}
              className="rounded-xl border bg-white px-5 py-4"
              style={{ borderColor: "var(--brand-accent)" }}
            >
              <h3
                className="font-brand-heading text-lg font-semibold"
                style={{ color: "var(--brand-text)" }}
              >
                {item.question}
              </h3>
              <p
                className="font-brand-body text-sm mt-2"
                style={{ color: "var(--brand-text)", opacity: 0.75 }}
              >
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
