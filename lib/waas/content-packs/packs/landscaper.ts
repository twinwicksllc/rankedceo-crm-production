import type { IndustryContentPack } from "../types";

const landscaper: IndustryContentPack = {
  trade: "landscaper",
  displayName: "Landscaping Services",

  defaultServices: [
    {
      title: "Lawn Mowing & Maintenance",
      description:
        "Weekly and bi-weekly mowing, edging, and blowing for residential and commercial properties.",
      icon: "🌿",
    },
    {
      title: "Landscape Design & Installation",
      description:
        "Custom garden design, plant selection, and full landscape installation by certified designers.",
      icon: "🌺",
    },
    {
      title: "Irrigation System Installation & Repair",
      description:
        "Smart sprinkler system design, installation, and seasonal start-up/winterisation.",
      icon: "💧",
    },
    {
      title: "Tree Trimming & Removal",
      description:
        "Certified arborists for safe tree pruning, storm damage removal, and stump grinding.",
      icon: "🌳",
    },
    {
      title: "Hardscape Installation",
      description:
        "Patios, retaining walls, walkways, and driveways in pavers, natural stone, or concrete.",
      icon: "🧱",
    },
    {
      title: "Mulching & Seasonal Clean-Ups",
      description:
        "Spring and fall clean-ups, fresh mulch installation, and leaf removal.",
      icon: "🍂",
    },
    {
      title: "Sod & Lawn Seeding",
      description:
        "Fresh sod installation and over-seeding programs to restore or create lush lawns.",
      icon: "🌱",
    },
    {
      title: "Fertilisation & Weed Control",
      description:
        "Customised lawn care programs with soil testing, fertilisation, and targeted weed control.",
      icon: "🧪",
    },
  ],

  defaultFaqs: [
    {
      question: "How often should my lawn be mowed?",
      answer:
        "During peak growing season, weekly mowing keeps your lawn healthy and looking its best. We offer flexible weekly and bi-weekly schedules.",
    },
    {
      question: "Do you offer annual lawn care contracts?",
      answer:
        "Yes — seasonal maintenance agreements provide consistent care at reduced per-visit rates. We customise plans to your property's needs.",
    },
    {
      question: "When is the best time to plant new trees and shrubs?",
      answer:
        "Spring and fall are ideal for most plantings. We advise on the best timing based on your local climate and selected species.",
    },
    {
      question: "Can you design a landscape from scratch?",
      answer:
        "Absolutely — our designers create 3D concept plans, handle plant sourcing, and manage the complete installation.",
    },
    {
      question: "Do you handle snow removal in winter?",
      answer:
        "Many of our clients are on year-round contracts that include snow ploughing and salting — ask us about seasonal packages.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "Storm Damage Cleanup",
      headline: "Fallen Trees & Storm Damage — Cleared Fast",
      subheadline:
        "We respond quickly to storm-damaged trees, debris, and property hazards so you can stay safe.",
      ctaLabel: "Call for Emergency Cleanup",
    },
    standard: {
      eyebrow: "Professional Landscaping Services",
      headline: "Beautiful Outdoor Spaces, Maintained Properly",
      subheadline:
        "Expert lawn care, landscape design, and property maintenance by certified landscaping professionals.",
      ctaLabel: "Get a Free Estimate",
    },
    conversion: {
      eyebrow: "Landscaping — Upfront Pricing",
      headline: "Your Best-Looking Lawn, Guaranteed",
      subheadline:
        "Quality landscaping with transparent quotes and recurring maintenance plans that fit your budget.",
      ctaLabel: "Get a Free Quote",
    },
    consultative: {
      eyebrow: "Landscape Design Consultation",
      headline: "Transform Your Outdoor Space",
      subheadline:
        "We listen to your vision, assess your property, and deliver a personalised design that exceeds expectations.",
      ctaLabel: "Book a Design Consultation",
    },
    portfolio: {
      eyebrow: "Landscaping Portfolio",
      headline: "Outdoor Transformations We've Created",
      subheadline:
        "From simple lawn refreshes to complete garden makeovers — see the difference our team makes.",
      ctaLabel: "View Our Portfolio",
    },
    informational: {
      eyebrow: "Lawn & Garden Expertise",
      headline: "Expert Landscaping Advice & Service",
      subheadline:
        "Seasonal tips, plant care guides, and professional landscaping from a team that loves outdoor spaces.",
      ctaLabel: "Learn More",
    },
  },

  seoKeywords: {
    headTerms: [
      "landscaper",
      "landscaping services",
      "lawn care",
      "landscaping company",
    ],
    midTail: [
      "lawn mowing service",
      "landscape design near me",
      "irrigation installation",
      "tree trimming service",
      "hardscape contractor",
      "lawn fertilisation service",
    ],
    longTail: [
      "best landscaping company near me",
      "lawn care service cost",
      "landscape design ideas small yard",
      "patio installation contractor",
      "weekly lawn mowing near me",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] landscaping",
      "best lawn care [city]",
    ],
  },

  trustSignals: [
    "Licensed & Insured",
    "Certified Landscape Professionals",
    "Eco-Friendly Practices",
    "100% Satisfaction Guarantee",
  ],

  heroImageQueries: [
    "landscaper maintaining garden professional",
    "beautiful residential garden landscaping",
    "lawn care service mowing",
    "landscape design outdoor patio",
  ],
};

export default landscaper;
