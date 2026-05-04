import type { AboutSectionContent, ResolvedTenant } from '@/lib/waas/templates/types'

interface AboutSectionProps {
  tenant: ResolvedTenant
  content?: AboutSectionContent
}

export function AboutSection({ tenant, content }: AboutSectionProps) {
  const brandConfig = tenant.brand_config
  const businessName = brandConfig.business_name ?? tenant.legal_name ?? 'Our Team'
  const onboardingContent = ((brandConfig as unknown as Record<string, unknown>).content) as Record<string, unknown> | undefined
  const fallbackBody = typeof onboardingContent?.about_narrative === 'string'
    ? onboardingContent.about_narrative
    : `We are proud to serve ${tenant.target_location ?? 'our local community'} with honest work and consistent results.`

  const headline = content?.headline ?? `About ${businessName}`
  const body = content?.body ?? fallbackBody
  const highlights = content?.highlights ?? [
    'Locally focused team',
    'Transparent communication',
    'Quality-first execution',
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--brand-background)' }} aria-label="About us">
      <div className="max-w-5xl mx-auto">
        {content?.eyebrow && (
          <p className="text-xs uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--brand-primary)' }}>
            {content.eyebrow}
          </p>
        )}

        <h2 className="font-brand-heading text-3xl sm:text-4xl font-bold mb-5" style={{ color: 'var(--brand-text)' }}>
          {headline}
        </h2>

        <p className="font-brand-body text-lg leading-relaxed mb-8" style={{ color: 'var(--brand-text)', opacity: 0.75 }}>
          {body}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {highlights.slice(0, 6).map((item) => (
            <div key={item} className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-text)' }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
