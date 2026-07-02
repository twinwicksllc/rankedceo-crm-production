import type { IndustryContentPack } from "../types";

const moving: IndustryContentPack = {
  trade: "moving",
  displayName: "Moving Services",

  defaultServices: [
    {
      title: "Local House Moving",
      description:
        "Full-service local moving for homes of any size — pack, load, transport, unload, and place.",
      icon: "🏠",
    },
    {
      title: "Interstate Moving",
      description:
        "Long-distance interstate removals with full insurance, tracking, and delivery guarantees.",
      icon: "🚚",
    },
    {
      title: "Packing & Unpacking Services",
      description:
        "Professional packing using quality materials — including full-home or fragile-only packing.",
      icon: "📦",
    },
    {
      title: "Furniture Removal & Disposal",
      description:
        "Single-item or whole-home furniture removal, with eco-friendly disposal and donation options.",
      icon: "🛋️",
    },
    {
      title: "Office & Commercial Relocation",
      description:
        "Planned business relocations with minimal downtime — weekends and after-hours available.",
      icon: "🏢",
    },
    {
      title: "Storage Solutions",
      description:
        "Short and long-term secure storage available as part of your moving package.",
      icon: "🔒",
    },
    {
      title: "Piano & Heavy Item Moving",
      description:
        "Specialist piano movers and heavy appliance transport with the right equipment and expertise.",
      icon: "🎹",
    },
    {
      title: "End-of-Lease Cleaning Add-On",
      description:
        "Optional move-out clean bundled with your removal — inspection-ready results guaranteed.",
      icon: "✨",
    },
  ],

  defaultFaqs: [
    {
      question: "How far in advance should I book a moving company?",
      answer:
        "We recommend booking 2–4 weeks ahead for local moves and 4–6 weeks for interstate. Peak periods (end of month, holidays) book out fast.",
    },
    {
      question: "Are my belongings insured during the move?",
      answer:
        "Yes — we carry full public liability and goods-in-transit insurance. You can also arrange additional coverage for high-value items.",
    },
    {
      question: "Do you provide packing boxes and materials?",
      answer:
        "Yes — we supply quality moving boxes, bubble wrap, packing paper, and mattress covers at competitive prices, or as part of packing service packages.",
    },
    {
      question: "How is moving cost calculated?",
      answer:
        "Local moves are typically priced by the hour (truck + crew). Interstate moves are quoted as a fixed rate based on volume and distance. We provide a clear written quote.",
    },
    {
      question: "Can you move large items like a piano or pool table?",
      answer:
        "Yes — we have specialist equipment and trained crews for pianos, pool tables, safes, and oversized items.",
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow: "Last-Minute Move? We Can Help",
      headline: "Short Notice Moving — Booked & Done",
      subheadline:
        "Sometimes moves happen fast. We accommodate last-minute bookings with a professional, reliable crew.",
      ctaLabel: "Check Last-Minute Availability",
    },
    standard: {
      eyebrow: "Professional Moving Services",
      headline: "Your Move, Handled with Care",
      subheadline:
        "Reliable local and interstate removals — on time, fully insured, and stress-free from first box to last.",
      ctaLabel: "Get a Free Moving Quote",
    },
    conversion: {
      eyebrow: "Moving Services — Free Fixed Quotes",
      headline: "Stress-Free Moving at a Fair Price",
      subheadline:
        "Transparent fixed quotes, professional crews, and full insurance — because your belongings matter.",
      ctaLabel: "Get a Free Quote",
    },
    consultative: {
      eyebrow: "Moving Planning & Advice",
      headline: "Plan Your Perfect Move",
      subheadline:
        "From timeline planning to packing strategies, we help you prepare so your moving day runs without a hitch.",
      ctaLabel: "Book a Free Moving Consult",
    },
    portfolio: {
      eyebrow: "Moving Company Reviews",
      headline: "Trusted by Hundreds of Families",
      subheadline:
        "See why our customers rate us 5 stars — from smooth local moves to complex interstate relocations.",
      ctaLabel: "Read Our Reviews",
    },
    informational: {
      eyebrow: "Moving Guides & Checklists",
      headline: "Everything You Need for a Smooth Move",
      subheadline:
        "Packing guides, moving checklists, and professional removalist service to make your transition seamless.",
      ctaLabel: "Download Our Moving Guide",
    },
  },

  seoKeywords: {
    headTerms: [
      "moving company",
      "removalist",
      "moving services",
      "furniture removals",
    ],
    midTail: [
      "local moving company",
      "interstate removalist",
      "furniture removal service",
      "office relocation service",
      "packing and moving service",
      "cheap movers near me",
    ],
    longTail: [
      "how much does it cost to hire movers",
      "best moving company near me reviews",
      "interstate removalist quotes",
      "same week movers available",
      "moving company with packing service",
    ],
    localModifiers: [
      "near me",
      "local",
      "in [city]",
      "[city] removalists",
      "best moving company [city]",
    ],
  },

  trustSignals: [
    "Fully Insured Moves",
    "No Hidden Fees",
    "On-Time Guarantee",
    "5-Star Rated Service",
  ],

  heroImageQueries: [
    "professional movers loading truck",
    "moving company carrying furniture",
    "removalist team packing boxes",
    "moving truck residential street",
  ],
};

export default moving;
