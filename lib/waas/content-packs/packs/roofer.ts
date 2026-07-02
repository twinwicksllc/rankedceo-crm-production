import type { IndustryContentPack } from "../types";

const roofer: IndustryContentPack = {
  trade: "roofer",
  displayName: "Roofing Services",

  defaultServices: [
    {
      title: "Roof Replacement",
      description:
        "Full tear-off and re-roof of asphalt shingle, metal, tile, and flat roofing systems.",
      icon: "🏠",
    },
    {
      title: "Roof Repair",
      description:
        "Fast, lasting repairs for leaks, missing shingles, damaged flashing, and storm damage.",
      icon: "🔧",
    },
    {
      title: "Storm Damage Inspection & Repair",
      description:
        "Post-storm assessments with detailed photo reports for insurance claims.",
      icon: "⛈️",
    },
    {
      title: "Gutter Installation & Repair",
      description:
        "Seamless gutters, downspout extensions, and gutter guard systems installed to spec.",
      icon: "🌧️",
    },
    {
      title: "Flat Roof Systems",
      description:
        "TPO, EPDM, and modified bitumen flat roof installation, repair, and coating.",
      icon: "🏢",
    },
    {
      title: "Metal Roofing",
      description:
        "Standing seam, corrugated, and metal shingle roofing — residential and commercial.",
      icon: "🔩",
    },
    {
      title: "Roof Inspection",
      description:
        "Comprehensive roof inspections with drone imaging and written condition reports.",
      icon: "🔍",
    },
    {
      title: "Skylight Installation & Repair",
      description:
        "Velux and custom skylight supply, installation, and leak-free flashing.",
      icon: "☀️",
    },
  ],

  defaultFaqs: [
    {
      question: "How long does a roof replacement take?",
      answer:
        "Most residential roof replacements are completed in 1–2 days, depending on roof size, pitch, and system type.",
    },
    {
      question: "Will you work with my insurance company?",
      answer:
        "Yes — we have extensive experience with insurance claims and will work directly with your adjuster from inspection through completion.",
    },
    {
      question: "How do I know if I need a full replacement or just a repair?",
      answer:
        "Roofs over 20 years old or those with widespread damage typically warrant replacement. We offer free inspections and give you an honest recommendation.",
    },
    {
      question: "What roofing materials do you install?",
      answer:
        "We install asphalt shingles (3-tab and architectural), metal roofing, flat systems (TPO, EPDM), tile, and cedar shake.",
    },
    {
      question: "Do you offer a workmanship warranty?",
      answer:
        "Yes — we back all our installations with a workmanship warranty in addition to the manufacturer's material warranty.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "Emergency Roof Repair",
      headline: "Roof Leak? We Respond Today",
      subheadline:
        "Storm damage, active leaks, or missing shingles — our crew responds fast to protect your property.",
      ctaLabel: "Call for Emergency Roof Repair",
    },
    standard: {
      eyebrow: "Licensed Roofing Contractor",
      headline: "Quality Roofing That Lasts",
      subheadline:
        "Expert roof replacements, repairs, and inspections delivered by certified roofing professionals.",
      ctaLabel: "Get a Free Roof Inspection",
    },
    conversion: {
      eyebrow: "Roofing Services — Free Estimates",
      headline: "A New Roof, Done Right & On Budget",
      subheadline:
        "Transparent pricing, quality materials, and certified workmanship on every roofing project.",
      ctaLabel: "Get a Free Quote",
    },
    consultative: {
      eyebrow: "Expert Roofing Advice",
      headline: "Choose the Right Roof with Confidence",
      subheadline:
        "We walk you through materials, warranties, and costs so you make the best decision for your home.",
      ctaLabel: "Schedule a Free Consultation",
    },
    portfolio: {
      eyebrow: "Roofing Portfolio",
      headline: "Our Completed Roofing Projects",
      subheadline:
        "See our recent replacements, repairs, and commercial roofing work — quality you can see.",
      ctaLabel: "View Our Work",
    },
    informational: {
      eyebrow: "Roofing Information & Advice",
      headline: "Everything You Need to Know About Roofing",
      subheadline:
        "Roof lifespan, material comparisons, insurance claim guides — expert information you can trust.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: [
      "roofer",
      "roofing contractor",
      "roofing company",
      "roofing services",
    ],
    midTail: [
      "roof replacement cost",
      "roof repair near me",
      "storm damage roof repair",
      "roofing inspection",
      "metal roofing installation",
      "gutter installation service",
    ],
    longTail: [
      "how much does a new roof cost",
      "emergency roof repair near me",
      "best roofing company reviews",
      "insurance roof replacement process",
      "roof leak repair same day",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] roofing company",
      "best roofer [city]",
    ],
  },

  trustSignals: [
    "Licensed & Fully Insured",
    "Insurance Claims Specialists",
    "Manufacturer-Certified Installer",
    "Free Storm Damage Inspections",
  ],

  heroImageQueries: [
    "roofer installing shingles residential",
    "roof replacement crew working",
    "roofing contractor with equipment",
    "new roof installation suburban home",
  ],
};

export default roofer;
