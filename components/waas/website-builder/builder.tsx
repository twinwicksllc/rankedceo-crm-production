"use client";

// =============================================================================
// WaaS Website Builder — adapted from the v0 "Blocksmith" design
// (github.com/twinwicksllc/webpage-builder-assistance)
//
// Differences from the standalone v0 version:
//   • Renders full-screen (fixed inset-0) as Step 6 of onboarding
//   • Header has "← Back" and "Submit for Admin Review" instead of Export
//   • Initial blocks are pre-filled from the customer's onboarding answers
//   • onSubmit/onBack/isLoading props replace standalone state
//   • Export HTML button kept as a secondary "Preview" action for the customer
// =============================================================================

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ChevronRight,
  Eye,
  Layers,
  Loader2,
  MousePointer2,
  Trash2,
} from "lucide-react";
import { BlockPalette } from "./block-palette";
import { CanvasBlock } from "./canvas-block";
import { Inspector } from "./inspector";
import { BuilderWelcomeModal } from "./builder-welcome-modal";
import {
  type Block,
  type BlockType,
  createBlock,
} from "@/lib/waas/website-builder/blocks";
import { TEMPLATE_REGISTRY } from "@/lib/waas/templates/registry";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Pre-fill helper — builds initial blocks from onboarding answers
// ---------------------------------------------------------------------------

export interface OnboardingPrefill {
  businessName: string;
  primaryTrade: string | null;
  selectedTemplateSlug: string | null | undefined;
  logoUrl: string | null | undefined;
  primaryColor: string | undefined;
  secondaryColor: string | undefined;
  textColor: string | undefined;
  tagline: string | undefined;
  usp: string;
  servicesOffered: string | undefined;
  aboutNarrative: string | undefined;
  primaryCta: string | undefined;
  city: string | undefined;
  state: string | undefined;
}

function parseList(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  const lines = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 1
    ? lines
    : raw
        .split(/,/)
        .map((l) => l.trim())
        .filter(Boolean);
}

function isHexColor(value: string | undefined | null): value is string {
  return Boolean(value && /^#[0-9A-Fa-f]{6}$/.test(value));
}

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

function getStringField(
  source: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = source?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}
// ---------------------------------------------------------------------------
// Per-section block builders
// ---------------------------------------------------------------------------

type HeroBlock = Extract<Block, { type: "hero" }>;
type HeadingBlock = Extract<Block, { type: "heading" }>;
type TextBlock = Extract<Block, { type: "text" }>;
type SpacerBlock = Extract<Block, { type: "spacer" }>;

function mkHero(overrides: Partial<HeroBlock>): HeroBlock {
  return { ...(createBlock("hero") as HeroBlock), ...overrides };
}

const HERO_VARIANTS: HeroBlock["variant"][] = [
  "centered",
  "split",
  "editorial",
  "emergency",
  "full-bleed-gallery",
];

function getDefaultHeroVariant(
  templateSlug: string | null | undefined,
): HeroBlock["variant"] {
  const template = TEMPLATE_REGISTRY[templateSlug ?? ""] ?? TEMPLATE_REGISTRY.modern;

  switch (template.aesthetic) {
    case "urgent":
      return "emergency";
    case "premium":
      return "editorial";
    case "visual":
      return "full-bleed-gallery";
    case "bold":
      return "split";
    default:
      return "centered";
  }
}

function resolveHeroVariant(
  sectionConfig: Record<string, unknown> | undefined,
  templateSlug: string | null | undefined,
): HeroBlock["variant"] {
  const variantCandidate = sectionConfig?.variant;
  if (
    typeof variantCandidate === "string" &&
    HERO_VARIANTS.includes(variantCandidate as HeroBlock["variant"])
  ) {
    return variantCandidate as HeroBlock["variant"];
  }

  return getDefaultHeroVariant(templateSlug);
}

interface TemplateVisualPreset {
  appBackground: string;
  canvasBackground: string;
  canvasBorder: string;
  canvasShadow: string;
  canvasRadius: string;
  blockBackground: string;
  blockBorder: string;
  blockShadow: string;
  blockRadius: string;
  heroGradient: string;
  dividerColor: string;
  displayFont: string;
  bodyFont: string;
  copyColor: string;
}

function getTemplateVisualPreset(
  templateSlug: string | null | undefined,
): TemplateVisualPreset {
  const template = TEMPLATE_REGISTRY[templateSlug ?? ""] ?? TEMPLATE_REGISTRY.modern;

  switch (template.slug) {
    case "bold":
      return {
        appBackground: "linear-gradient(145deg, #0F172A 0%, #1E293B 52%, #111827 100%)",
        canvasBackground: "#0B1220",
        canvasBorder: "#334155",
        canvasShadow: "0 26px 54px rgba(15, 23, 42, 0.5)",
        canvasRadius: "16px",
        blockBackground: "#111C2E",
        blockBorder: "#334155",
        blockShadow: "0 14px 28px rgba(2, 6, 23, 0.45)",
        blockRadius: "14px",
        heroGradient: "linear-gradient(135deg, #1E293B 0%, #334155 45%, #0F172A 100%)",
        dividerColor: "#475569",
        displayFont: "'Archivo Black', 'Arial Black', sans-serif",
        bodyFont: "'Barlow', 'Segoe UI', sans-serif",
        copyColor: "#CBD5E1",
      };
    case "trust-first":
      return {
        appBackground: "linear-gradient(160deg, #F8FFFC 0%, #ECFDF5 46%, #F0FDFA 100%)",
        canvasBackground: "#FFFFFF",
        canvasBorder: "#A7F3D0",
        canvasShadow: "0 22px 50px rgba(6, 95, 70, 0.16)",
        canvasRadius: "24px",
        blockBackground: "#FFFFFF",
        blockBorder: "#D1FAE5",
        blockShadow: "0 12px 24px rgba(5, 150, 105, 0.12)",
        blockRadius: "20px",
        heroGradient: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 50%, #F0FDFA 100%)",
        dividerColor: "#A7F3D0",
        displayFont: "'Merriweather', 'Georgia', serif",
        bodyFont: "'Source Sans 3', 'Segoe UI', sans-serif",
        copyColor: "#1F2937",
      };
    case "local-pro":
      return {
        appBackground: "linear-gradient(155deg, #FFFBEB 0%, #FEF3C7 52%, #FFF7ED 100%)",
        canvasBackground: "#FFFBF2",
        canvasBorder: "#FCD34D",
        canvasShadow: "0 20px 42px rgba(180, 83, 9, 0.18)",
        canvasRadius: "22px",
        blockBackground: "#FFFFFF",
        blockBorder: "#FDE68A",
        blockShadow: "0 10px 22px rgba(202, 138, 4, 0.14)",
        blockRadius: "18px",
        heroGradient: "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 52%, #FDE68A 100%)",
        dividerColor: "#FBBF24",
        displayFont: "'Alegreya Sans SC', 'Trebuchet MS', sans-serif",
        bodyFont: "'Nunito Sans', 'Segoe UI', sans-serif",
        copyColor: "#7C2D12",
      };
    case "premium":
      return {
        appBackground: "linear-gradient(150deg, #F8FAFC 0%, #E2E8F0 38%, #F1F5F9 100%)",
        canvasBackground: "#FFFFFF",
        canvasBorder: "#CBD5E1",
        canvasShadow: "0 24px 50px rgba(15, 23, 42, 0.18)",
        canvasRadius: "14px",
        blockBackground: "#F8FAFC",
        blockBorder: "#E2E8F0",
        blockShadow: "0 12px 24px rgba(30, 41, 59, 0.1)",
        blockRadius: "12px",
        heroGradient: "linear-gradient(140deg, #E2E8F0 0%, #F8FAFC 48%, #E5E7EB 100%)",
        dividerColor: "#CBD5E1",
        displayFont: "'Playfair Display', 'Georgia', serif",
        bodyFont: "'Lato', 'Segoe UI', sans-serif",
        copyColor: "#334155",
      };
    case "emergency":
      return {
        appBackground: "linear-gradient(140deg, #1F2937 0%, #111827 36%, #7F1D1D 100%)",
        canvasBackground: "#0F172A",
        canvasBorder: "#EF4444",
        canvasShadow: "0 24px 50px rgba(127, 29, 29, 0.36)",
        canvasRadius: "12px",
        blockBackground: "#111827",
        blockBorder: "#7F1D1D",
        blockShadow: "0 12px 26px rgba(127, 29, 29, 0.34)",
        blockRadius: "10px",
        heroGradient: "linear-gradient(135deg, #B91C1C 0%, #EF4444 48%, #7F1D1D 100%)",
        dividerColor: "#EF4444",
        displayFont: "'Bebas Neue', 'Impact', sans-serif",
        bodyFont: "'Rajdhani', 'Segoe UI', sans-serif",
        copyColor: "#E5E7EB",
      };
    case "showcase":
      return {
        appBackground: "linear-gradient(155deg, #ECFEFF 0%, #E0F2FE 45%, #EDE9FE 100%)",
        canvasBackground: "#FFFFFF",
        canvasBorder: "#C4B5FD",
        canvasShadow: "0 24px 50px rgba(79, 70, 229, 0.18)",
        canvasRadius: "28px",
        blockBackground: "#FFFFFF",
        blockBorder: "#DDD6FE",
        blockShadow: "0 14px 24px rgba(124, 58, 237, 0.12)",
        blockRadius: "22px",
        heroGradient: "linear-gradient(135deg, #DBEAFE 0%, #C4B5FD 52%, #E9D5FF 100%)",
        dividerColor: "#A5B4FC",
        displayFont: "'Outfit', 'Avenir Next', sans-serif",
        bodyFont: "'DM Sans', 'Segoe UI', sans-serif",
        copyColor: "#334155",
      };
    case "consultative":
      return {
        appBackground: "linear-gradient(150deg, #EEF2FF 0%, #DDD6FE 45%, #F8FAFC 100%)",
        canvasBackground: "#F8FAFC",
        canvasBorder: "#A5B4FC",
        canvasShadow: "0 20px 44px rgba(67, 56, 202, 0.16)",
        canvasRadius: "18px",
        blockBackground: "#FFFFFF",
        blockBorder: "#C7D2FE",
        blockShadow: "0 10px 20px rgba(99, 102, 241, 0.12)",
        blockRadius: "14px",
        heroGradient: "linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 48%, #DDD6FE 100%)",
        dividerColor: "#A5B4FC",
        displayFont: "'IBM Plex Serif', 'Georgia', serif",
        bodyFont: "'IBM Plex Sans', 'Segoe UI', sans-serif",
        copyColor: "#3730A3",
      };
    case "community":
      return {
        appBackground: "linear-gradient(160deg, #FFF7ED 0%, #FFEDD5 46%, #FEF3C7 100%)",
        canvasBackground: "#FFFBEB",
        canvasBorder: "#FDBA74",
        canvasShadow: "0 20px 40px rgba(194, 65, 12, 0.18)",
        canvasRadius: "26px",
        blockBackground: "#FFFFFF",
        blockBorder: "#FED7AA",
        blockShadow: "0 10px 20px rgba(194, 65, 12, 0.12)",
        blockRadius: "20px",
        heroGradient: "linear-gradient(135deg, #FFEDD5 0%, #FED7AA 50%, #FEF3C7 100%)",
        dividerColor: "#FB923C",
        displayFont: "'Bitter', 'Georgia', serif",
        bodyFont: "'Quicksand', 'Segoe UI', sans-serif",
        copyColor: "#7C2D12",
      };
    case "conversion":
      return {
        appBackground: "linear-gradient(145deg, #ECFDF5 0%, #D1FAE5 42%, #FEF9C3 100%)",
        canvasBackground: "#FFFFFF",
        canvasBorder: "#6EE7B7",
        canvasShadow: "0 24px 50px rgba(5, 150, 105, 0.2)",
        canvasRadius: "14px",
        blockBackground: "#FFFFFF",
        blockBorder: "#A7F3D0",
        blockShadow: "0 12px 22px rgba(5, 150, 105, 0.14)",
        blockRadius: "12px",
        heroGradient: "linear-gradient(135deg, #86EFAC 0%, #34D399 45%, #FDE047 100%)",
        dividerColor: "#10B981",
        displayFont: "'Montserrat', 'Avenir Next', sans-serif",
        bodyFont: "'Mulish', 'Segoe UI', sans-serif",
        copyColor: "#14532D",
      };
    case "modern":
    default:
      return {
        appBackground: "linear-gradient(145deg, #F8FAFC 0%, #EEF2FF 52%, #F1F5F9 100%)",
        canvasBackground: "#FFFFFF",
        canvasBorder: "#BFDBFE",
        canvasShadow: "0 20px 46px rgba(30, 64, 175, 0.16)",
        canvasRadius: "20px",
        blockBackground: "#FFFFFF",
        blockBorder: "#DBEAFE",
        blockShadow: "0 10px 20px rgba(37, 99, 235, 0.1)",
        blockRadius: "16px",
        heroGradient: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 45%, #E0E7FF 100%)",
        dividerColor: "#BFDBFE",
        displayFont: "'Sora', 'Avenir Next', 'Segoe UI', sans-serif",
        bodyFont: "'Manrope', 'Inter', 'Segoe UI', sans-serif",
        copyColor: "#334155",
      };
  }
}

function mkH2(text: string): HeadingBlock {
  return {
    ...(createBlock("heading") as HeadingBlock),
    text,
    level: "h2",
    align: "left",
  };
}
function mkH3(text: string): HeadingBlock {
  return {
    ...(createBlock("heading") as HeadingBlock),
    text,
    level: "h3",
    align: "left",
  };
}
function mkText(text: string): TextBlock {
  return { ...(createBlock("text") as TextBlock), text, align: "left" };
}
function mkSpacer(size: SpacerBlock["size"] = "sm"): SpacerBlock {
  return { ...(createBlock("spacer") as SpacerBlock), size };
}

function sectionHero(
  p: OnboardingPrefill,
  location: string,
  tradeLabel: string,
  sectionContent: Record<string, unknown> | undefined,
  sectionConfig: Record<string, unknown> | undefined,
): Block[] {
  const templateEyebrow = getStringField(sectionContent, "eyebrow");
  const templateHeadline = getStringField(sectionContent, "headline");
  const templateSubheadline = getStringField(sectionContent, "subheadline");
  const templatePrimaryCta = getStringField(sectionContent, "primaryCtaLabel");
  const variant = resolveHeroVariant(sectionConfig, p.selectedTemplateSlug);
  const blocks: Block[] = [];

  if (p.logoUrl) {
    blocks.push({
      ...(createBlock("image") as Extract<Block, { type: "image" }>),
      src: p.logoUrl,
      alt: `${p.businessName || "Business"} logo`,
      rounded: false,
    });
    blocks.push(mkSpacer("sm"));
  }

  blocks.push(
    mkHero({
      eyebrow: templateEyebrow ?? tradeLabel,
      title:
        p.tagline ||
        templateHeadline ||
        `${p.businessName || "Your Business"} — Trusted ${p.primaryTrade || "Professionals"}`,
      subtitle:
        p.usp ||
        templateSubheadline ||
        `Serving ${location || "your area"} with quality and care.`,
      buttonLabel: p.primaryCta || templatePrimaryCta || "Get a Free Quote",
      align: "center",
      variant,
    }),
  );

  return blocks;
}

function sectionServices(
  p: OnboardingPrefill,
  tradeLabel: string,
  sectionContent: Record<string, unknown> | undefined,
): Block[] {
  const services = parseList(p.servicesOffered).slice(0, 6);
  const contentItems = Array.isArray(sectionContent?.items)
    ? sectionContent.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const title = (item as Record<string, unknown>).title;
          return typeof title === "string" && title.trim().length > 0
            ? title
            : null;
        })
        .filter((item): item is string => Boolean(item))
        .slice(0, 6)
    : [];

  const mergedServices = services.length > 0 ? services : contentItems;
  if (mergedServices.length === 0) return [];

  const servicesHeadline =
    getStringField(sectionContent, "headline") ?? `Our ${tradeLabel}`;

  const blocks: Block[] = [
    mkH2(servicesHeadline),
    ...mergedServices.map((svc) => mkH3(svc)),
    mkSpacer("sm"),
  ];
  return blocks;
}

function sectionAbout(
  p: OnboardingPrefill,
  sectionContent: Record<string, unknown> | undefined,
): Block[] {
  const body = p.aboutNarrative;
  const aboutHeadline =
    getStringField(sectionContent, "headline") ?? `About ${p.businessName || "Us"}`;
  const aboutBody = getStringField(sectionContent, "body");
  const blocks: Block[] = [
    mkH2(aboutHeadline),
    ...(body
      ? [mkText(body)]
      : aboutBody
        ? [mkText(aboutBody)]
      : [
          mkText(
            `${p.businessName || "We"} are dedicated to providing top-quality ${p.primaryTrade ? p.primaryTrade.toLowerCase() : ""} services.`,
          ),
        ]),
    mkSpacer("sm"),
  ];
  return blocks;
}

function sectionTrust(p: OnboardingPrefill): Block[] {
  const sectionHeadline = `Why Choose ${p.businessName || "Us"}`;
  return [
    mkH2(sectionHeadline),
    mkText(
      "Licensed & Insured  ·  5-Star Rated  ·  Fast Response  ·  Free Estimates",
    ),
    mkSpacer("sm"),
  ];
}

function sectionReviews(sectionContent: Record<string, unknown> | undefined): Block[] {
  const headline = getStringField(sectionContent, "headline") ?? "What Our Customers Say";
  const subheadline =
    getStringField(sectionContent, "subheadline") ??
    '⭐⭐⭐⭐⭐  "Exceptional service — on time, professional, and great value."  — Verified Customer';

  return [
    mkH2(headline),
    mkText(subheadline),
    mkSpacer("sm"),
  ];
}

function sectionFaq(p: OnboardingPrefill, location: string): Block[] {
  return [
    mkH2("Frequently Asked Questions"),
    mkH3(`How quickly can ${p.businessName || "you"} respond?`),
    mkText(
      "We typically respond within 1 hour and can offer same-day service in most cases.",
    ),
    mkH3(`What areas do you serve?`),
    mkText(
      location
        ? `We proudly serve ${location} and surrounding areas.`
        : "Contact us to confirm your service area.",
    ),
    mkH3("Do you offer free estimates?"),
    mkText("Yes — all estimates are free with no obligation."),
    mkSpacer("sm"),
  ];
}

function sectionHowItWorks(p: OnboardingPrefill): Block[] {
  return [
    mkH2("How It Works"),
    mkH3("1. Contact Us"),
    mkText(`Reach out by phone or form — we respond fast.`),
    mkH3("2. Get a Free Estimate"),
    mkText("We'll assess your needs and provide a clear, upfront quote."),
    mkH3("3. We Get to Work"),
    mkText(
      `${p.businessName || "Our team"} handles everything professionally and on schedule.`,
    ),
    mkSpacer("sm"),
  ];
}

function sectionBooking(
  p: OnboardingPrefill,
  sectionContent: Record<string, unknown> | undefined,
): Block[] {
  const eyebrow = getStringField(sectionContent, "eyebrow") ?? "Ready to get started?";
  const headline =
    getStringField(sectionContent, "headline") ?? "Book Your Free Consultation";
  const subheadline =
    getStringField(sectionContent, "subheadline") ??
    `Contact ${p.businessName || "us"} today — fast response, no obligation.`;
  const cta =
    p.primaryCta ||
    getStringField(sectionContent, "primaryCtaLabel") ||
    "Book a Free Consultation";

  return [
    mkHero({
      eyebrow,
      title: headline,
      subtitle: subheadline,
      buttonLabel: cta,
      align: "center",
    }),
  ];
}

function sectionFinancing(p: OnboardingPrefill): Block[] {
  return [
    mkH2("Flexible Financing Available"),
    mkText(
      `${p.businessName || "We"} offer 0% interest financing options to make quality ${p.primaryTrade ? p.primaryTrade.toLowerCase() : "service"} accessible for every budget.`,
    ),
    mkSpacer("sm"),
  ];
}

function sectionGallery(): Block[] {
  return [
    mkH2("Our Work"),
    mkText(
      "Browse recent projects — photos will be added by your design team during the build.",
    ),
    mkSpacer("sm"),
  ];
}

function sectionAnswerFirstAeo(
  p: OnboardingPrefill,
  sectionContent: Record<string, unknown> | undefined,
): Block[] {
  const headline =
    typeof sectionContent?.headline === "string"
      ? sectionContent.headline
      : `Answer-First ${p.primaryTrade || "Service"} Questions`;
  const intro =
    typeof sectionContent?.intro === "string"
      ? sectionContent.intro
      : `Quick, factual answers your customers ask before booking ${p.businessName || "your team"}.`;

  const blocks: Block[] = [mkH2(headline), mkText(intro)];

  const items = Array.isArray(sectionContent?.items)
    ? sectionContent.items.slice(0, 3)
    : [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const itemRecord = item as Record<string, unknown>;
    const questionValue = itemRecord.question;
    const answerValue = itemRecord.answer;
    const question = typeof questionValue === "string" ? questionValue : null;
    const answer = typeof answerValue === "string" ? answerValue : null;
    if (question) blocks.push(mkH3(question));
    if (answer) blocks.push(mkText(answer));
  }

  blocks.push(mkSpacer("sm"));
  return blocks;
}

function sectionBentoEmergency(
  p: OnboardingPrefill,
  sectionContent: Record<string, unknown> | undefined,
): Block[] {
  const headline =
    typeof sectionContent?.headline === "string"
      ? sectionContent.headline
      : `Emergency ${p.primaryTrade || "Service"} Dispatch`;
  const subheadline =
    typeof sectionContent?.subheadline === "string"
      ? sectionContent.subheadline
      : `Fast triage, clear response windows, and practical next steps for urgent requests.`;

  const blocks: Block[] = [mkH2(headline), mkText(subheadline)];

  const items = Array.isArray(sectionContent?.items)
    ? sectionContent.items.slice(0, 4)
    : [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const itemRecord = item as Record<string, unknown>;
    const titleValue = itemRecord.title;
    const descriptionValue = itemRecord.description;
    const title = typeof titleValue === "string" ? titleValue : null;
    const description =
      typeof descriptionValue === "string" ? descriptionValue : null;
    if (title) blocks.push(mkH3(title));
    if (description) blocks.push(mkText(description));
  }

  blocks.push(mkSpacer("sm"));
  return blocks;
}

// ---------------------------------------------------------------------------
// Main builder — respects the chosen template's section order
// ---------------------------------------------------------------------------

function buildInitialBlocks(p: OnboardingPrefill): Block[] {
  const location = [p.city, p.state].filter(Boolean).join(", ");
  const tradeLabel = p.primaryTrade
    ? `${p.primaryTrade} Services`
    : "Professional Services";

  // Resolve section order from template registry (fall back to 'modern' default)
  const slug = p.selectedTemplateSlug ?? "modern";
  const template = TEMPLATE_REGISTRY[slug] ?? TEMPLATE_REGISTRY["modern"];
  const layout = template?.default_layout_json ?? [];

  const blocks: Block[] = [];

  // Map each enabled WaaS section to builder blocks, in template order
  for (const section of layout) {
    if (!section.enabled) continue;

    let sectionBlocks: Block[] = [];
    const sectionContent =
      section.content && typeof section.content === "object"
        ? (section.content as Record<string, unknown>)
        : undefined;

    switch (section.section) {
      case "hero":
        sectionBlocks = sectionHero(
          p,
          location,
          tradeLabel,
          sectionContent,
          section.config,
        );
        break;
      case "answer-first-aeo":
        sectionBlocks = sectionAnswerFirstAeo(p, sectionContent);
        break;
      case "bento-emergency":
        sectionBlocks = sectionBentoEmergency(p, sectionContent);
        break;
      case "services":
        sectionBlocks = sectionServices(p, tradeLabel, sectionContent);
        break;
      case "about":
        sectionBlocks = sectionAbout(p, sectionContent);
        break;
      case "trust":
        sectionBlocks = sectionTrust(p);
        break;
      case "reviews":
        sectionBlocks = sectionReviews(sectionContent);
        break;
      case "faq":
        sectionBlocks = sectionFaq(p, location);
        break;
      case "how-it-works":
        sectionBlocks = sectionHowItWorks(p);
        break;
      case "booking":
        sectionBlocks = sectionBooking(p, sectionContent);
        break;
      case "financing":
        sectionBlocks = sectionFinancing(p);
        break;
      case "gallery":
        sectionBlocks = sectionGallery();
        break;
    }

    if (sectionBlocks.length === 0) continue;

    // Separator before every rendered section except the first
    if (blocks.length > 0) blocks.push(createBlock("divider"));
    blocks.push(...sectionBlocks);
  }

  // Safety net: if template had no enabled sections, fall back to basics
  if (blocks.length === 0) {
    blocks.push(
      ...sectionHero(p, location, tradeLabel, undefined, undefined),
    );
    blocks.push(createBlock("divider"));
    blocks.push(...sectionServices(p, tradeLabel, undefined));
    blocks.push(createBlock("divider"));
    blocks.push(...sectionBooking(p, undefined));
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Canvas drop zone
// ---------------------------------------------------------------------------

function CanvasDropZone({
  children,
  isEmpty,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-dropzone" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-auto min-h-full w-full max-w-3xl border p-6 transition-all",
        isEmpty && "flex items-center justify-center",
      )}
      style={{
        background: "var(--brand-canvas-bg)",
        borderColor: isOver ? "var(--accent)" : "var(--brand-canvas-border)",
        boxShadow: "var(--brand-canvas-shadow)",
        borderRadius: "var(--brand-canvas-radius)",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BuilderProps {
  prefill: OnboardingPrefill;
  onSubmit: (blocks: Block[]) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Builder({
  prefill,
  onSubmit,
  onBack,
  isLoading,
}: BuilderProps) {
  const [mounted, setMounted] = useState(false);
  const initialDraftRef = useRef<Block[]>([]);
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const initial = buildInitialBlocks(prefill);
    initialDraftRef.current = initial;
    return initial;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    type: "palette" | "canvas";
    blockType?: BlockType;
  } | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );

  const visualPreset = useMemo(
    () => getTemplateVisualPreset(prefill.selectedTemplateSlug),
    [prefill.selectedTemplateSlug],
  );

  const brandThemeStyle = useMemo<CSSProperties>(() => {
    const primary = isHexColor(prefill.primaryColor)
      ? prefill.primaryColor
      : "#2563EB";
    const templatePalette = prefill.selectedTemplateSlug
      ? TEMPLATE_REGISTRY[prefill.selectedTemplateSlug]?.preview_palette
      : undefined;
    const secondary = isHexColor(prefill.secondaryColor)
      ? prefill.secondaryColor
      : templatePalette?.secondary ?? "#1E40AF";
    const text = isHexColor(prefill.textColor)
      ? prefill.textColor
      : "#111827";
    const accent = withAlpha(primary, "33");
    const background = templatePalette?.background ?? "#FFFFFF";

    return {
      "--primary": primary,
      "--ring": secondary,
      "--accent": accent,
      "--secondary": withAlpha(secondary, "1A"),
      "--sidebar-primary": primary,
      "--sidebar-accent": withAlpha(secondary, "14"),
      "--background": background,
      "--card": visualPreset.blockBackground,
      "--foreground": text,
      "--muted-foreground": visualPreset.copyColor,
      "--brand-app-bg": visualPreset.appBackground,
      "--brand-canvas-bg": visualPreset.canvasBackground,
      "--brand-canvas-border": visualPreset.canvasBorder,
      "--brand-canvas-shadow": visualPreset.canvasShadow,
      "--brand-block-bg": visualPreset.blockBackground,
      "--brand-block-border": visualPreset.blockBorder,
      "--brand-block-shadow": visualPreset.blockShadow,
      "--brand-hero-gradient": visualPreset.heroGradient,
      "--brand-divider": visualPreset.dividerColor,
      "--brand-display-font": visualPreset.displayFont,
      "--brand-body-font": visualPreset.bodyFont,
      "--brand-copy-color": visualPreset.copyColor,
      "--brand-canvas-radius": visualPreset.canvasRadius,
      "--brand-block-radius": visualPreset.blockRadius,
      fontFamily: visualPreset.bodyFont,
      background: visualPreset.appBackground,
    } as CSSProperties;
  }, [
    prefill.primaryColor,
    prefill.secondaryColor,
    prefill.textColor,
    prefill.selectedTemplateSlug,
    visualPreset,
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current;
    if (data?.source === "palette") {
      setActiveDrag({ type: "palette", blockType: data.blockType });
    } else {
      setActiveDrag({ type: "canvas" });
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveDrag(null);
    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.source === "palette") {
      const newBlock = createBlock(activeData.blockType as BlockType);
      setBlocks((prev) => {
        const overIndex = prev.findIndex((b) => b.id === over.id);
        if (overIndex === -1) return [...prev, newBlock];
        const next = [...prev];
        next.splice(overIndex, 0, newBlock);
        return next;
      });
      setSelectedId(newBlock.id);
      return;
    }

    if (active.id !== over.id) {
      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function updateBlock(patch: Partial<Block>) {
    if (!selectedId) return;
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === selectedId ? ({ ...b, ...patch } as Block) : b,
      ),
    );
  }

  function deleteBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={brandThemeStyle}
      >
        {/* ------------------------------------------------------------------ */}
        {/* Top bar                                                             */}
        {/* ------------------------------------------------------------------ */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              ← Back
            </button>
            <span className="text-border">|</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers className="size-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">
              Website Builder
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <MousePointer2 className="size-3.5" />
              {blocks.length} block{blocks.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => {
                const restored = initialDraftRef.current.map((block) => ({
                  ...block,
                }));
                setBlocks(restored);
                setSelectedId(null);
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 transition disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => onSubmit(blocks)}
              disabled={isLoading || blocks.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  Submit for Admin Review <ChevronRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* Workspace                                                            */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex min-h-0 flex-1">
          <BlockPalette />

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground shrink-0">
              <Eye className="size-3.5" />
              Canvas preview — drag blocks from the left panel
            </div>
            <div
              className="flex-1 overflow-y-auto p-6"
              onClick={() => setSelectedId(null)}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <CanvasDropZone isEmpty={blocks.length === 0}>
                  {blocks.length === 0 ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        Your canvas is empty
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Drag a block from the left panel to get started.
                      </p>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {blocks.map((block) => (
                        <CanvasBlock
                          key={block.id}
                          block={block}
                          selected={block.id === selectedId}
                          onSelect={() => setSelectedId(block.id)}
                          onDelete={() => deleteBlock(block.id)}
                        />
                      ))}
                    </div>
                  )}
                </CanvasDropZone>
              </SortableContext>
            </div>
          </main>

          <Inspector block={selectedBlock} onChange={updateBlock} />
        </div>
      </div>

      <DragOverlay>
        {activeDrag?.type === "palette" && activeDrag.blockType ? (
          <div className="rounded-lg border border-accent bg-card px-4 py-3 text-sm font-medium text-foreground shadow-xl">
            {activeDrag.blockType} block
          </div>
        ) : null}
      </DragOverlay>

      {!welcomeDismissed && (
        <BuilderWelcomeModal onDismiss={() => setWelcomeDismissed(true)} />
      )}
    </DndContext>,
    document.body,
  );
}
