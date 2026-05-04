import type { FAQSectionContent, ResolvedTenant } from '@/lib/waas/templates/types'

interface FAQSectionProps {
  tenant: ResolvedTenant
  content?: FAQSectionContent
}

export function FAQSection({ tenant, content }: FAQSectionProps) {
  const trade = tenant.primary_trade ?? tenant.target_industry ?? 'service'
  const headline = content?.headline ?? 'Frequently Asked Questions'
  const intro = content?.intro ?? `Answers to common questions about our ${trade.toLowerCase()} services.`
  const items = content?.items ?? [
    {
      question: 'How quickly can you schedule service?',
      answer: 'Most appointments can be scheduled quickly based on current availability and urgency.',
    },
    {
      question: 'Do you provide upfront pricing?',
      answer: 'Yes. We review scope and provide clear pricing before work begins.',
    },
    {
      question: 'What areas do you serve?',
      answer: `We serve ${tenant.target_location ?? 'our local service area'} and nearby communities.`,
    },
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--brand-accent)' }} aria-label="Frequently asked questions">
      <div className="max-w-5xl mx-auto">
        {content?.eyebrow && (
          <p className="text-xs uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--brand-primary)' }}>
            {content.eyebrow}
          </p>
        )}

        <h2 className="font-brand-heading text-3xl sm:text-4xl font-bold mb-3" style={{ color: 'var(--brand-text)' }}>
          {headline}
        </h2>
        <p className="font-brand-body text-base mb-8" style={{ color: 'var(--brand-text)', opacity: 0.72 }}>
          {intro}
        </p>

        <div className="space-y-3">
          {items.slice(0, 8).map((item, index) => (
            <div key={`${item.question}-${index}`} className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: 'var(--brand-accent)' }}>
              <h3 className="font-brand-heading text-lg font-semibold" style={{ color: 'var(--brand-text)' }}>
                {item.question}
              </h3>
              <p className="font-brand-body text-sm mt-2" style={{ color: 'var(--brand-text)', opacity: 0.75 }}>
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
