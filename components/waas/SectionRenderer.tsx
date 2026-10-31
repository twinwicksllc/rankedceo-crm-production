// =============================================================================
// WaaS Phase 4: SectionRenderer
// Dynamically loops through enabled sections and renders them in order
// =============================================================================

import type {
  AboutSectionContent,
  AnswerFirstAEOSectionContent,
  BentoEmergencySectionContent,
  BookingSectionContent,
  FAQSectionContent,
  GallerySectionContent,
  HeroSectionContent,
  HowItWorksSectionContent,
  ResolvedTenant,
  ReviewsSectionContent,
  SectionConfig,
  ServicesSectionContent,
  TenantSiteConfig,
  TrustSectionContent,
} from "@/lib/waas/templates/types";
import { HeroSection } from "@/components/waas/sections/HeroSection";
import { AnswerFirstAEOSection } from "@/components/waas/sections/AnswerFirstAEOSection";
import { BentoEmergencySection } from "@/components/waas/sections/BentoEmergencySection";
import { ServiceGrid } from "@/components/waas/sections/ServiceGrid";
import { TrustBar } from "@/components/waas/sections/TrustBar";
import { FinancingBlock } from "@/components/waas/sections/FinancingBlock";
import { BookingSection } from "@/components/waas/sections/BookingSection";
import { ReviewNFCSection } from "@/components/waas/sections/ReviewNFCSection";
import { AboutSection } from "@/components/waas/sections/AboutSection";
import { FAQSection } from "@/components/waas/sections/FAQSection";
import { HowItWorksSection } from "@/components/waas/sections/HowItWorksSection";
import { GallerySection } from "@/components/waas/sections/GallerySection";
import { signSiteLeadToken } from "@/lib/waas/lead-form-token";
import {
  bookingFormMode,
  resolveBookingFormSettings,
} from "@/lib/waas/booking-form-config";

interface SectionRendererProps {
  tenant: ResolvedTenant;
  sections: SectionConfig[];
  siteConfig: TenantSiteConfig | null;
  /**
   * True for owner and admin previews. Previews never receive a lead-form token,
   * so a preview cannot create real leads, even for an active tenant.
   */
  previewMode?: boolean;
}

// ---------------------------------------------------------------------------
// Render a single section by id
// ---------------------------------------------------------------------------

function renderSection(
  section: SectionConfig,
  tenant: ResolvedTenant,
  previewMode: boolean,
): React.ReactNode {
  const props = { tenant, config: section.config };

  switch (section.section) {
    case "hero":
      return (
        <HeroSection
          key={`hero-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as HeroSectionContent | undefined}
        />
      );
    case "answer-first-aeo":
      return (
        <AnswerFirstAEOSection
          key={`answer-first-aeo-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as AnswerFirstAEOSectionContent | undefined}
        />
      );
    case "bento-emergency":
      return (
        <BentoEmergencySection
          key={`bento-emergency-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as BentoEmergencySectionContent | undefined}
        />
      );
    case "services":
      return (
        <ServiceGrid
          key={`services-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as ServicesSectionContent | undefined}
        />
      );
    case "trust":
      return (
        <TrustBar
          key={`trust-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as TrustSectionContent | undefined}
        />
      );
    case "financing":
      return <FinancingBlock key={`financing-${section.order}`} {...props} />;
    case "booking": {
      // B5: the lead form. Signed here, on the server, so the browser can only
      // submit for the tenant this page was rendered for.
      const token = previewMode ? null : signSiteLeadToken(tenant.id);
      const formMode = previewMode
        ? resolveBookingFormSettings(section.config).enabled
          ? "preview"
          : "off"
        : bookingFormMode({
            settingsEnabled: resolveBookingFormSettings(section.config).enabled,
            tenantStatus: tenant.status,
            hasToken: token !== null,
          });
      return (
        <BookingSection
          key={`booking-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as BookingSectionContent | undefined}
          formMode={formMode}
          siteLeadToken={formMode === "live" ? token : null}
        />
      );
    }
    case "reviews":
      return (
        <ReviewNFCSection
          key={`reviews-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as ReviewsSectionContent | undefined}
        />
      );
    case "about":
      return (
        <AboutSection
          key={`about-${section.order}`}
          tenant={tenant}
          content={section.content as AboutSectionContent | undefined}
        />
      );
    case "faq":
      return (
        <FAQSection
          key={`faq-${section.order}`}
          tenant={tenant}
          content={section.content as FAQSectionContent | undefined}
        />
      );
    case "how-it-works":
      return (
        <HowItWorksSection
          key={`how-it-works-${section.order}`}
          tenant={tenant}
          content={section.content as HowItWorksSectionContent | undefined}
        />
      );
    case "gallery":
      return (
        <GallerySection
          key={`gallery-${section.order}`}
          tenant={tenant}
          config={section.config}
          content={section.content as GallerySectionContent | undefined}
        />
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// SectionRenderer — loops through sections, renders enabled ones in order
// ---------------------------------------------------------------------------

export function SectionRenderer({
  tenant,
  sections,
  siteConfig,
  previewMode = false,
}: SectionRendererProps) {
  const enabledSections = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledSections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">No sections configured for this site.</p>
      </div>
    );
  }

  return (
    <main id="main-content">
      {enabledSections.map((section) =>
        renderSection(section, tenant, previewMode),
      )}

      {/* Custom CSS injection */}
      {siteConfig?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: siteConfig.custom_css }} />
      )}
    </main>
  );
}
