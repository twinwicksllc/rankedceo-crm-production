import type { IndustryContentPack } from "../types";

const cleaner: IndustryContentPack = {
  trade: "cleaner",
  displayName: "Cleaning Services",

  defaultServices: [
    {
      title: "Regular House Cleaning",
      description:
        "Weekly, bi-weekly, or monthly home cleaning — dusting, vacuuming, mopping, and more.",
      icon: "🏠",
    },
    {
      title: "Deep Cleaning",
      description:
        "Comprehensive top-to-bottom deep clean for homes that need extra attention or a first-time refresh.",
      icon: "✨",
    },
    {
      title: "Move-In / Move-Out Cleaning",
      description:
        "Thorough cleaning for landlords, tenants, and real estate agents — inspection-ready results.",
      icon: "📦",
    },
    {
      title: "Airbnb & Vacation Rental Cleaning",
      description:
        "Rapid turnover cleaning with fresh linen service, restocking, and photo-ready staging.",
      icon: "🛏️",
    },
    {
      title: "Commercial Office Cleaning",
      description:
        "Regular and one-off cleaning for offices, retail spaces, and commercial properties.",
      icon: "🏢",
    },
    {
      title: "Post-Construction Cleaning",
      description:
        "Dust-free, debris-cleared post-build and renovation cleaning for builders and homeowners.",
      icon: "🔧",
    },
    {
      title: "Carpet & Upholstery Cleaning",
      description:
        "Hot-water extraction carpet cleaning and upholstery sanitisation by certified technicians.",
      icon: "🛋️",
    },
    {
      title: "Window Cleaning",
      description:
        "Streak-free interior and exterior window cleaning for homes and commercial buildings.",
      icon: "🪟",
    },
  ],

  defaultFaqs: [
    {
      question: "Do I need to be home during the cleaning?",
      answer:
        "No — many clients provide a key or door code. We are fully insured, and all cleaners are background-checked for your peace of mind.",
    },
    {
      question:
        "What is the difference between a regular clean and a deep clean?",
      answer:
        "A regular clean maintains your home. A deep clean addresses areas often skipped — inside appliances, baseboards, grout lines, light fixtures, and behind furniture.",
    },
    {
      question: "Do you bring your own cleaning products?",
      answer:
        "Yes — we supply all professional-grade cleaning products and equipment. We also offer eco-friendly product options on request.",
    },
    {
      question: "How is your pricing calculated?",
      answer:
        "We price based on home size, cleaning type, and frequency. You receive a fixed quote upfront — no hourly surprises.",
    },
    {
      question: "Can I skip or reschedule a cleaning?",
      answer:
        "Yes — we offer flexible scheduling with 48-hour notice for skips or changes. Recurring clients get priority booking.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "Same-Day Cleaning Available",
      headline: "Last-Minute Cleaning? We've Got You",
      subheadline:
        "Move-out deadlines, guest arrivals, post-party — we respond fast with thorough, reliable cleaning.",
      ctaLabel: "Book a Same-Day Clean",
    },
    standard: {
      eyebrow: "Professional Cleaning Services",
      headline: "A Cleaner Home, Less Stress",
      subheadline:
        "Trusted, background-checked cleaners who deliver consistent results every single visit.",
      ctaLabel: "Get a Free Quote",
    },
    conversion: {
      eyebrow: "Cleaning Services — Instant Online Booking",
      headline: "Book Your Clean in Under 60 Seconds",
      subheadline:
        "Fixed pricing, vetted cleaners, and a satisfaction guarantee — no contracts required.",
      ctaLabel: "Book Online Now",
    },
    consultative: {
      eyebrow: "Custom Cleaning Plans",
      headline: "A Cleaning Plan Built Around Your Home",
      subheadline:
        "We assess your space and build a custom recurring cleaning plan that keeps every corner spotless.",
      ctaLabel: "Get a Custom Quote",
    },
    portfolio: {
      eyebrow: "Cleaning Results",
      headline: "Before & After — See the Difference",
      subheadline:
        "Browse our cleaning transformations — from dusty move-outs to sparkling Airbnb turnovers.",
      ctaLabel: "See Our Results",
    },
    informational: {
      eyebrow: "Cleaning Tips & Professional Service",
      headline: "Keep Your Home Cleaner, Effortlessly",
      subheadline:
        "Expert cleaning tips, product recommendations, and professional home cleaning service from a trusted local team.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: [
      "cleaning service",
      "house cleaning",
      "maid service",
      "cleaning company",
    ],
    midTail: [
      "deep cleaning service",
      "move out cleaning",
      "Airbnb cleaning service",
      "office cleaning near me",
      "regular house cleaning service",
      "post construction cleaning",
    ],
    longTail: [
      "how much does house cleaning cost",
      "best house cleaning service near me",
      "move out cleaning checklist",
      "recurring maid service price",
      "Airbnb turnover cleaning service",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] cleaning service",
      "best cleaner [city]",
    ],
  },

  trustSignals: [
    "Background-Checked Cleaners",
    "Fully Insured & Bonded",
    "Satisfaction Guarantee",
    "Eco-Friendly Options Available",
  ],

  heroImageQueries: [
    "professional cleaner cleaning kitchen",
    "maid service home cleaning",
    "cleaning service sparkling bathroom",
    "house cleaner with supplies",
  ],
};

export default cleaner;
