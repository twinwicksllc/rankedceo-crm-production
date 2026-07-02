"use client";

// =============================================================================
// TemplateLibraryModal  —  PR #93
// Full-screen (mobile) / centred large modal (desktop) for browsing all 10
// templates with aesthetic filter tabs and industry-aware "Recommended" section.
//
// Layout:
//   • Sticky header:  title + X close button
//   • Recommended strip (3 cards, only shown if primaryTrade is known)
//   • Filter tab bar  (All + 10 aesthetic categories)
//   • Scrollable grid (10 → filtered templates)
//   • Sticky footer:  "Use this template →" confirm CTA
//
// Props:
//   isOpen        — controls visibility
//   onClose       — called when backdrop or X is clicked
//   primaryTrade  — user's selected trade (drives the "Recommended" section)
//   selectedSlug  — currently selected template slug (or null)
//   onSelect      — (slug) => void — called when user picks a template
//   onConfirm     — () => void — called when "Use this template" is clicked
//
// Theme:
//   Glassmorphism dark:  bg-[#0f172a]/95 backdrop-blur, border-white/10
//   Light-mode override: .ap-onboarding.ap-theme-light rules in globals.css
//   Pattern mirrors step-brand-identity.tsx — uses dark:bg-* dual classes.
// =============================================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { TemplatePreviewCard } from "./TemplatePreviewCard";
import {
  ACTIVE_TEMPLATES,
  getRecommendedTemplates,
} from "@/lib/waas/templates/registry";
import type {
  SiteTemplate,
  TemplateAesthetic,
} from "@/lib/waas/templates/types";

// ---------------------------------------------------------------------------
// Filter tab definitions
// ---------------------------------------------------------------------------

const AESTHETIC_FILTER_LABELS: {
  value: TemplateAesthetic | "all";
  label: string;
  icon: string;
}[] = [
  { value: "all", label: "All", icon: "🔲" },
  { value: "clean", label: "Clean", icon: "✦" },
  { value: "bold", label: "Bold", icon: "⚡" },
  { value: "trust", label: "Trust", icon: "🏅" },
  { value: "local", label: "Local", icon: "📍" },
  { value: "premium", label: "Premium", icon: "💎" },
  { value: "urgent", label: "Emergency", icon: "🚨" },
  { value: "visual", label: "Showcase", icon: "🖼" },
  { value: "process", label: "Process", icon: "📋" },
  { value: "community", label: "Community", icon: "🤝" },
  { value: "conversion", label: "Conversion", icon: "🎯" },
];

// ---------------------------------------------------------------------------
// SEO strategy → summary sentence shown in the footer on selection
// ---------------------------------------------------------------------------

const SEO_SUMMARIES: Record<string, string> = {
  "local-service":
    'Targets "[City] + [Trade]" keyword clusters and prominent NAP signals for local map pack ranking.',
  "trust-authority":
    "Emphasises E-E-A-T signals: credentials, licences, and review schema to build search authority.",
  "visual-portfolio":
    "Gallery-focused alt-text strategy + project schema drives rankings for portfolio keywords.",
  emergency:
    "Urgency keywords, 24/7 phrases, and fast-response schema — dominates emergency service searches.",
  consultative:
    "Deep FAQ schema + how-to content drives featured snippets and long-tail keyword traffic.",
  conversion:
    "High CTA density, booking schema, and offer keywords — converts searchers directly to calls/bookings.",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryTrade?: string | null;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onConfirm: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateLibraryModal({
  isOpen,
  onClose,
  primaryTrade,
  selectedSlug,
  onSelect,
  onConfirm,
}: TemplateLibraryModalProps) {
  const [activeFilter, setActiveFilter] = useState<TemplateAesthetic | "all">(
    "all",
  );
  const [mounted, setMounted] = useState(false);
  const filterScrollRef = useRef<HTMLDivElement>(null);

  // Avoid SSR portal issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!mounted) return;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, mounted]);

  // Reset filter when modal opens
  useEffect(() => {
    if (isOpen) setActiveFilter("all");
  }, [isOpen]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const recommended = useMemo(
    () => (primaryTrade ? getRecommendedTemplates(primaryTrade) : []),
    [primaryTrade],
  );

  const recommendedSlugs = useMemo(
    () => new Set(recommended.map((r) => r.template.slug)),
    [recommended],
  );

  const filteredTemplates = useMemo<SiteTemplate[]>(() => {
    if (activeFilter === "all") return ACTIVE_TEMPLATES;
    return ACTIVE_TEMPLATES.filter((t) => t.aesthetic === activeFilter);
  }, [activeFilter]);

  // Separate filtered list into recommended + rest (when filter === 'all')
  const { recoGroup, restGroup } = useMemo(() => {
    if (activeFilter !== "all" || !primaryTrade) {
      return {
        recoGroup: [] as typeof recommended,
        restGroup: filteredTemplates,
      };
    }
    const recoGroup = recommended;
    const recoSlugSet = new Set(recoGroup.map((r) => r.template.slug));
    const restGroup = filteredTemplates.filter((t) => !recoSlugSet.has(t.slug));
    return { recoGroup, restGroup };
  }, [activeFilter, primaryTrade, recommended, filteredTemplates]);

  // Selected template object
  const selectedTemplate = useMemo(
    () => ACTIVE_TEMPLATES.find((t) => t.slug === selectedSlug) ?? null,
    [selectedSlug],
  );

  // ---------------------------------------------------------------------------
  // Backdrop click handler
  // ---------------------------------------------------------------------------

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!mounted) return null;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Template library"
      className={[
        "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4",
        "transition-opacity duration-300",
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      {/* ── Backdrop ── */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* ── Modal panel ── */}
      <div
        className={[
          "relative z-10 w-full sm:max-w-5xl sm:max-h-[90vh]",
          "max-h-[95dvh] flex flex-col",
          "rounded-t-2xl sm:rounded-2xl overflow-hidden",
          // Dark glassmorphism base
          "bg-[#0f172a]/95 border border-white/10",
          // Light-mode override via .ap-onboarding.ap-theme-light
          "backdrop-blur-xl shadow-2xl shadow-black/50",
          "transition-transform duration-300",
          isOpen ? "translate-y-0" : "translate-y-8",
        ].join(" ")}
      >
        {/* ── Header ── */}
        <div className="shrink-0 flex items-start justify-between px-5 pt-5 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white leading-tight">
              Choose Your Website Template
            </h2>
            <p className="mt-0.5 text-xs text-white/50">
              {primaryTrade
                ? `Showing recommendations for ${primaryTrade} · All 10 templates available`
                : "All 10 templates · Pick the feel that matches your brand"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template library"
            className="ml-4 shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 16 16"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4l8 8M12 4l-8 8"
              />
            </svg>
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div
          ref={filterScrollRef}
          className="shrink-0 flex gap-1 px-4 py-2.5 overflow-x-auto scrollbar-none border-b border-white/10"
        >
          {AESTHETIC_FILTER_LABELS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() =>
                setActiveFilter(tab.value as TemplateAesthetic | "all")
              }
              className={[
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                activeFilter === tab.value
                  ? "bg-white/15 text-white border border-white/20 shadow-sm"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              <span className="text-sm leading-none">{tab.icon}</span>
              {tab.label}
              {tab.value !== "all" && (
                <span className="ml-0.5 text-[9px] text-white/30 font-normal">
                  {
                    ACTIVE_TEMPLATES.filter((t) => t.aesthetic === tab.value)
                      .length
                  }
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Recommended section (only when filter = 'all' and trade is known) */}
          {recoGroup.length > 0 && (
            <section aria-labelledby="reco-heading">
              <div className="flex items-center gap-2 mb-3">
                <h3
                  id="reco-heading"
                  className="text-[11px] font-bold uppercase tracking-widest text-white/40"
                >
                  Recommended for {primaryTrade}
                </h3>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recoGroup.map(({ template, recommendRank }) => (
                  <TemplatePreviewCard
                    key={template.slug}
                    template={template}
                    isSelected={selectedSlug === template.slug}
                    onSelect={onSelect}
                    recommendRank={recommendRank}
                    compact
                  />
                ))}
              </div>
            </section>
          )}

          {/* All / filtered templates */}
          <section aria-labelledby="all-heading">
            {recoGroup.length > 0 && activeFilter === "all" && (
              <div className="flex items-center gap-2 mb-3">
                <h3
                  id="all-heading"
                  className="text-[11px] font-bold uppercase tracking-widest text-white/40"
                >
                  All Templates
                </h3>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}

            {restGroup.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {restGroup.map((template) => {
                  const recoEntry = recommended.find(
                    (r) => r.template.slug === template.slug,
                  );
                  return (
                    <TemplatePreviewCard
                      key={template.slug}
                      template={template}
                      isSelected={selectedSlug === template.slug}
                      onSelect={onSelect}
                      recommendRank={recoEntry?.recommendRank}
                      compact
                    />
                  );
                })}
              </div>
            ) : (
              // Empty state when a filter has no matches
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-3xl mb-3">🔍</span>
                <p className="text-sm font-medium text-white/60">
                  No templates match this filter
                </p>
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className="mt-3 text-xs text-violet-400 hover:text-violet-300 underline transition-colors"
                >
                  Show all templates
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          {selectedTemplate ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Selected template info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">
                    {selectedTemplate.name}
                  </span>
                  {recommendedSlugs.has(selectedTemplate.slug) && (
                    <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-white/40 leading-snug line-clamp-2">
                  {SEO_SUMMARIES[selectedTemplate.seo_strategy] ??
                    selectedTemplate.description}
                </p>
              </div>

              {/* Confirm CTA */}
              <button
                type="button"
                onClick={onConfirm}
                className="shrink-0 flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98]"
              >
                Use This Template
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 16 16"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8h10M9 4l4 4-4 4"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-white/30 py-1">
              Select a template above to continue →
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default TemplateLibraryModal;
