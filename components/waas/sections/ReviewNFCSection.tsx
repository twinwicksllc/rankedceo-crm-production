// =============================================================================
// WaaS Phase 4: ReviewNFCSection
// Google Reviews display + NFC tool promotion
// =============================================================================

import type { ResolvedTenant, SectionConfig } from '@/lib/waas/templates/types'

interface ReviewNFCSectionProps {
  tenant: ResolvedTenant
  config: SectionConfig['config']
}

// Sample review placeholders (in production, pulled from Google API)
const PLACEHOLDER_REVIEWS = [
  {
    id:      '1',
    author:  'Michael T.',
    rating:  5,
    text:    'Absolutely phenomenal service! They showed up on time, diagnosed the problem quickly, and had it fixed within the hour. Will definitely use them again.',
    date:    '2 weeks ago',
    avatar:  'M',
  },
  {
    id:      '2',
    author:  'Sarah K.',
    rating:  5,
    text:    'I cannot say enough great things about this company. Professional, courteous, and their pricing was very fair. Highly recommend!',
    date:    '1 month ago',
    avatar:  'S',
  },
  {
    id:      '3',
    author:  'James R.',
    rating:  5,
    text:    'Best in the business. They handled a complicated job with ease and kept me informed every step of the way. 5 stars without hesitation.',
    date:    '3 weeks ago',
    avatar:  'J',
  },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(star => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export function ReviewNFCSection({ tenant, config }: ReviewNFCSectionProps) {
  const showNFC      = config.showNFC !== false
  const variant      = (config.variant as string) ?? 'standard'
  const businessName = tenant.brand_config.business_name ?? tenant.legal_name ?? 'Us'
  const googleUrl    = tenant.brand_config.social?.google ?? '#'
  const isProminent  = variant === 'prominent'

  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundColor: isProminent ? 'var(--brand-accent)' : 'var(--brand-background)',
      }}
      aria-label="Reviews and social proof"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span
            className="inline-block text-sm font-semibold uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full"
            style={{
              backgroundColor: isProminent ? 'white' : 'var(--brand-accent)',
              color:           'var(--brand-primary)',
            }}
          >
            Customer Reviews
          </span>
          <h2
            className="font-brand-heading text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: 'var(--brand-text)' }}
          >
            What Our Customers Say
          </h2>

          {/* Aggregate rating */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <StarRating rating={5} />
            <span
              className="font-brand-heading text-2xl font-bold"
              style={{ color: 'var(--brand-text)' }}
            >
              5.0
            </span>
            <span
              className="font-brand-body text-sm"
              style={{ color: 'var(--brand-text)', opacity: 0.6 }}
            >
              · 100+ Google Reviews
            </span>
          </div>

          {/* Google review link */}
          {googleUrl !== '#' && (
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium mt-2 hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              See all reviews on Google
            </a>
          )}
        </div>

        {/* Review cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PLACEHOLDER_REVIEWS.map(review => (
            <div
              key={review.id}
              className="p-6 rounded-2xl bg-white shadow-sm border"
              style={{ borderColor: 'var(--brand-accent)' }}
            >
              <div className="flex items-start gap-3 mb-4">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                  aria-hidden="true"
                >
                  {review.avatar}
                </div>
                <div>
                  <div
                    className="font-brand-heading font-semibold text-sm"
                    style={{ color: 'var(--brand-text)' }}
                  >
                    {review.author}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRating rating={review.rating} />
                    <span
                      className="text-xs font-brand-body"
                      style={{ color: 'var(--brand-text)', opacity: 0.5 }}
                    >
                      {review.date}
                    </span>
                  </div>
                </div>
              </div>
              <p
                className="font-brand-body text-sm leading-relaxed"
                style={{ color: 'var(--brand-text)', opacity: 0.75 }}
              >
                &ldquo;{review.text}&rdquo;
              </p>
            </div>
          ))}
        </div>

        {/* NFC Tool Promotion */}
        {showNFC && (
          <div
            className="relative overflow-hidden rounded-2xl p-8 sm:p-12 text-center"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }} />

            <div className="relative z-10">
              <div className="text-5xl mb-4" aria-hidden="true">📲</div>
              <h3 className="font-brand-heading text-2xl sm:text-3xl font-bold text-white mb-3">
                Leave Us a Google Review
              </h3>
              <p className="font-brand-body text-white/70 text-lg max-w-xl mx-auto mb-8">
                Happy with our service? Tap our NFC card or scan the QR code to leave
                a quick review. It only takes 30 seconds and means the world to us.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {googleUrl !== '#' && (
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white font-semibold hover:bg-white/90 transition-colors"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    ⭐ Write a Google Review
                  </a>
                )}
                <a
                  href={`https://g.page/r/${businessName.toLowerCase().replace(/\s+/g, '-')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-white text-white font-semibold hover:bg-white/10 transition-colors"
                >
                  📲 Tap NFC Card
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}