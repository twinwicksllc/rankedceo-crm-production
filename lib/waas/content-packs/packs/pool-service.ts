import type { IndustryContentPack } from "../types";

const poolService: IndustryContentPack = {
  trade: "pool-service",
  displayName: "Pool Service & Maintenance",

  defaultServices: [
    {
      title: "Weekly Pool Cleaning & Maintenance",
      description:
        "Regular vacuuming, skimming, brushing, chemical balancing, and equipment checks.",
      icon: "🏊",
    },
    {
      title: "Pool Chemical Balancing",
      description:
        "Precise pH, chlorine, alkalinity, and stabiliser testing and adjustment.",
      icon: "🧪",
    },
    {
      title: "Pool Equipment Repair",
      description:
        "Pump, filter, heater, and chlorinator repair and replacement — all brands serviced.",
      icon: "🔧",
    },
    {
      title: "Pool Opening & Closing",
      description:
        "Seasonal pool opening and winterisation services to protect your investment.",
      icon: "📅",
    },
    {
      title: "Green Pool Recovery",
      description:
        "Rapid chemical and filter treatment to restore a green or cloudy pool to clear in 24–72 hours.",
      icon: "💚",
    },
    {
      title: "Pool Renovation & Resurfacing",
      description:
        "Fibreglass, pebblecrete, and tiled pool resurfacing, coping replacement, and pool renovation.",
      icon: "🔨",
    },
    {
      title: "Pool Heater Installation",
      description:
        "Solar, heat pump, and gas pool heater supply and installation with performance guarantees.",
      icon: "☀️",
    },
    {
      title: "Leak Detection & Repair",
      description:
        "Non-invasive pool leak detection and professional structural or equipment leak repair.",
      icon: "🔍",
    },
  ],

  defaultFaqs: [
    {
      question: "How often should my pool be serviced?",
      answer:
        "Weekly servicing is recommended during swimming season to maintain water clarity, balance chemicals, and catch equipment issues early.",
    },
    {
      question: "Why has my pool turned green?",
      answer:
        "A green pool is usually caused by algae growth from imbalanced chemicals or insufficient chlorine. We can typically restore clarity within 24–72 hours.",
    },
    {
      question: "What is included in a weekly pool service?",
      answer:
        "A standard visit includes skimming the surface, vacuuming the floor, brushing walls, testing and adjusting chemicals, and checking all equipment.",
    },
    {
      question: "How long does a pool heater installation take?",
      answer:
        "Most pool heater installations are completed in a single day. We handle permits, plumbing connections, and electrical tie-ins.",
    },
    {
      question:
        "Do you carry the chemicals and supplies, or do I need to provide them?",
      answer:
        "We bring all required chemicals and supplies on every visit. Chemical costs are included in your service plan pricing.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "Urgent Pool Recovery",
      headline: "Green Pool or Equipment Failure? We Fix It Fast",
      subheadline:
        "Same-day green pool recovery and emergency equipment repair — your pool back to swim-ready quickly.",
      ctaLabel: "Book Emergency Pool Service",
    },
    standard: {
      eyebrow: "Professional Pool Service",
      headline: "A Sparkling Pool, All Season Long",
      subheadline:
        "Expert pool cleaning, chemical balancing, and equipment maintenance — so your pool is always swim-ready.",
      ctaLabel: "Get a Free Service Quote",
    },
    conversion: {
      eyebrow: "Pool Service — Affordable Weekly Plans",
      headline: "Enjoy Your Pool. Leave the Maintenance to Us.",
      subheadline:
        "Affordable weekly service plans, clear pricing, and a pool you'll actually want to swim in.",
      ctaLabel: "View Service Plans",
    },
    consultative: {
      eyebrow: "Pool Care Consultation",
      headline: "The Right Pool Care Plan for Your Pool",
      subheadline:
        "We assess your pool's size, usage, and equipment to recommend the right maintenance plan and schedule.",
      ctaLabel: "Book a Free Pool Assessment",
    },
    portfolio: {
      eyebrow: "Pool Renovation Portfolio",
      headline: "Pool Transformations We've Delivered",
      subheadline:
        "Browse our pool resurfacing, renovation, and equipment upgrade projects — results that speak for themselves.",
      ctaLabel: "View Our Portfolio",
    },
    informational: {
      eyebrow: "Pool Maintenance Guides",
      headline: "Keep Your Pool Clear & Safe Year-Round",
      subheadline:
        "Chemical guides, maintenance tips, and professional pool service from local certified technicians.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: [
      "pool service",
      "pool cleaning",
      "pool maintenance",
      "pool care",
    ],
    midTail: [
      "weekly pool service",
      "pool chemical balancing",
      "pool equipment repair",
      "green pool treatment",
      "pool heater installation",
      "pool renovation service",
    ],
    longTail: [
      "weekly pool cleaning service cost",
      "green pool recovery service near me",
      "pool pump repair near me",
      "pool service near me reviews",
      "how to maintain pool water chemistry",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] pool service",
      "best pool cleaner [city]",
    ],
  },

  trustSignals: [
    "Certified Pool Technicians",
    "All Brands Serviced",
    "Weekly Service Plans",
    "Chemicals Always Included",
  ],

  heroImageQueries: [
    "pool technician cleaning swimming pool",
    "sparkling clean backyard pool",
    "pool maintenance service professional",
    "swimming pool crystal clear water",
  ],
};

export default poolService;
