// =============================================================================
// WaaS Phase 4: HeroSection
// Displays the SVG Textmark (or logo) + USP headline + primary CTA
// Supports 'centered' and 'split' variants
// Phase 7.2: Supports brand_config.hero_image_url full-bleed background photo
//   with a semi-transparent dark scrim to keep text legible
// =============================================================================

import Image from "next/image";
import type {
  HeroSectionContent,
  ResolvedTenant,
  SectionConfig,
} from "@/lib/waas/templates/types";
import {
  generateTextmarkSvg,
  svgToDataUrl,
} from "@/lib/waas/utils/generate-textmark";
import { getBrandColor } from "@/lib/waas/utils/theme";

interface HeroSectionProps {
  tenant: ResolvedTenant;
  config: SectionConfig["config"];
  content?: HeroSectionContent;
}

export function HeroSection({ tenant, config, content }: HeroSectionProps) {
  const { brand_config } = tenant;
  const variant = (config.variant as string) ?? "centered";
  const showTextmark = config.showTextmark !== false;

  const businessName =
    brand_config.business_name ?? tenant.legal_name ?? "Your Business";
  const tagline =
    content?.headline ??
    brand_config.tagline ??
    tenant.usp ??
    "Professional Services You Can Trust";
  const subheadline =
    content?.subheadline ??
    `Trusted ${tenant.primary_trade ?? tenant.target_industry ?? "service"} professionals serving ${tenant.target_location ?? "your local area"}.`;
  const phone = brand_config.contact?.phone;
  const primaryColor = getBrandColor(brand_config, "primary");

  // Phase 7.2: hero background image
  const heroImageUrl = brand_config.hero_image_url ?? null;
  const hasHeroImage = Boolean(heroImageUrl);

  // Generate textmark or use uploaded logo
  const logoSrc =
    brand_config.logo_url ??
    (showTextmark
      ? svgToDataUrl(generateTextmarkSvg(businessName, primaryColor))
      : null);

  const calendlyUrl = tenant.calendly_url;

  if (variant === "split") {
    return (
      <section
        className="relative min-h-[90vh] flex items-center overflow-hidden"
        style={hasHeroImage ? {} : { backgroundColor: "var(--brand-primary)" }}
        aria-label="Hero"
      >
        {/* Hero background image (Phase 7.2) */}
        {hasHeroImage && (
          <>
            <Image
              src={heroImageUrl!}
              alt=""
              fill
              className="object-cover object-center"
              priority
              sizes="100vw"
            />
            {/* Dark scrim for text legibility */}
            <div className="absolute inset-0 bg-black/55" />
          </>
        )}

        {/* Background pattern (only when no hero image) */}
        {!hasHeroImage && (
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "32px 32px",
            }}
          />
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-white">
              {logoSrc && (
                <div className="mb-8">
                  <Image
                    src={logoSrc}
                    alt={`${businessName} logo`}
                    width={240}
                    height={64}
                    className="h-16 w-auto object-contain"
                    priority
                  />
                </div>
              )}
              <h1 className="font-brand-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                {tagline}
              </h1>
              <p className="font-brand-body text-xl text-white/80 mb-8 max-w-lg">
                {subheadline}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                {calendlyUrl ? (
                  <a
                    href={calendlyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl text-white border-2 border-white hover:bg-white/10 transition-colors"
                  >
                    📅 {content?.primaryCtaLabel ?? "Book a Free Estimate"}
                  </a>
                ) : null}
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\D/g, "")}`}
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl bg-white text-brand-primary hover:bg-white/90 transition-colors"
                  >
                    📞 {phone}
                  </a>
                )}
              </div>
            </div>

            {/* Right: Visual accent (only when no hero image) */}
            {!hasHeroImage && (
              <div className="hidden lg:flex items-center justify-center">
                <div
                  className="w-80 h-80 rounded-full opacity-20"
                  style={{ backgroundColor: "var(--brand-secondary)" }}
                />
                <div
                  className="absolute w-64 h-64 rounded-full opacity-30"
                  style={{ backgroundColor: "var(--brand-accent)" }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Default: centered variant
  return (
    <section
      className="relative min-h-[85vh] flex items-center justify-center text-center overflow-hidden"
      style={hasHeroImage ? {} : { backgroundColor: "var(--brand-background)" }}
      aria-label="Hero"
    >
      {/* Hero background image (Phase 7.2) */}
      {hasHeroImage && (
        <>
          <Image
            src={heroImageUrl!}
            alt=""
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          {/* Dark scrim */}
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}

      {/* Subtle gradient overlay (only without hero image) */}
      {!hasHeroImage && (
        <div
          className="absolute inset-0 opacity-5"
          style={{
            background: `linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)`,
          }}
        />
      )}

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {logoSrc && (
          <div className="flex justify-center mb-10">
            <Image
              src={logoSrc}
              alt={`${businessName} logo`}
              width={280}
              height={80}
              className="h-20 w-auto object-contain"
              priority
            />
          </div>
        )}

        <h1
          className="font-brand-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
          style={{ color: hasHeroImage ? "#ffffff" : "var(--brand-text)" }}
        >
          {tagline}
        </h1>

        <p
          className="font-brand-body text-xl mb-10 max-w-2xl mx-auto"
          style={{
            color: hasHeroImage
              ? "rgba(255,255,255,0.85)"
              : "var(--brand-text)",
            opacity: hasHeroImage ? 1 : 0.7,
          }}
        >
          {subheadline}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {calendlyUrl ? (
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl text-white transition-opacity hover:opacity-90"
              style={{
                backgroundColor: hasHeroImage
                  ? "rgba(255,255,255,0.2)"
                  : "var(--brand-primary)",
                border: hasHeroImage ? "2px solid white" : "none",
              }}
            >
              📅 {content?.primaryCtaLabel ?? "Book a Free Estimate"}
            </a>
          ) : null}
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, "")}`}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl border-2 transition-colors hover:opacity-90"
              style={{
                borderColor: hasHeroImage ? "white" : "var(--brand-primary)",
                color: hasHeroImage ? "white" : "var(--brand-primary)",
                backgroundColor: hasHeroImage
                  ? "rgba(0,0,0,0.2)"
                  : "transparent",
              }}
            >
              📞 {phone}
            </a>
          )}
        </div>

        {/* Location badge */}
        {tenant.target_location && (
          <p
            className="mt-8 text-sm font-medium"
            style={{
              color: hasHeroImage
                ? "rgba(255,255,255,0.7)"
                : "var(--brand-text)",
              opacity: hasHeroImage ? 1 : 0.5,
            }}
          >
            📍{" "}
            {content?.locationBadge ??
              `Proudly serving ${tenant.target_location}`}
          </p>
        )}
      </div>
    </section>
  );
}
