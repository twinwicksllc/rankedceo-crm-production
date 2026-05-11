// =============================================================================
// WaaS Phase 7.3: GallerySection
// Responsive photo gallery rendered on the live tenant site.
//
// Renders a 2–4 column masonry-style grid of images with optional captions.
// Each image slot is stored in sections_json as:
//   content.items[n].image_url  — required
//   content.items[n].caption    — optional
//   content.items[n].alt        — optional (accessibility)
//
// The `columns` config key controls the max column count (default: 3).
// Empty slots (no image_url) are silently skipped.
// =============================================================================

import Image from 'next/image'
import type { GallerySectionContent, ResolvedTenant, SectionConfig } from '@/lib/waas/templates/types'

interface GallerySectionProps {
  tenant:   ResolvedTenant
  config:   SectionConfig['config']
  content?: GallerySectionContent
}

export function GallerySection({ tenant, config, content }: GallerySectionProps) {
  const businessName = tenant.brand_config.business_name ?? tenant.legal_name ?? 'Business'
  const columns      = (config.columns as number | undefined) ?? 3
  const eyebrow      = content?.eyebrow  ?? 'Our Work'
  const headline     = content?.headline ?? `${businessName} in Action`

  // Filter out items without an image_url
  const items = (content?.items ?? []).filter((item) => Boolean(item?.image_url))

  // Choose a Tailwind grid class based on columns config
  const gridClass =
    columns >= 4 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' :
    columns === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section
      className="py-16 sm:py-24"
      style={{ backgroundColor: 'var(--brand-background)' }}
      aria-label="Photo gallery"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          {eyebrow && (
            <p
              className="font-brand-body text-sm font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'var(--brand-primary)' }}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className="font-brand-heading text-3xl sm:text-4xl font-bold"
            style={{ color: 'var(--brand-text)' }}
          >
            {headline}
          </h2>
        </div>

        {/* Gallery grid */}
        {items.length === 0 ? (
          // Empty state — admin hint
          <div
            className="rounded-xl border-2 border-dashed border-current/20 p-12 text-center"
            style={{ color: 'var(--brand-text)', opacity: 0.4 }}
          >
            <p className="text-lg font-medium">Gallery photos coming soon</p>
            <p className="text-sm mt-1">Photos will be added by your website team.</p>
          </div>
        ) : (
          <div className={`grid ${gridClass} gap-4`}>
            {items.map((item, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-xl bg-slate-100 aspect-square"
              >
                <Image
                  src={item.image_url}
                  alt={item.alt ?? item.caption ?? `${businessName} photo ${i + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes={
                    columns >= 4
                      ? '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
                      : columns === 2
                      ? '(max-width: 640px) 100vw, 50vw'
                      : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                  }
                />
                {/* Caption overlay */}
                {item.caption && (
                  <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-black/60 px-3 py-2">
                    <p className="font-brand-body text-white text-sm truncate">
                      {item.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
