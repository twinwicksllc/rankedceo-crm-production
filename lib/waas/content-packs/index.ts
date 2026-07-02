// =============================================================================
// Industry Content Pack Registry
//
// Exports:
//   • CONTENT_PACKS — map of trade → IndustryContentPack
//   • getContentPack(trade) — safe lookup with generic fallback
//   • SUPPORTED_TRADES — typed union of all pack keys
//
// Usage in generateInitialSiteFromTemplate():
//
//   import { getContentPack } from '@/lib/waas/content-packs'
//
//   const pack = getContentPack(profile.trade)
//   const services = profile.services.length > 0
//     ? profile.services
//     : pack.defaultServices.slice(0, 6).map(s => s.title)
// =============================================================================

import type { IndustryContentPack } from "./types";

import plumber from "./packs/plumber";
import electrician from "./packs/electrician";
import hvac from "./packs/hvac";
import roofer from "./packs/roofer";
import landscaper from "./packs/landscaper";
import painter from "./packs/painter";
import cleaner from "./packs/cleaner";
import carpenter from "./packs/carpenter";
import pestControl from "./packs/pest-control";
import locksmith from "./packs/locksmith";
import handyman from "./packs/handyman";
import poolService from "./packs/pool-service";
import garageDoor from "./packs/garage-door";
import applianceRepair from "./packs/appliance-repair";
import flooring from "./packs/flooring";
import moving from "./packs/moving";

// ---------------------------------------------------------------------------
// Registry map
// ---------------------------------------------------------------------------

export const CONTENT_PACKS: Record<string, IndustryContentPack> = {
  plumber,
  electrician,
  hvac,
  roofer,
  landscaper,
  painter,
  cleaner,
  carpenter,
  "pest-control": pestControl,
  locksmith,
  handyman,
  "pool-service": poolService,
  "garage-door": garageDoor,
  "appliance-repair": applianceRepair,
  flooring,
  moving,
};

// ---------------------------------------------------------------------------
// Typed union of all registered pack keys
// ---------------------------------------------------------------------------

export type SupportedTrade = keyof typeof CONTENT_PACKS;

export const SUPPORTED_TRADES = Object.keys(CONTENT_PACKS) as SupportedTrade[];

// ---------------------------------------------------------------------------
// Generic fallback pack — used when the tenant's trade is not in the registry
// ---------------------------------------------------------------------------

const GENERIC_FALLBACK: IndustryContentPack = {
  trade: "general",
  displayName: "Local Services",

  defaultServices: [
    {
      title: "Residential Services",
      description: "Quality service for homes in the local area.",
      icon: "🏠",
    },
    {
      title: "Commercial Services",
      description: "Professional services for local businesses.",
      icon: "🏢",
    },
    {
      title: "Same-Day Availability",
      description: "Prompt response for urgent and scheduled work.",
      icon: "⚡",
    },
    {
      title: "Free Estimates",
      description: "Transparent quotes with no obligation.",
      icon: "📋",
    },
    {
      title: "Licensed & Insured",
      description: "Fully credentialed for your protection.",
      icon: "🛡️",
    },
    {
      title: "Satisfaction Guarantee",
      description: "We stand behind every job we do.",
      icon: "✅",
    },
  ],

  defaultFaqs: [
    {
      question: "Are you licensed and insured?",
      answer:
        "Yes — we carry all required licences and full liability insurance for every job.",
    },
    {
      question: "How do I get a quote?",
      answer:
        "Contact us for a free, no-obligation estimate. We provide clear pricing before any work begins.",
    },
    {
      question: "How quickly can you start?",
      answer:
        "We confirm availability quickly and can often start within 24–48 hours depending on the scope of work.",
    },
    {
      question: "Do you offer a warranty on your work?",
      answer:
        "Yes — all our work is backed by a workmanship warranty for your peace of mind.",
    },
  ],

  heroCopyPatterns: {
    standard: {
      eyebrow: "Trusted Local Professionals",
      headline: "Quality Service You Can Count On",
      subheadline:
        "Reliable, professional service for homes and businesses — delivered with care and attention to detail.",
      ctaLabel: "Get a Free Estimate",
    },
    emergency: {
      eyebrow: "24/7 Emergency Service",
      headline: "Urgent? We Respond Fast",
      subheadline:
        "Emergency service available — call now and we'll have someone on the way.",
      ctaLabel: "Call Now",
    },
    conversion: {
      eyebrow: "Professional Service — Upfront Pricing",
      headline: "Expert Help, No Hidden Costs",
      subheadline:
        "Transparent quotes, qualified professionals, and guaranteed workmanship on every job.",
      ctaLabel: "Get a Free Quote",
    },
  },

  seoKeywords: {
    headTerms: ["local service", "professional services", "home services"],
    midTail: [
      "local service provider",
      "professional near me",
      "home services near me",
    ],
    longTail: [
      "best local service company near me",
      "reliable service professional",
      "licensed insured local professional",
    ],
    localModifiers: ["near me", "local", "in [city]", "[city] services"],
  },

  trustSignals: [
    "Licensed & Insured",
    "Local & Trusted",
    "Upfront Pricing",
    "Satisfaction Guaranteed",
  ],

  heroImageQueries: [
    "professional service worker",
    "tradesperson at work",
    "local service professional",
  ],
};

// ---------------------------------------------------------------------------
// Safe lookup — returns matching pack or generic fallback
// ---------------------------------------------------------------------------

/**
 * Returns the IndustryContentPack for the given trade string.
 *
 * Matching is case-insensitive and tolerates common variants:
 *   • "HVAC" → hvac
 *   • "Plumber" → plumber
 *   • "pest control" → pest-control
 *   • "garage door" → garage-door
 *
 * Falls back to the generic pack if no match is found.
 */
export function getContentPack(
  trade: string | null | undefined,
): IndustryContentPack {
  if (!trade) return GENERIC_FALLBACK;

  // Normalise: lowercase + replace spaces with hyphens
  const normalised = trade.toLowerCase().replace(/\s+/g, "-").trim();

  // Direct registry lookup
  if (normalised in CONTENT_PACKS) {
    return CONTENT_PACKS[normalised]!;
  }

  // Partial-match fallback (e.g. "hvac technician" → hvac)
  const partialMatch = SUPPORTED_TRADES.find(
    (key) => normalised.startsWith(key) || key.startsWith(normalised),
  );
  if (partialMatch) {
    return CONTENT_PACKS[partialMatch]!;
  }

  return GENERIC_FALLBACK;
}

// Re-export types for convenience
export type {
  IndustryContentPack,
  ServiceItem,
  FaqItem,
  HeroCopyPatterns,
  SeoKeywordCluster,
} from "./types";
