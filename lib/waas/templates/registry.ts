// =============================================================================
// WaaS Template Registry — PR #92
// 10 templates covering the full range of local service business aesthetics.
//
// Each template specifies:
//   • Section layout + order + default config
//   • Aesthetic category + mood (for the template picker UI)
//   • Industry fit lists (drives "Recommended for you" shortlisting)
//   • SEO strategy (tells the AI generator how to weight keyword placement)
//   • schema.org types to emit (LocalBusiness, Plumber, etc.)
//   • Feature highlights (shown on template card, max 4 bullets)
//   • Preview palette (representative colours for card thumbnails)
//
// IMPORTANT: All section layouts are designed with SEO-first principles:
//   - Hero: H1 with location + trade keyword
//   - Services: H2 per service item (keyword-rich)
//   - About: H2 + structured NAP data
//   - FAQ: H2 + structured FAQ schema eligible content
//   - Trust: E-E-A-T signals (years in business, licences, reviews)
// =============================================================================

import type { SiteTemplate, SectionConfig } from "@/lib/waas/templates/types";

const NOW = new Date().toISOString();

// ---------------------------------------------------------------------------
// Helper — normalise section order so numbers are always sequential
// ---------------------------------------------------------------------------

function ordered(sections: SectionConfig[]): SectionConfig[] {
  return sections.map((s, i) => ({ ...s, order: i + 1 }));
}

// =============================================================================
// 1. MODERN MINIMAL
// Clean, whitespace-forward, professional. Universal default.
// SEO: local-service — location + trade H1, prominent NAP, reviews.
// =============================================================================

const modernSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "centered", showTextmark: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 4, maxAnswerWords: 60, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Fast Answers Before the Scroll",
      intro:
        "Concise, factual Q&A blocks designed for high-intent search and AI overview extraction.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "calm",
      responseMinutes: 60,
      dispatchFee: 79,
      operatingHours: "Extended Hours Dispatch",
    },
    content: {
      eyebrow: "Fast Local Support",
      headline: "Mobile-First Service Grid for Everyday Urgency",
      subheadline:
        "Clear options, direct phone dispatch, and practical response windows for homeowners who need help without friction.",
      bottomCtaText:
        "Switch to emergency mode when service interruption cannot wait.",
      items: [
        {
          icon: "Dispatch",
          title: "Fast Intake",
          description:
            "One screen for triage details, symptoms, and immediate call routing.",
        },
        {
          icon: "Coverage",
          title: "Service Area Match",
          description:
            "Verify location fit first so response windows stay accurate.",
        },
        {
          icon: "Pricing",
          title: "Upfront Dispatch Fee",
          description:
            "Clear fee visibility before technician assignment begins.",
        },
        {
          icon: "Follow-Up",
          title: "Status Confirmation",
          description:
            "Receive dispatch confirmation and expected arrival updates.",
        },
      ],
    },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "badge-row" },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 3, showIcons: true },
  },
  { section: "about", enabled: true, order: 0, config: {} },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "inline" },
  },
  { section: "reviews", enabled: true, order: 0, config: { showNFC: true } },
  { section: "faq", enabled: false, order: 0, config: {} },
  { section: "how-it-works", enabled: false, order: 0, config: {} },
  { section: "financing", enabled: false, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// 2. BOLD IMPACT
// High-contrast, aggressive CTAs, dark accent sections.
// SEO: local-service + emergency — urgency + location signals, strong CTAs.
// =============================================================================

const boldSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "split", showTextmark: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 4, maxAnswerWords: 55, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Urgency Answers in Plain Terms",
      intro:
        "No filler, no fluff: direct Q&A content for fast decision-making under service urgency.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "signal",
      responseMinutes: 35,
      dispatchFee: 99,
      operatingHours: "24/7 Priority Support",
    },
    content: {
      eyebrow: "Rapid Response Lane",
      headline: "High-Contrast Emergency Dispatch Grid",
      subheadline:
        "Built for speed-first visitors who need immediate triage, technician routing, and one-tap escalation.",
      bottomCtaText:
        "Emergency mode promotes your request to the front of dispatch.",
      items: [
        {
          icon: "Priority",
          title: "Escalation Intake",
          description:
            "Route critical failures to the first available dispatcher instantly.",
        },
        {
          icon: "Hazard",
          title: "Safety-First Triage",
          description:
            "Capture hazard indicators before technician deployment.",
        },
        {
          icon: "ETA",
          title: "Rapid ETA Window",
          description:
            "Display realistic fast-response windows for urgent calls.",
        },
        {
          icon: "Queue",
          title: "Priority Queue",
          description: "Emergency toggle moves requests into the urgency lane.",
        },
      ],
    },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 2, showIcons: true },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "full-width" },
  },
  { section: "how-it-works", enabled: true, order: 0, config: {} },
  { section: "financing", enabled: true, order: 0, config: {} },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "modal-trigger" },
  },
  { section: "reviews", enabled: true, order: 0, config: { showNFC: true } },
  { section: "faq", enabled: false, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// 3. TRUST FIRST
// Social proof-heavy, reviews + credentials up front.
// SEO: trust-authority — E-E-A-T signals, review schema, credentials.
// =============================================================================

const trustFirstSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "centered", showTextmark: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 5, maxAnswerWords: 65, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Trust-Centered Service Answers",
      intro:
        "Structured question-and-answer cards focused on accuracy, process clarity, and expectation setting.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "calm",
      responseMinutes: 50,
      dispatchFee: 89,
      operatingHours: "Priority Support Window",
    },
    content: {
      eyebrow: "Trust-Led Dispatch",
      headline: "Answer-First Emergency Routing with Clear Expectations",
      subheadline:
        "Show clients exactly how quickly you respond, what dispatch includes, and how priority intake works.",
      bottomCtaText:
        "Use emergency mode for urgent failures that need same-window response.",
      items: [
        {
          icon: "Verified",
          title: "Credentialed Intake",
          description:
            "Signal licensed handling from first contact through dispatch.",
        },
        {
          icon: "Scope",
          title: "Clear Scope Check",
          description:
            "Set expectations before arrival with concise triage prompts.",
        },
        {
          icon: "Window",
          title: "Real Response Window",
          description:
            "Share practical timing so customers can plan with confidence.",
        },
        {
          icon: "Assurance",
          title: "Follow-Through",
          description:
            "Post-dispatch confirmation reinforces reliability and trust.",
        },
      ],
    },
  },
  {
    section: "reviews",
    enabled: true,
    order: 0,
    config: { showNFC: true, variant: "prominent" },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "badge-row" },
  },
  { section: "about", enabled: true, order: 0, config: {} },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 3, showIcons: true },
  },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "inline" },
  },
  { section: "faq", enabled: true, order: 0, config: {} },
  { section: "financing", enabled: false, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// 4. LOCAL PRO
// Friendly neighbourhood feel, service-area + location emphasis.
// SEO: local-service — "[City] + trade" clusters, geo signals, NAP schema.
// =============================================================================

const localProSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: {
      variant: "centered",
      showTextmark: true,
      locationBadgeVisible: true,
    },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 5, maxAnswerWords: 60, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Neighborhood Questions, Direct Answers",
      intro:
        "Local-service Q&A designed to answer practical homeowner concerns without generic marketing language.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "warm",
      responseMinutes: 55,
      dispatchFee: 85,
      operatingHours: "Local Priority Dispatch",
    },
    content: {
      eyebrow: "Neighborhood Priority",
      headline: "Community-Focused Emergency Service Grid",
      subheadline:
        "Friendly intake with clear urgency levels, realistic ETAs, and direct phone routing for local households.",
      bottomCtaText:
        "Emergency mode alerts dispatch to prioritize immediate neighborhood calls.",
      items: [
        {
          icon: "Local",
          title: "Neighborhood Routing",
          description:
            "Dispatch nearest available tech for community-first response.",
        },
        {
          icon: "Family",
          title: "Plain-Language Triage",
          description:
            "Simple prompts help households explain urgent issues quickly.",
        },
        {
          icon: "ETA",
          title: "Street-Level ETAs",
          description: "Estimate windows based on local zone coverage.",
        },
        {
          icon: "Care",
          title: "Aftercare Follow-Up",
          description:
            "Confirm stabilization and next-step recommendations after service.",
        },
      ],
    },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "badge-row" },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 3, showIcons: true },
  },
  {
    section: "about",
    enabled: true,
    order: 0,
    config: { showOwnerPhoto: true },
  },
  { section: "reviews", enabled: true, order: 0, config: { showNFC: true } },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "inline" },
  },
  { section: "faq", enabled: true, order: 0, config: {} },
  { section: "how-it-works", enabled: false, order: 0, config: {} },
  { section: "financing", enabled: false, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// 5. PREMIUM SERVICE
// Editorial, serif-influenced, refined — positions business as high-end.
// SEO: trust-authority — expertise, portfolio schema, gallery alt-text.
// =============================================================================

const premiumSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "editorial", showTextmark: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 4, maxAnswerWords: 65, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Concierge-Level Clarity in Q&A",
      intro:
        "Well-structured, factual answers that help high-intent clients assess urgency and service fit quickly.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "premium",
      responseMinutes: 50,
      dispatchFee: 129,
      operatingHours: "Concierge Dispatch Hours",
    },
    content: {
      eyebrow: "Concierge Priority",
      headline: "Premium Emergency Intake with Structured Triage",
      subheadline:
        "High-touch intake that clarifies scope, response timing, and escalation path before technician arrival.",
      bottomCtaText:
        "Enable emergency mode for concierge-priority dispatch handling.",
      items: [
        {
          icon: "Concierge",
          title: "White-Glove Intake",
          description:
            "Refined triage flow captures urgency and property context.",
        },
        {
          icon: "Options",
          title: "Tiered Response Paths",
          description: "Present premium and standard response options clearly.",
        },
        {
          icon: "Control",
          title: "Coordinator Support",
          description:
            "Dedicated dispatch coordination for high-value urgent jobs.",
        },
        {
          icon: "Report",
          title: "Executive Summary",
          description:
            "Receive concise status updates from dispatch to completion.",
        },
      ],
    },
  },
  { section: "about", enabled: true, order: 0, config: { variant: "story" } },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 2, showIcons: true, variant: "cards-large" },
  },
  {
    section: "gallery",
    enabled: true,
    order: 0,
    config: { columns: 3, variant: "masonry" },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "badge-row" },
  },
  {
    section: "reviews",
    enabled: true,
    order: 0,
    config: { showNFC: true, variant: "testimonials" },
  },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "consultation" },
  },
  { section: "faq", enabled: false, order: 0, config: {} },
  { section: "how-it-works", enabled: false, order: 0, config: {} },
  { section: "financing", enabled: false, order: 0, config: {} },
]);

// =============================================================================
// 6. 24/7 EMERGENCY RESPONSE
// Urgency-first, phone number dominant, fast-response badge.
// SEO: emergency — "emergency [trade] [city]" keywords, 24/7 schema signals.
// =============================================================================

const emergencySections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "emergency", showTextmark: true, stickyPhone: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 4, maxAnswerWords: 50, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Critical Failure Q&A",
      intro:
        "Immediate, factual responses to urgent service scenarios so users can decide and act in seconds.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "signal",
      responseMinutes: 45,
      dispatchFee: 89,
      operatingHours: "24/7 Priority Support",
    },
    content: {
      eyebrow: "24/7 Emergency Desk",
      headline: "Urgency-First Response Grid for Critical Service Failures",
      subheadline:
        "Designed for outage and hazard scenarios with immediate triage and direct escalation to available technicians.",
      bottomCtaText:
        "Emergency mode activates priority queue and fastest available dispatch lane.",
      items: [
        {
          icon: "24/7",
          title: "Always-On Intake",
          description:
            "Around-the-clock triage for outage, leak, and hazard events.",
        },
        {
          icon: "Critical",
          title: "Critical Failure Path",
          description: "Escalate high-risk issues without extra handoffs.",
        },
        {
          icon: "Dispatch",
          title: "Fast Technician Match",
          description:
            "Route to first qualified technician in active coverage zone.",
        },
        {
          icon: "Alert",
          title: "Priority Notifications",
          description:
            "Immediate status updates after emergency lane activation.",
        },
      ],
    },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "full-width", urgencyBadge: true },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 2, showIcons: true },
  },
  {
    section: "how-it-works",
    enabled: true,
    order: 0,
    config: { variant: "steps-numbered" },
  },
  { section: "reviews", enabled: true, order: 0, config: { showNFC: true } },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "modal-trigger", urgencyLabel: true },
  },
  { section: "faq", enabled: true, order: 0, config: {} },
  { section: "about", enabled: true, order: 0, config: {} },
  { section: "financing", enabled: false, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// 7. VISUAL SHOWCASE
// Image/gallery-led, before-and-after focus, portfolio-heavy.
// SEO: visual-portfolio — gallery schema, project alt-text, image SEO.
// =============================================================================

const showcaseSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "full-bleed-gallery", showTextmark: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 5, maxAnswerWords: 60, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Project-Focused Q&A Highlights",
      intro:
        "Skimmable service answers mapped to common project concerns and scope questions.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "showcase",
      responseMinutes: 45,
      dispatchFee: 95,
      operatingHours: "Photo-Verified Dispatch Hours",
    },
    content: {
      eyebrow: "Project-Ready Response",
      headline: "Visual-First Emergency Grid with Rapid Triage",
      subheadline:
        "Pair urgent intake with clear work categories so customers can identify scope and call the right lane quickly.",
      bottomCtaText:
        "Emergency mode is best for active leaks, failures, and service interruptions.",
      items: [
        {
          icon: "Visual",
          title: "Scope by Category",
          description:
            "Group emergency requests by clear project-style categories.",
        },
        {
          icon: "Capture",
          title: "Photo-Aware Intake",
          description: "Structured prompts align with visual issue reporting.",
        },
        {
          icon: "Route",
          title: "Correct Lane Dispatch",
          description: "Map issue type to the right specialist faster.",
        },
        {
          icon: "Proof",
          title: "Outcome Visibility",
          description:
            "Use transparent updates from intake through fix completion.",
        },
      ],
    },
  },
  {
    section: "gallery",
    enabled: true,
    order: 0,
    config: { columns: 3, variant: "masonry", showCaptions: true },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 3, showIcons: true },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "badge-row" },
  },
  { section: "reviews", enabled: true, order: 0, config: { showNFC: true } },
  { section: "about", enabled: true, order: 0, config: {} },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "inline" },
  },
  { section: "faq", enabled: false, order: 0, config: {} },
  { section: "how-it-works", enabled: false, order: 0, config: {} },
  { section: "financing", enabled: false, order: 0, config: {} },
]);

// =============================================================================
// 8. CONSULTATIVE
// Process-driven, how-it-works upfront, FAQ-rich, education-forward.
// SEO: consultative — FAQ schema, how-to rich results, authority content.
// =============================================================================

const consultativeSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "centered", showTextmark: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 6, maxAnswerWords: 70, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Process-Driven Questions Answered",
      intro:
        "Educational Q&A blocks that prioritize factual explanations over broad promotional copy.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "calm",
      responseMinutes: 55,
      dispatchFee: 89,
      operatingHours: "Scheduled Priority Support",
    },
    content: {
      eyebrow: "Guided Priority Routing",
      headline: "Process-Driven Emergency Intake for Better Outcomes",
      subheadline:
        "Set expectations upfront with structured triage, response windows, and service path transparency.",
      bottomCtaText:
        "Emergency mode is intended for urgent issues requiring near-term intervention.",
      items: [
        {
          icon: "Step 1",
          title: "Intake Questions",
          description:
            "Gather key failure symptoms before dispatch assignment.",
        },
        {
          icon: "Step 2",
          title: "Severity Classification",
          description:
            "Route by urgency level to reduce over-triage and delay.",
        },
        {
          icon: "Step 3",
          title: "Service Path Match",
          description: "Align request with the best technician skill profile.",
        },
        {
          icon: "Step 4",
          title: "Clear Next Action",
          description: "Show exact next steps after emergency mode is enabled.",
        },
      ],
    },
  },
  {
    section: "how-it-works",
    enabled: true,
    order: 0,
    config: { variant: "steps-numbered" },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 2, showIcons: true },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "badge-row" },
  },
  { section: "faq", enabled: true, order: 0, config: { variant: "expanded" } },
  { section: "about", enabled: true, order: 0, config: {} },
  { section: "reviews", enabled: true, order: 0, config: { showNFC: true } },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "consultation" },
  },
  { section: "financing", enabled: true, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// 9. COMMUNITY BUILT
// Warm, owner-story prominent, neighbourhood-first, family business feel.
// SEO: local-service + trust-authority — owner name, story, local E-E-A-T.
// =============================================================================

const communitySections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "centered", showTextmark: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 5, maxAnswerWords: 60, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Community Service Q&A",
      intro:
        "Clear local answers that help residents quickly understand scope, timelines, and response standards.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "warm",
      responseMinutes: 60,
      dispatchFee: 79,
      operatingHours: "Community Dispatch Hours",
    },
    content: {
      eyebrow: "Local Team Priority",
      headline: "Human-Centered Emergency Grid for Community Calls",
      subheadline:
        "Keep urgent support approachable with plain-language triage, clear fees, and immediate call options.",
      bottomCtaText:
        "Emergency mode flags your request for first-available technician routing.",
      items: [
        {
          icon: "Neighbor",
          title: "Friendly Intake Flow",
          description:
            "Plain prompts help residents report urgent issues quickly.",
        },
        {
          icon: "Local ETA",
          title: "Community Timing",
          description:
            "Estimate dispatch windows from neighborhood coverage patterns.",
        },
        {
          icon: "Transparent",
          title: "Clear Fee Signals",
          description:
            "Communicate dispatch fee and urgency terms before callout.",
        },
        {
          icon: "Support",
          title: "Care-First Follow-Up",
          description:
            "Confirm resolution and provide practical after-service guidance.",
        },
      ],
    },
  },
  {
    section: "about",
    enabled: true,
    order: 0,
    config: { variant: "owner-story", showOwnerPhoto: true },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "badge-row" },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 3, showIcons: true },
  },
  {
    section: "reviews",
    enabled: true,
    order: 0,
    config: { showNFC: true, variant: "testimonials" },
  },
  { section: "how-it-works", enabled: false, order: 0, config: {} },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "inline" },
  },
  { section: "faq", enabled: true, order: 0, config: {} },
  { section: "financing", enabled: false, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// 10. CONVERSION PRO
// Booking/CTA-first, financing-prominent, single-goal layout.
// SEO: conversion — offer keywords, booking schema, financing keywords.
// =============================================================================

const conversionSections: SectionConfig[] = ordered([
  {
    section: "hero",
    enabled: true,
    order: 0,
    config: { variant: "split", showTextmark: true, ctaDense: true },
  },
  {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config: { maxItems: 4, maxAnswerWords: 55, includeJsonLd: true },
    content: {
      eyebrow: "Answer-First AEO",
      headline: "Decision-Stage Q&A",
      intro:
        "High-intent answers that remove uncertainty and support faster service booking decisions.",
    },
  },
  {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config: {
      visualDirection: "signal",
      responseMinutes: 30,
      dispatchFee: 99,
      operatingHours: "24/7 Conversion Priority",
    },
    content: {
      eyebrow: "High-Intent Dispatch",
      headline: "Conversion-First Emergency Grid with One-Tap Escalation",
      subheadline:
        "Move urgent users from uncertainty to confirmed dispatch quickly with explicit timing and priority lane controls.",
      bottomCtaText:
        "Turn on emergency mode for fastest-response conversion flow.",
      items: [
        {
          icon: "Intent",
          title: "Urgency Capture",
          description:
            "Convert high-intent visitors with immediate triage prompts.",
        },
        {
          icon: "Frictionless",
          title: "One-Tap Escalation",
          description:
            "Reduce steps between issue recognition and dispatcher contact.",
        },
        {
          icon: "Proof",
          title: "Timing and Fee Clarity",
          description: "Show response expectations and dispatch fee up front.",
        },
        {
          icon: "Close",
          title: "Fast Dispatch Confirmation",
          description:
            "Confirm queue position to increase call completion rates.",
        },
      ],
    },
  },
  {
    section: "trust",
    enabled: true,
    order: 0,
    config: { variant: "full-width" },
  },
  {
    section: "booking",
    enabled: true,
    order: 0,
    config: { variant: "standalone", stickyMobile: true },
  },
  {
    section: "financing",
    enabled: true,
    order: 0,
    config: { variant: "prominent" },
  },
  {
    section: "services",
    enabled: true,
    order: 0,
    config: { columns: 3, showIcons: true },
  },
  { section: "reviews", enabled: true, order: 0, config: { showNFC: true } },
  { section: "how-it-works", enabled: true, order: 0, config: {} },
  { section: "faq", enabled: true, order: 0, config: {} },
  { section: "about", enabled: false, order: 0, config: {} },
  { section: "gallery", enabled: false, order: 0, config: { columns: 3 } },
]);

// =============================================================================
// Template Registry Map
// =============================================================================

export const TEMPLATE_REGISTRY: Record<string, SiteTemplate> = {
  // ── 1 ─────────────────────────────────────────────────────────────────────
  modern: {
    id: "modern",
    name: "Modern Minimal",
    slug: "modern",
    tagline: "Clean lines, professional edge",
    aesthetic: "clean",
    mood: "Professional · Timeless",
    description:
      "Clean, minimal design with bold typography and plenty of whitespace. Works for any trade that wants a professional, tech-forward look.",
    industry_fit: ["Electrical", "HVAC", "General Contractor", "Pest Control"],
    industry_also_good: [
      "Plumbing",
      "Roofing",
      "Cleaning Services",
      "Locksmith",
      "Garage Door",
      "Other",
    ],
    seo_strategy: "local-service",
    schema_types: ["LocalBusiness", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "Centred hero with H1 keyword headline",
      "3-column services grid",
      "Inline booking form",
      "Reviews with NFC card integration",
    ],
    preview_palette: {
      primary: "#2563EB",
      secondary: "#1E40AF",
      accent: "#DBEAFE",
      background: "#FFFFFF",
    },
    preview_image_url: null,
    default_layout_json: modernSections,
    base_css: null,
    is_active: true,
    is_default: true,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 2 ─────────────────────────────────────────────────────────────────────
  bold: {
    id: "bold",
    name: "Bold Impact",
    slug: "bold",
    tagline: "Unmissable presence in competitive markets",
    aesthetic: "bold",
    mood: "Aggressive · High-Energy",
    description:
      "High-contrast design with oversized typography and strong CTAs. Built for trades that compete hard on price and speed.",
    industry_fit: ["Plumbing", "HVAC", "Electrical", "Roofing"],
    industry_also_good: [
      "Concrete & Masonry",
      "General Contractor",
      "Tree Service",
      "Garage Door",
    ],
    seo_strategy: "local-service",
    schema_types: ["LocalBusiness", "Plumber", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "Split-screen hero with phone CTA",
      "Full-width trust bar",
      "How It Works process strip",
      "Financing block prominent",
    ],
    preview_palette: {
      primary: "#DC2626",
      secondary: "#991B1B",
      accent: "#FEE2E2",
      background: "#0F172A",
    },
    preview_image_url: null,
    default_layout_json: boldSections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 3 ─────────────────────────────────────────────────────────────────────
  "trust-first": {
    id: "trust-first",
    name: "Trust First",
    slug: "trust-first",
    tagline: "Let 5-star reviews do the selling",
    aesthetic: "trust",
    mood: "Credible · Reassuring",
    description:
      "Social proof-heavy layout that leads with your best reviews and credentials. Ideal for high-trust trades where reputation is everything.",
    industry_fit: [
      "Dental",
      "Medical",
      "Legal",
      "Real Estate",
      "Cleaning Services",
    ],
    industry_also_good: [
      "Landscaping",
      "Pool & Spa",
      "Pest Control",
      "Flooring",
    ],
    seo_strategy: "trust-authority",
    schema_types: ["LocalBusiness", "ProfessionalService"],
    feature_highlights: [
      "Reviews section immediately below hero",
      "Credential badge row (licences, certifications)",
      "FAQ section with schema markup",
      "Consultation-style booking CTA",
    ],
    preview_palette: {
      primary: "#059669",
      secondary: "#065F46",
      accent: "#D1FAE5",
      background: "#FFFFFF",
    },
    preview_image_url: null,
    default_layout_json: trustFirstSections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 4 ─────────────────────────────────────────────────────────────────────
  "local-pro": {
    id: "local-pro",
    name: "Local Pro",
    slug: "local-pro",
    tagline: "Your neighbourhood expert, front and centre",
    aesthetic: "local",
    mood: "Friendly · Community-Rooted",
    description:
      "Warm, location-forward design that emphasises your community presence and service area. Perfect for businesses built on word-of-mouth.",
    industry_fit: [
      "Landscaping",
      "Pest Control",
      "Cleaning Services",
      "Pool & Spa",
    ],
    industry_also_good: [
      "Tree Service",
      "Painting",
      "Locksmith",
      "Garage Door",
      "Flooring",
    ],
    seo_strategy: "local-service",
    schema_types: ["LocalBusiness", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "Location badge in hero (city + service area)",
      "Owner photo in About section",
      "Neighbourhood-first copywriting hooks",
      "FAQ section for local queries",
    ],
    preview_palette: {
      primary: "#16A34A",
      secondary: "#14532D",
      accent: "#DCFCE7",
      background: "#FFFFFF",
    },
    preview_image_url: null,
    default_layout_json: localProSections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 5 ─────────────────────────────────────────────────────────────────────
  premium: {
    id: "premium",
    name: "Premium Service",
    slug: "premium",
    tagline: "Position your work as the best in class",
    aesthetic: "premium",
    mood: "Refined · Editorial",
    description:
      "An editorial layout with generous spacing and gallery-forward sections. Designed to command premium pricing through visual excellence.",
    industry_fit: [
      "Flooring",
      "Pool & Spa",
      "General Contractor",
      "Landscaping",
    ],
    industry_also_good: [
      "Painting",
      "Roofing",
      "Concrete & Masonry",
      "Electrical",
    ],
    seo_strategy: "trust-authority",
    schema_types: ["LocalBusiness", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "Editorial hero with gallery integration",
      "Masonry gallery (before/after projects)",
      "Large-card services layout",
      "Testimonial-style reviews",
    ],
    preview_palette: {
      primary: "#7C3AED",
      secondary: "#4C1D95",
      accent: "#EDE9FE",
      background: "#FAFAF9",
    },
    preview_image_url: null,
    default_layout_json: premiumSections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 6 ─────────────────────────────────────────────────────────────────────
  emergency: {
    id: "emergency",
    name: "24/7 Response",
    slug: "emergency",
    tagline: "They need you now — make it easy to call",
    aesthetic: "urgent",
    mood: "Urgent · Fast · Reliable",
    description:
      "Phone-first, urgency-driven layout designed to convert panicked searchers into booked jobs. The phone number is never more than a scroll away.",
    industry_fit: [
      "Plumbing",
      "HVAC",
      "Locksmith",
      "Garage Door",
      "Tree Service",
    ],
    industry_also_good: [
      "Electrical",
      "Roofing",
      "Pest Control",
      "General Contractor",
    ],
    seo_strategy: "emergency",
    schema_types: ["LocalBusiness", "Plumber", "EmergencyService"],
    feature_highlights: [
      "Sticky phone bar on all screen sizes",
      "24/7 availability urgency badge",
      "Numbered How It Works (call → dispatch → fix)",
      "Emergency CTA booking button",
    ],
    preview_palette: {
      primary: "#EA580C",
      secondary: "#9A3412",
      accent: "#FFEDD5",
      background: "#0F172A",
    },
    preview_image_url: null,
    default_layout_json: emergencySections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 7 ─────────────────────────────────────────────────────────────────────
  showcase: {
    id: "showcase",
    name: "Visual Showcase",
    slug: "showcase",
    tagline: "Your work speaks louder than words",
    aesthetic: "visual",
    mood: "Portfolio-Led · Impressive",
    description:
      "Image-first layout with a full-bleed gallery hero and masonry portfolio grid. Let your completed projects sell the next job.",
    industry_fit: ["Painting", "Flooring", "Concrete & Masonry", "Landscaping"],
    industry_also_good: [
      "Pool & Spa",
      "Roofing",
      "General Contractor",
      "Tree Service",
    ],
    seo_strategy: "visual-portfolio",
    schema_types: ["LocalBusiness", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "Full-bleed gallery hero",
      "Masonry portfolio grid with project captions",
      "Image-rich services section",
      "SEO-optimised gallery alt-text prompts",
    ],
    preview_palette: {
      primary: "#0891B2",
      secondary: "#164E63",
      accent: "#CFFAFE",
      background: "#FFFFFF",
    },
    preview_image_url: null,
    default_layout_json: showcaseSections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 8 ─────────────────────────────────────────────────────────────────────
  consultative: {
    id: "consultative",
    name: "Consultative",
    slug: "consultative",
    tagline: "Educate first, convert naturally",
    aesthetic: "process",
    mood: "Trustworthy · Methodical",
    description:
      "Process and education-forward design that walks visitors through your approach before asking for the sale. Great for complex or high-ticket jobs.",
    industry_fit: ["General Contractor", "Roofing", "Electrical", "HVAC"],
    industry_also_good: [
      "Landscaping",
      "Pool & Spa",
      "Flooring",
      "Concrete & Masonry",
    ],
    seo_strategy: "consultative",
    schema_types: ["LocalBusiness", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "How It Works section immediately below hero",
      "Expanded FAQ with schema markup eligible",
      "Side-by-side services with detail cards",
      "Financing section + consultation booking",
    ],
    preview_palette: {
      primary: "#2563EB",
      secondary: "#1D4ED8",
      accent: "#DBEAFE",
      background: "#F8FAFC",
    },
    preview_image_url: null,
    default_layout_json: consultativeSections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 9 ─────────────────────────────────────────────────────────────────────
  community: {
    id: "community",
    name: "Community Built",
    slug: "community",
    tagline: "Built by a neighbour, trusted by the block",
    aesthetic: "community",
    mood: "Warm · Personal · Honest",
    description:
      "Owner-story-forward layout that builds genuine connection with local customers. Ideal for small teams competing against big franchise brands.",
    industry_fit: [
      "Cleaning Services",
      "Pest Control",
      "Landscaping",
      "Painting",
    ],
    industry_also_good: [
      "Plumbing",
      "HVAC",
      "Electrical",
      "Tree Service",
      "Pool & Spa",
    ],
    seo_strategy: "local-service",
    schema_types: ["LocalBusiness", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "Owner photo + personal story in About",
      "Community-voice copywriting tone",
      "Testimonial-style review layout",
      "Local FAQ section (neighbourhood queries)",
    ],
    preview_palette: {
      primary: "#D97706",
      secondary: "#92400E",
      accent: "#FEF3C7",
      background: "#FFFBEB",
    },
    preview_image_url: null,
    default_layout_json: communitySections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },

  // ── 10 ────────────────────────────────────────────────────────────────────
  conversion: {
    id: "conversion",
    name: "Conversion Pro",
    slug: "conversion",
    tagline: "Every pixel is built to book the next job",
    aesthetic: "conversion",
    mood: "Direct · Action-Oriented",
    description:
      "Single-goal layout focused on getting visitors to book or call. Booking widget and financing offers appear early and persist throughout the page.",
    industry_fit: ["Plumbing", "HVAC", "Electrical", "Pest Control"],
    industry_also_good: [
      "Roofing",
      "Cleaning Services",
      "Locksmith",
      "Garage Door",
      "Tree Service",
    ],
    seo_strategy: "conversion",
    schema_types: ["LocalBusiness", "HomeAndConstructionBusiness"],
    feature_highlights: [
      "Booking widget in position 3 (above the fold on most screens)",
      "Financing offer block with prominent CTA",
      "Sticky mobile booking button",
      "Offer-keyword rich meta description prompts",
    ],
    preview_palette: {
      primary: "#7C3AED",
      secondary: "#6D28D9",
      accent: "#EDE9FE",
      background: "#0F172A",
    },
    preview_image_url: null,
    default_layout_json: conversionSections,
    base_css: null,
    is_active: true,
    is_default: false,
    created_at: NOW,
    updated_at: NOW,
  },
};

// ---------------------------------------------------------------------------
// Industry → Top-3 recommended template slugs
// Used by Step 4 template picker to surface the most relevant 3 cards first.
// Order matters: index 0 = strongest recommendation.
// ---------------------------------------------------------------------------

export const INDUSTRY_TEMPLATE_MAP: Record<string, [string, string, string]> = {
  Plumbing: ["emergency", "bold", "conversion"],
  HVAC: ["bold", "emergency", "conversion"],
  Electrical: ["bold", "modern", "consultative"],
  Roofing: ["bold", "consultative", "showcase"],
  Landscaping: ["showcase", "local-pro", "modern"],
  "Pest Control": ["local-pro", "community", "modern"],
  "Cleaning Services": ["community", "local-pro", "modern"],
  Painting: ["showcase", "modern", "local-pro"],
  Flooring: ["showcase", "premium", "modern"],
  "General Contractor": ["consultative", "premium", "showcase"],
  "Concrete & Masonry": ["showcase", "bold", "consultative"],
  "Tree Service": ["emergency", "local-pro", "bold"],
  "Garage Door": ["emergency", "bold", "modern"],
  Locksmith: ["emergency", "bold", "conversion"],
  "Pool & Spa": ["showcase", "premium", "local-pro"],
  Other: ["modern", "trust-first", "bold"],
};

// Default fallback when trade is not in the map
export const DEFAULT_INDUSTRY_TEMPLATES: [string, string, string] = [
  "modern",
  "bold",
  "trust-first",
];

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

export const DEFAULT_TEMPLATE = TEMPLATE_REGISTRY["modern"];

export const ALL_TEMPLATES = Object.values(TEMPLATE_REGISTRY);

export const ACTIVE_TEMPLATES = ALL_TEMPLATES.filter((t) => t.is_active);

// ---------------------------------------------------------------------------
// getTemplate — get by slug, falls back to modern
// ---------------------------------------------------------------------------

export function getTemplate(slug: string): SiteTemplate {
  return TEMPLATE_REGISTRY[slug] ?? DEFAULT_TEMPLATE;
}

// ---------------------------------------------------------------------------
// getRecommendedTemplateSlugs
// Returns the top-3 recommended slugs for a given industry/trade.
// Falls back to DEFAULT_INDUSTRY_TEMPLATES if trade not found.
// ---------------------------------------------------------------------------

export function getRecommendedTemplateSlugs(
  primaryTrade: string | null | undefined,
): [string, string, string] {
  if (!primaryTrade) return DEFAULT_INDUSTRY_TEMPLATES;
  return INDUSTRY_TEMPLATE_MAP[primaryTrade] ?? DEFAULT_INDUSTRY_TEMPLATES;
}

// ---------------------------------------------------------------------------
// getRecommendedTemplates
// Returns the top-3 SiteTemplate objects for a given industry/trade,
// plus whether each is a "primary" recommendation vs. "also good".
// ---------------------------------------------------------------------------

export function getRecommendedTemplates(
  primaryTrade: string | null | undefined,
): Array<{
  template: SiteTemplate;
  isTopPick: boolean;
  recommendRank: 1 | 2 | 3;
}> {
  const slugs = getRecommendedTemplateSlugs(primaryTrade);
  return slugs.map((slug, i) => ({
    template: getTemplate(slug),
    isTopPick: i === 0,
    recommendRank: (i + 1) as 1 | 2 | 3,
  }));
}

// ---------------------------------------------------------------------------
// resolveSections
// Merge tenant active sections with template defaults.
// Tenant config overrides template defaults; template fills in missing sections.
// ---------------------------------------------------------------------------

export function resolveSections(
  templateSections: SectionConfig[],
  tenantOverrides: SectionConfig[],
): SectionConfig[] {
  if (!tenantOverrides || tenantOverrides.length === 0) {
    return [...templateSections].sort((a, b) => a.order - b.order);
  }

  // Build a map of tenant overrides by section id
  const overrideMap = new Map(tenantOverrides.map((s) => [s.section, s]));

  // Merge: tenant overrides win, template fills missing
  const merged = templateSections.map((templateSection) => {
    const override = overrideMap.get(templateSection.section);
    return override
      ? {
          ...templateSection,
          ...override,
          config: { ...templateSection.config, ...override.config },
        }
      : templateSection;
  });

  // Include override-only sections not in the base template
  const templateSectionsSet = new Set(templateSections.map((s) => s.section));
  for (const override of tenantOverrides) {
    if (!templateSectionsSet.has(override.section)) {
      merged.push(override);
    }
  }

  return merged.sort((a, b) => a.order - b.order);
}
