import { getContentPack } from "@/lib/waas/content-packs";
import type { SeoStrategy } from "@/lib/waas/templates/types";
import type {
  FAQSectionContent,
  HowItWorksSectionContent,
} from "@/lib/waas/templates/types";
import type { GenerationProfile } from "./types";

// ---------------------------------------------------------------------------
// Section content builders
// ---------------------------------------------------------------------------

export function buildFaqContent(
  profile: GenerationProfile,
  strategy: SeoStrategy,
): FAQSectionContent {
  const propositions = profile.valuePropositions.slice(0, 3);

  // Seed with pack FAQs (up to 3 most relevant ones) then add strategy items
  const pack = getContentPack(profile.trade);
  const packFaqs = pack.defaultFaqs.slice(0, 3);

  const items: FAQSectionContent["items"] = [
    // Always include pack FAQs first — they're trade-specific and high-quality
    ...packFaqs.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    })),
    {
      question: `Do you cover ${profile.serviceArea} and the surrounding area?`,
      answer: `Yes. ${profile.businessName} provides service across ${profile.serviceArea} and nearby areas.`,
    },
    {
      question: "How soon can you get started?",
      answer:
        "We confirm availability quickly and schedule based on urgency and location.",
    },
  ];

  if (strategy === "emergency") {
    items.push({
      question: "Do you offer 24/7 emergency service?",
      answer: `Yes — ${profile.businessName} responds to emergency calls day and night.`,
    });
  } else if (strategy === "consultative") {
    items.push({
      question: "What does your process look like from start to finish?",
      answer:
        "We start with a consultation, then produce a clear plan with transparent pricing before any work begins.",
    });
  } else {
    items.push({
      question: "How does pricing and estimates work?",
      answer:
        "You receive a clear scope and pricing breakdown before any commitment.",
    });
  }

  if (propositions.length > 0) {
    items.push({
      question: `Why choose ${profile.businessName} over other providers?`,
      answer: propositions.join(" • "),
    });
  }

  return {
    eyebrow: "FAQ",
    headline: "Common Questions",
    intro: `Quick answers about our ${profile.tradeDisplayName.toLowerCase()}.`,
    items,
  };
}

export function buildProcessContent(
  profile: GenerationProfile,
  strategy: SeoStrategy,
): HowItWorksSectionContent {
  const steps =
    strategy === "emergency"
      ? [
          {
            title: "Call or Text",
            description: `Reach us any time — we respond to ${profile.location} emergencies fast.`,
          },
          {
            title: "Rapid Assessment",
            description:
              "We diagnose the problem and confirm a clear fix with pricing upfront.",
          },
          {
            title: "Same-Day Resolve",
            description:
              "Our team completes the work and ensures everything is safe and sealed.",
          },
        ]
      : strategy === "consultative"
        ? [
            {
              title: "Initial Consult",
              description: `Tell us your goals and we'll map the best approach for ${profile.location}.`,
            },
            {
              title: "Tailored Plan",
              description:
                "We produce a step-by-step plan with timeline and transparent costs.",
            },
            {
              title: "Delivered Right",
              description:
                "Work is completed to spec and backed by our quality guarantee.",
            },
          ]
        : [
            {
              title: "Reach Out",
              description: `Tell us about your project in ${profile.location}.`,
            },
            {
              title: "Plan & Quote",
              description:
                "We walk through options, timelines, and clear pricing.",
            },
            {
              title: "Deliver",
              description:
                "Our team completes the work and confirms everything meets expectations.",
            },
          ];

  return {
    eyebrow: "How It Works",
    headline: `Our ${profile.trade} Process`,
    intro: "Simple steps from first contact to completed project.",
    steps,
  };
}

// ---------------------------------------------------------------------------
// SEO strategy → headline/copy tone instructions (used in Tier 1 copy tuning)
// ---------------------------------------------------------------------------

export interface StrategyDirectives {
  heroEyebrow: string;
  heroPreamble: string;
  servicesEyebrow: string;
  trustHeadline: string;
  bookingEyebrow: string;
  bookingHeadline: string;
}

export function getStrategyDirectives(
  strategy: SeoStrategy,
  profile: GenerationProfile,
): StrategyDirectives {
  switch (strategy) {
    case "emergency":
      return {
        heroEyebrow: `24/7 ${profile.trade} — ${profile.location}`,
        heroPreamble: `Fast response when it matters most. `,
        servicesEyebrow: "Emergency & Routine Services",
        trustHeadline: `Trusted for rapid ${profile.trade.toLowerCase()} response across ${profile.location}`,
        bookingEyebrow: "Book Now — Available 24/7",
        bookingHeadline: "Get Immediate Help",
      };
    case "trust-authority":
      return {
        heroEyebrow: `Certified ${profile.trade} Specialists`,
        heroPreamble: "",
        servicesEyebrow: "Professional Services",
        trustHeadline: `Certified, reviewed, and recommended in ${profile.location}`,
        bookingEyebrow: "Start Your Project",
        bookingHeadline: "Schedule a Consultation",
      };
    case "visual-portfolio":
      return {
        heroEyebrow: `${profile.trade} Portfolio — ${profile.location}`,
        heroPreamble: "",
        servicesEyebrow: "Our Work",
        trustHeadline: `${profile.businessName} — results you can see`,
        bookingEyebrow: "Ready to Start?",
        bookingHeadline: "Request a Project Quote",
      };
    case "consultative":
      return {
        heroEyebrow: `${profile.trade} Experts`,
        heroPreamble: "",
        servicesEyebrow: "How We Help",
        trustHeadline: `Trusted guidance for ${profile.trade.toLowerCase()} projects in ${profile.location}`,
        bookingEyebrow: "Let's Talk",
        bookingHeadline: "Book a Free Consultation",
      };
    case "conversion":
      return {
        heroEyebrow: `Get Your Free Estimate Today`,
        heroPreamble: "",
        servicesEyebrow: "Services & Pricing",
        trustHeadline: `Transparent pricing. Fast results. ${profile.location}.`,
        bookingEyebrow: "Claim Your Free Estimate",
        bookingHeadline: "Book Now — No Obligation",
      };
    case "local-service":
    default:
      return {
        heroEyebrow: `${profile.trade} — ${profile.location}`,
        heroPreamble: "",
        servicesEyebrow: "Our Services",
        trustHeadline: `Trusted by homeowners across ${profile.location}`,
        bookingEyebrow: "Get Started",
        bookingHeadline: "Schedule Your Consultation",
      };
  }
}
