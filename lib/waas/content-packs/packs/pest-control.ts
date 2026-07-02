import type { IndustryContentPack } from "../types";

const pestControl: IndustryContentPack = {
  trade: "pest-control",
  displayName: "Pest Control Services",

  defaultServices: [
    {
      title: "General Pest Control",
      description:
        "Comprehensive treatment for ants, cockroaches, spiders, silverfish, and common household pests.",
      icon: "🐜",
    },
    {
      title: "Termite Inspection & Treatment",
      description:
        "Licenced termite inspections, baiting systems, chemical barriers, and termite management plans.",
      icon: "🔍",
    },
    {
      title: "Rodent Control",
      description:
        "Rat and mouse eradication with safe baiting, trapping, and proofing to prevent re-entry.",
      icon: "🐭",
    },
    {
      title: "Bed Bug Treatment",
      description:
        "Thorough bed bug inspections and heat or chemical treatments with a re-treatment guarantee.",
      icon: "🛏️",
    },
    {
      title: "Wasp & Bee Nest Removal",
      description:
        "Safe removal of wasp nests, European wasps, and bee swarms by trained technicians.",
      icon: "🐝",
    },
    {
      title: "Commercial Pest Management",
      description:
        "Ongoing pest management contracts for restaurants, warehouses, offices, and retail.",
      icon: "🏢",
    },
    {
      title: "Pre-Purchase Pest Inspections",
      description:
        "AUSPE-compliant pre-purchase pest and building inspections with same-day reports.",
      icon: "📋",
    },
    {
      title: "Mosquito & Flea Control",
      description:
        "Targeted yard and indoor treatments for mosquitoes, fleas, and biting insects.",
      icon: "🦟",
    },
  ],

  defaultFaqs: [
    {
      question: "Is pest control safe for my family and pets?",
      answer:
        "Yes — we use registered, low-toxicity products applied by trained technicians. We advise on any precautions needed for the specific treatment.",
    },
    {
      question: "How often should I have my home treated for pests?",
      answer:
        "Quarterly general pest treatments are recommended for most homes. High-risk properties or areas with termites may require more frequent monitoring.",
    },
    {
      question: "Do I need to leave my home during treatment?",
      answer:
        "For most general treatments, you can return after 1–2 hours. We will advise on the specific requirements for your treatment before we begin.",
    },
    {
      question: "How quickly can you treat a wasp or bee problem?",
      answer:
        "We offer same-day service for wasp nests and stinging insect emergencies in most service areas.",
    },
    {
      question: "What is included in a termite inspection?",
      answer:
        "A full visual inspection of accessible areas, moisture meter readings, and a detailed written report with findings and recommendations.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "Same-Day Pest Control",
      headline: "Pests? We'll Sort It Today",
      subheadline:
        "From wasp nests to cockroach infestations — our licensed technicians respond fast and fix it for good.",
      ctaLabel: "Book Same-Day Treatment",
    },
    standard: {
      eyebrow: "Licensed Pest Control Specialists",
      headline: "A Pest-Free Home, Guaranteed",
      subheadline:
        "Thorough, safe, and effective pest control for homes and businesses — with treatments that last.",
      ctaLabel: "Book a Free Inspection",
    },
    conversion: {
      eyebrow: "Pest Control — Fixed Pricing",
      headline: "Professional Pest Control at a Fair Price",
      subheadline:
        "No call-out surprises — just effective treatments, upfront pricing, and a pest-free guarantee.",
      ctaLabel: "Get a Fixed Quote",
    },
    consultative: {
      eyebrow: "Pest Management Advice",
      headline: "The Right Pest Treatment for Your Property",
      subheadline:
        "We inspect first, explain what we find, and recommend only the treatments you actually need.",
      ctaLabel: "Book a Free Assessment",
    },
    portfolio: {
      eyebrow: "Pest Control Case Studies",
      headline: "Pest Problems We've Solved",
      subheadline:
        "From termite infestations to commercial rodent control — see the results our clients have experienced.",
      ctaLabel: "View Our Case Studies",
    },
    informational: {
      eyebrow: "Pest Control Knowledge Hub",
      headline: "Identify, Prevent & Treat Common Pests",
      subheadline:
        "Pest identification guides, prevention tips, and professional pest control from licensed local experts.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: [
      "pest control",
      "exterminator",
      "pest management",
      "pest control service",
    ],
    midTail: [
      "termite inspection near me",
      "cockroach pest control",
      "rodent control service",
      "bed bug treatment",
      "wasp nest removal",
      "commercial pest control",
    ],
    longTail: [
      "termite inspection cost near me",
      "how to get rid of cockroaches fast",
      "bed bug exterminator same day",
      "best pest control company reviews",
      "rat removal service near me",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] pest control",
      "best exterminator [city]",
    ],
  },

  trustSignals: [
    "Fully Licensed Technicians",
    "Child & Pet Safe Treatments",
    "Same-Day Service Available",
    "Pest-Free Guarantee",
  ],

  heroImageQueries: [
    "pest control technician spraying treatment",
    "exterminator at work residential",
    "pest inspection professional",
    "pest control service home treatment",
  ],
};

export default pestControl;
