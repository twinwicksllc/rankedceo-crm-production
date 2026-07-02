import type { IndustryContentPack } from "../types";

const carpenter: IndustryContentPack = {
  trade: "carpenter",
  displayName: "Carpentry Services",

  defaultServices: [
    {
      title: "Custom Cabinetry & Built-Ins",
      description:
        "Fully custom kitchen cabinets, built-in shelving, entertainment units, and wardrobes.",
      icon: "🚪",
    },
    {
      title: "Deck & Porch Construction",
      description:
        "New deck builds and porch construction in hardwood, composite, or pressure-treated timber.",
      icon: "🌳",
    },
    {
      title: "Interior Trim & Moulding",
      description:
        "Crown moulding, baseboards, chair rails, wainscoting, and custom trim installation.",
      icon: "🏠",
    },
    {
      title: "Door Installation & Repair",
      description:
        "Interior and exterior door supply and installation, including French doors and barn doors.",
      icon: "🚪",
    },
    {
      title: "Framing & Structural Carpentry",
      description:
        "Wall framing, floor joist repair, structural reinforcement, and new construction rough framing.",
      icon: "🔧",
    },
    {
      title: "Staircase Design & Construction",
      description:
        "Custom staircase builds, balustrades, handrails, and stair tread replacement.",
      icon: "🪜",
    },
    {
      title: "Hardwood Flooring Installation",
      description:
        "Solid and engineered hardwood flooring supply, installation, sanding, and finishing.",
      icon: "🏡",
    },
    {
      title: "General Repairs & Handyman Carpentry",
      description:
        "Wood rot repair, fence repair, gate building, and all general carpentry tasks.",
      icon: "🔨",
    },
  ],

  defaultFaqs: [
    {
      question: "Do you offer custom carpentry or only standard sizes?",
      answer:
        "We specialise in custom work. Every project is built to your exact specifications — dimensions, timber species, stain, and hardware.",
    },
    {
      question: "How long does it take to build custom cabinets?",
      answer:
        "Custom cabinet projects typically take 4–8 weeks from design approval to installation, depending on scope and material availability.",
    },
    {
      question: "What timber do you recommend for decking?",
      answer:
        "We most commonly use treated pine for budget builds, Merbau for mid-range, and hardwoods like Spotted Gum or Blackbutt for premium durability.",
    },
    {
      question: "Do you handle the design phase?",
      answer:
        "Yes — we provide detailed concept drawings and material samples before any work begins so you can visualise the finished result.",
    },
    {
      question: "Is your work covered by a warranty?",
      answer:
        "All structural and joinery work is backed by a workmanship warranty. We also ensure all materials carry relevant manufacturer guarantees.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "Urgent Carpentry Repairs",
      headline: "Storm Damage or Urgent Repairs — We Respond Fast",
      subheadline:
        "Structural repairs, burst fence sections, or damaged timber — our carpenters are ready to help.",
      ctaLabel: "Call for Urgent Repairs",
    },
    standard: {
      eyebrow: "Master Carpenter & Joinery",
      headline: "Craftsmanship That Stands the Test of Time",
      subheadline:
        "Custom built-ins, deck builds, and precision carpentry by skilled tradespeople who take pride in their work.",
      ctaLabel: "Get a Free Quote",
    },
    conversion: {
      eyebrow: "Custom Carpentry — Competitive Quotes",
      headline: "Quality Timber Work, Built to Your Vision",
      subheadline:
        "Clear quotes, honest timelines, and exceptional craftsmanship on every carpentry project.",
      ctaLabel: "Request a Free Quote",
    },
    consultative: {
      eyebrow: "Custom Carpentry Design Consultation",
      headline: "Your Vision, Brought to Life in Timber",
      subheadline:
        "We collaborate with you from concept drawings through to the final coat — ensuring the result exceeds your expectations.",
      ctaLabel: "Book a Design Consultation",
    },
    portfolio: {
      eyebrow: "Carpentry Portfolio",
      headline: "Our Finest Carpentry Work",
      subheadline:
        "Browse custom cabinetry, deck builds, staircases, and joinery projects that showcase our craftsmanship.",
      ctaLabel: "View Our Portfolio",
    },
    informational: {
      eyebrow: "Carpentry Guides & Expert Service",
      headline: "Everything You Need to Know About Carpentry",
      subheadline:
        "Timber selection guides, project planning tips, and expert carpentry service from skilled local tradespeople.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: [
      "carpenter",
      "carpentry services",
      "joinery",
      "custom carpentry",
    ],
    midTail: [
      "custom cabinet maker",
      "deck builder near me",
      "interior trim installation",
      "hardwood floor installation",
      "door installation service",
      "custom built-ins",
    ],
    longTail: [
      "custom kitchen cabinet cost",
      "deck construction near me price",
      "built-in shelving installation cost",
      "best carpenter for hire",
      "wood rot repair service",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] carpenter",
      "best carpenter [city]",
    ],
  },

  trustSignals: [
    "Licensed & Fully Insured",
    "Custom Work Specialists",
    "Guaranteed Craftsmanship",
    "Free Design Consultations",
  ],

  heroImageQueries: [
    "carpenter crafting custom woodwork",
    "joinery cabinet installation kitchen",
    "master carpenter woodworking",
    "custom deck construction backyard",
  ],
};

export default carpenter;
