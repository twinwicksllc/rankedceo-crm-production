import type { IndustryContentPack } from "../types";

const electrician: IndustryContentPack = {
  trade: "electrician",
  displayName: "Electrical Services",

  defaultServices: [
    {
      title: "Electrical Panel Upgrades",
      description:
        "Service panel replacement and load-centre upgrades to safely meet modern demand.",
      icon: "⚡",
    },
    {
      title: "Outlet & Switch Installation",
      description:
        "Add new outlets, USB ports, GFCI and AFCI devices anywhere in your home or business.",
      icon: "🔌",
    },
    {
      title: "Lighting Installation & Repair",
      description:
        "Recessed lighting, ceiling fans, outdoor fixtures, and LED retrofits — supply and fit.",
      icon: "💡",
    },
    {
      title: "EV Charger Installation",
      description:
        "Level 2 home and commercial EV charging station installation by certified electricians.",
      icon: "🔋",
    },
    {
      title: "Wiring & Rewiring",
      description:
        "Safe rewiring of older homes, new construction rough-in, and panel feeder upgrades.",
      icon: "🔧",
    },
    {
      title: "Electrical Safety Inspections",
      description:
        "Full home and commercial electrical inspections with detailed written reports.",
      icon: "🔍",
    },
    {
      title: "Generator Installation",
      description:
        "Standby and portable generator hookups with automatic transfer switches.",
      icon: "🏭",
    },
    {
      title: "Smart Home & Automation Wiring",
      description:
        "Pre-wire and retrofit wiring for smart thermostats, lighting, and security systems.",
      icon: "🏠",
    },
  ],

  defaultFaqs: [
    {
      question: "Do I need a permit for electrical work?",
      answer:
        "Most panel upgrades and new circuit work requires a permit. We handle the permit application and inspection scheduling on your behalf.",
    },
    {
      question: "How do I know if my electrical panel needs upgrading?",
      answer:
        "Signs include frequently tripped breakers, flickering lights, burning smells, or a panel older than 25 years. We offer free panel assessments.",
    },
    {
      question: "Are your electricians licensed?",
      answer:
        "Yes — all our electricians hold current state licences and we carry full liability and workers' compensation insurance.",
    },
    {
      question: "Can you install an EV charger in my garage?",
      answer:
        "Absolutely. We install Level 2 (240 V) chargers for all major vehicle brands and handle any necessary panel upgrades.",
    },
    {
      question: "What is a GFCI outlet and do I need one?",
      answer:
        "GFCI outlets protect against electrical shock in wet areas. Code requires them in bathrooms, kitchens, garages, and outdoors — we can upgrade yours quickly.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "24/7 Emergency Electrician",
      headline: "Power Problems Solved — Fast & Safe",
      subheadline:
        "Tripped breakers, sparking outlets, total power loss — our licensed electricians respond any time.",
      ctaLabel: "Call Now — Emergency Service",
    },
    standard: {
      eyebrow: "Licensed Local Electrician",
      headline: "Safe, Reliable Electrical Work",
      subheadline:
        "From small repairs to full panel upgrades, we deliver quality electrical work with upfront pricing.",
      ctaLabel: "Book a Free Estimate",
    },
    conversion: {
      eyebrow: "Electrical Services — Transparent Pricing",
      headline: "Certified Electrical Work, No Surprises",
      subheadline:
        "Licensed electricians, clear quotes, and guaranteed workmanship on every job we take.",
      ctaLabel: "Get a Free Quote",
    },
    consultative: {
      eyebrow: "Expert Electrical Advice & Service",
      headline: "Electrical Work Explained Clearly",
      subheadline:
        "We assess your needs honestly and walk you through every option — so you make the right call.",
      ctaLabel: "Schedule a Consultation",
    },
    portfolio: {
      eyebrow: "Electrical Projects Portfolio",
      headline: "Quality Electrical Work You Can See",
      subheadline:
        "Browse our completed projects — panel upgrades, custom lighting, smart-home installs, and more.",
      ctaLabel: "View Our Work",
    },
    informational: {
      eyebrow: "Your Local Electrical Experts",
      headline: "Trustworthy Electrical Information & Service",
      subheadline:
        "Safety guides, code-compliance advice, and professional electrical service from a team you can trust.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: ["electrician", "electrical services", "electrical contractor"],
    midTail: [
      "licensed electrician",
      "emergency electrician",
      "electrical panel upgrade",
      "EV charger installation",
      "home rewiring service",
      "electrical inspection",
    ],
    longTail: [
      "electrical panel replacement cost",
      "EV charger installer near me",
      "24 hour electrician emergency",
      "GFCI outlet installation price",
      "best electrician in area",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] electrician",
      "best electrician [city]",
    ],
  },

  trustSignals: [
    "State Licensed & Insured",
    "Permit & Inspection Ready",
    "Upfront Fixed Pricing",
    "Safety-First Guarantee",
  ],

  heroImageQueries: [
    "electrician working on electrical panel",
    "licensed electrician installing outlet",
    "electrical wiring professional",
    "electrician with circuit breaker",
  ],
};

export default electrician;
