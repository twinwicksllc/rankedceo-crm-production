import type { IndustryContentPack } from "../types";

const plumber: IndustryContentPack = {
  trade: "plumber",
  displayName: "Plumbing Services",

  defaultServices: [
    {
      title: "Emergency Leak Repair",
      description:
        "Rapid response to burst pipes, active leaks, and water damage — day or night.",
      icon: "🚨",
    },
    {
      title: "Drain Cleaning & Unclogging",
      description:
        "Camera-inspected drain clearing for kitchens, bathrooms, and main sewer lines.",
      icon: "🔧",
    },
    {
      title: "Water Heater Installation & Repair",
      description:
        "Same-day water heater replacement, tank and tankless systems, all brands.",
      icon: "🔥",
    },
    {
      title: "Pipe Repair & Replacement",
      description:
        "Trenchless and traditional pipe repair for copper, PVC, and cast-iron systems.",
      icon: "🔩",
    },
    {
      title: "Fixture Installation",
      description:
        "Faucets, toilets, sinks, showers, and garbage disposals — supply and install.",
      icon: "🚿",
    },
    {
      title: "Water Pressure & Quality Testing",
      description:
        "Diagnose low pressure, hard water, and water quality issues with on-site testing.",
      icon: "📊",
    },
    {
      title: "Sewer Line Services",
      description:
        "Sewer camera inspections, hydro-jetting, and full sewer line replacement.",
      icon: "🔍",
    },
    {
      title: "Remodelling & New Construction Plumbing",
      description:
        "Rough-in plumbing for kitchen and bathroom remodels and new builds.",
      icon: "🏗️",
    },
  ],

  defaultFaqs: [
    {
      question: "How quickly can you respond to a plumbing emergency?",
      answer:
        "We offer same-day and 24/7 emergency response. Most urgent calls are attended within 60–90 minutes.",
    },
    {
      question: "Are your plumbers licensed and insured?",
      answer:
        "Yes — all our plumbers are fully licensed, bonded, and carry liability insurance for your protection.",
    },
    {
      question: "How much does a drain cleaning service cost?",
      answer:
        "Standard drain cleaning starts at a flat rate. We provide a clear quote before any work begins — no hidden fees.",
    },
    {
      question: "Can you replace my water heater the same day?",
      answer:
        "In most cases, yes. We carry common tank and tankless units on our trucks for same-day replacement.",
    },
    {
      question: "Do you offer a warranty on plumbing repairs?",
      answer:
        "All our repairs and installations come with a workmanship warranty. Parts carry manufacturer warranties.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "24/7 Emergency Plumber",
      headline: "Fast Plumbing Fixes — Day or Night",
      subheadline:
        "Burst pipes, blocked drains, no hot water — we respond fast and fix it right the first time.",
      ctaLabel: "Call Now — We're Available 24/7",
    },
    standard: {
      eyebrow: "Licensed Local Plumber",
      headline: "Reliable Plumbing You Can Count On",
      subheadline:
        "From small repairs to full installations, we deliver quality plumbing work with upfront pricing.",
      ctaLabel: "Book a Free Estimate",
    },
    conversion: {
      eyebrow: "Plumbing Services — Upfront Pricing",
      headline: "Quality Plumbing, No Surprises",
      subheadline:
        "Transparent quotes, licensed technicians, and guaranteed workmanship on every job.",
      ctaLabel: "Get a Free Quote",
    },
    consultative: {
      eyebrow: "Expert Plumbing Advice & Service",
      headline: "Plumbing Done Properly, Explained Clearly",
      subheadline:
        "We walk you through every option so you can make confident, informed decisions about your plumbing.",
      ctaLabel: "Schedule a Consultation",
    },
    portfolio: {
      eyebrow: "Plumbing Portfolio",
      headline: "See the Quality We Deliver",
      subheadline:
        "Browse completed projects — from simple repairs to full bathroom and kitchen plumbing fitouts.",
      ctaLabel: "View Our Work",
    },
    informational: {
      eyebrow: "Your Local Plumbing Experts",
      headline: "Everything You Need to Know About Your Plumbing",
      subheadline:
        "Helpful guides, honest advice, and professional service from a team that puts knowledge first.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: ["plumber", "plumbing services", "plumbing company"],
    midTail: [
      "emergency plumber",
      "licensed plumber",
      "local plumbing services",
      "drain cleaning service",
      "water heater repair",
      "pipe repair service",
    ],
    longTail: [
      "burst pipe repair near me",
      "same day water heater replacement",
      "24 hour plumber emergency",
      "blocked drain plumber cost",
      "best plumber in area",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] plumber",
      "best plumber [city]",
    ],
  },

  trustSignals: [
    "Licensed & Fully Insured",
    "24/7 Emergency Response",
    "Upfront Flat-Rate Pricing",
    "5-Star Rated Service",
  ],

  heroImageQueries: [
    "plumber fixing pipe under sink",
    "professional plumber at work",
    "plumbing repair bathroom",
    "water pipe installation",
  ],
};

export default plumber;
