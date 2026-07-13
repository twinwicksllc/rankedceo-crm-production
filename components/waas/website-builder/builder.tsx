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

import { useEffect, useMemo, useState } from "react";
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
): Block[] {
  return [
    mkHero({
      eyebrow: tradeLabel,
      title:
        p.tagline ||
        `${p.businessName || "Your Business"} — Trusted ${p.primaryTrade || "Professionals"}`,
      subtitle:
        p.usp || `Serving ${location || "your area"} with quality and care.`,
      buttonLabel: p.primaryCta || "Get a Free Quote",
      align: "center",
    }),
  ];
}

function sectionServices(p: OnboardingPrefill, tradeLabel: string): Block[] {
  const services = parseList(p.servicesOffered).slice(0, 6);
  if (services.length === 0) return [];
  const blocks: Block[] = [
    mkH2(`Our ${tradeLabel}`),
    ...services.map((svc) => mkH3(svc)),
    mkSpacer("sm"),
  ];
  return blocks;
}

function sectionAbout(p: OnboardingPrefill): Block[] {
  const body = p.aboutNarrative;
  const blocks: Block[] = [
    mkH2(`About ${p.businessName || "Us"}`),
    ...(body
      ? [mkText(body)]
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
  return [
    mkH2(`Why Choose ${p.businessName || "Us"}`),
    mkText(
      "Licensed & Insured  ·  5-Star Rated  ·  Fast Response  ·  Free Estimates",
    ),
    mkSpacer("sm"),
  ];
}

function sectionReviews(): Block[] {
  return [
    mkH2("What Our Customers Say"),
    mkText(
      '⭐⭐⭐⭐⭐  "Exceptional service — on time, professional, and great value."  — Verified Customer',
    ),
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

function sectionBooking(p: OnboardingPrefill): Block[] {
  return [
    mkHero({
      eyebrow: "Ready to get started?",
      title: "Book Your Free Consultation",
      subtitle: `Contact ${p.businessName || "us"} today — fast response, no obligation.`,
      buttonLabel: p.primaryCta || "Book a Free Consultation",
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

    // Separator before every section except the first
    if (blocks.length > 0) blocks.push(createBlock("divider"));

    switch (section.section) {
      case "hero":
        blocks.push(...sectionHero(p, location, tradeLabel));
        break;
      case "services":
        blocks.push(...sectionServices(p, tradeLabel));
        break;
      case "about":
        blocks.push(...sectionAbout(p));
        break;
      case "trust":
        blocks.push(...sectionTrust(p));
        break;
      case "reviews":
        blocks.push(...sectionReviews());
        break;
      case "faq":
        blocks.push(...sectionFaq(p, location));
        break;
      case "how-it-works":
        blocks.push(...sectionHowItWorks(p));
        break;
      case "booking":
        blocks.push(...sectionBooking(p));
        break;
      case "financing":
        blocks.push(...sectionFinancing(p));
        break;
      case "gallery":
        blocks.push(...sectionGallery());
        break;
    }
  }

  // Safety net: if template had no enabled sections, fall back to basics
  if (blocks.length === 0) {
    blocks.push(...sectionHero(p, location, tradeLabel));
    blocks.push(createBlock("divider"));
    blocks.push(...sectionServices(p, tradeLabel));
    blocks.push(createBlock("divider"));
    blocks.push(...sectionBooking(p));
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
        "mx-auto min-h-full w-full max-w-3xl rounded-xl border bg-card p-6 transition-colors",
        isOver ? "border-accent" : "border-border",
        isEmpty && "flex items-center justify-center",
      )}
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
  const [blocks, setBlocks] = useState<Block[]>(() =>
    buildInitialBlocks(prefill),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    type: "palette" | "canvas";
    blockType?: BlockType;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );

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
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
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
              onClick={() => setBlocks(buildInitialBlocks(prefill))}
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

          <main className="flex min-w-0 flex-1 flex-col bg-background">
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
    </DndContext>,
    document.body,
  );
}
