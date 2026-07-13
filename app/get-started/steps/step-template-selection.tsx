"use client";

// =============================================================================
// Step 4: Template Selection  —  PR #94
//
// Sits between Step 3 (Brand Identity) and Step 5 (Integrations).
//
// Layout:
//   • Eyebrow badge + headline
//   • 3-card "Recommended for {trade}" inline row
//     – Powered by getRecommendedTemplates(primaryTrade) from registry
//   • "Browse all 10 templates →" ghost link → opens TemplateLibraryModal
//   • Selection confirmed pill (updates live as user picks)
//   • SEO rationale block — why this template ranks well for their trade
//   • Back / Continue button row
//
// The step is skippable: if user clicks "Continue" without picking,
// the default template for their trade (rank 1) is auto-selected.
//
// Theming:
//   Follows the exact same glassmorphism dark/light dual-class pattern
//   used by step-brand-identity.tsx — no `dark:` variants.
//   .ap-onboarding.ap-theme-light CSS overrides handle light mode.
// =============================================================================

import React, { useState, useCallback, useMemo } from "react";
import {
  TemplatePreviewCard,
  TemplateLibraryModal,
} from "@/components/waas/template-picker";
import {
  getRecommendedTemplates,
  getRecommendedTemplateSlugs,
  ACTIVE_TEMPLATES,
} from "@/lib/waas/templates/registry";

// ---------------------------------------------------------------------------
// SEO strategy → one-sentence rationale shown below the selection
// ---------------------------------------------------------------------------

const SEO_RATIONALE: Record<string, string> = {
  "local-service":
    'This template front-loads your location + trade keywords in the H1 and NAP block, helping you rank in the local map pack for "[City] + [Trade]" searches.',
  "trust-authority":
    "Built around E-E-A-T signals — licences, certifications, and review schema — this layout tells Google your business is the authoritative choice in your area.",
  "visual-portfolio":
    'Gallery-first design lets you load up keyword-rich alt-text and project schema markup, driving traffic from portfolio and "before/after" searches.',
  emergency:
    'Urgency signals ("24/7", "Same-Day", "Fast Response") are baked into the hero and schema, targeting high-intent emergency service queries.',
  consultative:
    "Deep FAQ and How-It-Works sections earn featured snippets and long-tail traffic — ideal for trades where customers research before calling.",
  conversion:
    "High CTA density with booking schema and offer keywords converts searchers directly into phone calls and booked appointments.",
};

const TEMPLATE_COLOR_DISCLAIMER =
  "Preview colors are illustrative only. Your final site colors come from your logo and brand settings in the previous step, not from the template swatch you select here.";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  primaryTrade: string | null;
  selectedSlug: string | null;
  setSelectedSlug: (slug: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepTemplateSelection({
  primaryTrade,
  selectedSlug,
  setSelectedSlug,
  onNext,
  onBack,
  isLoading,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  // Top-3 recommended templates for this trade
  const recommended = useMemo(
    () => getRecommendedTemplates(primaryTrade),
    [primaryTrade],
  );

  // Fallback: if nothing selected yet, highlight the rank-1 template
  const defaultSlug = useMemo(
    () => getRecommendedTemplateSlugs(primaryTrade)[0],
    [primaryTrade],
  );

  const effectiveSlug = selectedSlug ?? null;

  // The fully resolved selected template object
  const selectedTemplate = useMemo(
    () => ACTIVE_TEMPLATES.find((t) => t.slug === effectiveSlug) ?? null,
    [effectiveSlug],
  );

  // Handle "Continue" — auto-select rank-1 if user never picked
  const handleContinue = useCallback(() => {
    if (!selectedSlug) {
      setSelectedSlug(defaultSlug);
    }
    onNext();
  }, [selectedSlug, defaultSlug, setSelectedSlug, onNext]);

  const handleModalConfirm = useCallback(() => {
    setModalOpen(false);
    onNext();
  }, [onNext]);

  const stepNumber = 4; // this step's display number (out of 5)

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
          <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">
            Step {stepNumber} of 5 · Website Template
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
          Choose your website look
        </h1>
        <p className="text-slate-600 dark:text-white/50 mt-2 text-sm sm:text-base">
          {primaryTrade
            ? `We've picked the top 3 designs for ${primaryTrade} businesses. Each is pre-wired for local SEO.`
            : "We've pre-selected the best designs for local service businesses. Each is optimised for local SEO."}
        </p>
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Template colors are previews only
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-white/50">
            {TEMPLATE_COLOR_DISCLAIMER}
          </p>
        </div>
      </div>

      {/* ── Recommended cards ── */}
      <div className="space-y-5">
        {/* Section label */}
        {primaryTrade && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">
              Recommended for {primaryTrade}
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
          </div>
        )}

        {/* 3-up card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recommended.map(({ template, recommendRank }) => (
            <TemplatePreviewCard
              key={template.slug}
              template={template}
              isSelected={effectiveSlug === template.slug}
              onSelect={setSelectedSlug}
              recommendRank={recommendRank}
            />
          ))}
        </div>

        {/* Browse all link */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/40 hover:text-violet-600 dark:hover:text-violet-400 transition-colors font-medium group"
          >
            <svg
              className="w-4 h-4 transition-transform group-hover:scale-110"
              fill="none"
              viewBox="0 0 16 16"
              strokeWidth={1.75}
              stroke="currentColor"
            >
              <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" />
              <rect x="9.5" y="1" width="5.5" height="5.5" rx="1.5" />
              <rect x="1" y="9.5" width="5.5" height="5.5" rx="1.5" />
              <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1.5" />
            </svg>
            Browse all 10 templates
          </button>

          {!selectedSlug && (
            <span className="text-[11px] text-slate-400 dark:text-white/25 italic">
              We&apos;ll use the top pick if you skip
            </span>
          )}
        </div>

        {/* ── Selection confirmed block ── */}
        {selectedTemplate && (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-4 space-y-3">
            {/* Template name + swap */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Palette mini-swatch */}
                <div className="flex shrink-0 h-4 w-12 rounded-full overflow-hidden gap-px">
                  <div
                    className="flex-1"
                    style={{
                      backgroundColor: selectedTemplate.preview_palette.primary,
                    }}
                  />
                  <div
                    className="flex-1"
                    style={{
                      backgroundColor:
                        selectedTemplate.preview_palette.secondary,
                    }}
                  />
                  <div
                    className="flex-1"
                    style={{
                      backgroundColor: selectedTemplate.preview_palette.accent,
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {selectedTemplate.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-white/40 truncate">
                    {selectedTemplate.mood} · {selectedTemplate.tagline}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="shrink-0 text-[11px] font-medium text-violet-500 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                Change →
              </button>
            </div>

            {/* SEO rationale */}
            <div className="flex gap-2.5">
              <div className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-violet-500/15 flex items-center justify-center">
                <svg
                  className="w-2.5 h-2.5 text-violet-400"
                  fill="none"
                  viewBox="0 0 10 10"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <circle cx="5" cy="5" r="4" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 3.5v2L6.5 7"
                  />
                </svg>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-white/40 leading-relaxed">
                <span className="font-semibold text-slate-700 dark:text-white/60">
                  SEO advantage:{" "}
                </span>
                {SEO_RATIONALE[selectedTemplate.seo_strategy] ??
                  selectedTemplate.description}
              </p>
            </div>

            {/* Feature highlights */}
            {selectedTemplate.feature_highlights.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {selectedTemplate.feature_highlights.map((feat, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20"
                  >
                    <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                    {feat}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── No selection yet — ghost placeholder ── */}
        {!selectedTemplate && (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-center">
            <p className="text-xs text-slate-400 dark:text-white/25">
              Select a template above to see its SEO advantages
            </p>
          </div>
        )}
      </div>

      {/* ── Footer buttons ── */}
      <div className="flex gap-3 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="h-14 px-6 rounded-xl border border-slate-300 dark:border-white/15 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/30 font-medium text-sm transition-all"
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleContinue}
          disabled={isLoading}
          className="flex-1 h-14 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-base hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving…
            </>
          ) : (
            <>
              {selectedSlug
                ? "Continue with this template"
                : "Use top recommendation & continue"}
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 20 20"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 10h12M10 4l6 6-6 6"
                />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* ── Template Library Modal ── */}
      <TemplateLibraryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        primaryTrade={primaryTrade}
        selectedSlug={effectiveSlug}
        onSelect={setSelectedSlug}
        onConfirm={handleModalConfirm}
      />
    </div>
  );
}

export default StepTemplateSelection;
