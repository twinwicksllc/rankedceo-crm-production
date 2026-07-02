"use client";

// =============================================================================
// TemplatePreviewCard  —  PR #93
// Displays a single SiteTemplate in the template picker UI.
//
// Visual anatomy (top → bottom):
//   ① Palette swatch bar  — 4 preview_palette colours as thin stripes
//   ② Browser chrome mock — tiny fake browser bar to give context
//   ③ Mini-layout preview  — simplified section blocks matching template layout
//   ④ Name + tagline       — template name (bold) + short tagline
//   ⑤ Mood pill            — e.g. "Professional · Trustworthy"
//   ⑥ Feature highlights  — up to 4 short bullet chips
//   ⑦ SEO strategy badge  — shown in selected-state footer
//
// Badges:
//   • "⭐ Best Match"       — rank 1 recommended
//   • "✓ Recommended"      — rank 2–3 recommended
//   • "Selected" ring      — when isSelected === true
//
// Theme compatibility:
//   Uses the standard onboarding glassmorphism pattern:
//     bg-white/5  border-white/10  text-white
//   These are overridden to light-mode equivalents by
//     .ap-onboarding.ap-theme-light  CSS rules in globals.css
//   DO NOT use Tailwind dark: variants — use the dual bg-*/dark:bg-* pattern
//   that mirrors step-brand-identity.tsx.
// =============================================================================

import React from "react";
import type { SiteTemplate } from "@/lib/waas/templates/types";

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

export interface TemplatePreviewCardProps {
  template: SiteTemplate;
  isSelected: boolean;
  onSelect: (slug: string) => void;
  /** 1 = Best Match, 2–3 = Recommended, undefined = no badge */
  recommendRank?: 1 | 2 | 3;
  /** Shows a compact variant with less padding (used inside the modal grid) */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Mini section-layout preview  — maps template section list → tiny blocks
// ---------------------------------------------------------------------------

const SECTION_COLORS: Record<string, string> = {
  hero: "bg-slate-700/60 dark:bg-white/10",
  trust: "bg-emerald-700/30 dark:bg-emerald-400/10",
  services: "bg-blue-700/30   dark:bg-blue-400/10",
  about: "bg-purple-700/20 dark:bg-purple-400/10",
  booking: "bg-orange-600/30 dark:bg-orange-400/10",
  reviews: "bg-yellow-600/20 dark:bg-yellow-400/10",
  faq: "bg-slate-600/20  dark:bg-white/5",
  "how-it-works": "bg-teal-600/20   dark:bg-teal-400/10",
  financing: "bg-green-600/20  dark:bg-green-400/10",
  gallery: "bg-pink-600/20   dark:bg-pink-400/10",
};

const SECTION_HEIGHTS: Record<string, string> = {
  hero: "h-7",
  trust: "h-3",
  services: "h-5",
  about: "h-4",
  booking: "h-4",
  reviews: "h-3",
  faq: "h-3",
  "how-it-works": "h-4",
  financing: "h-3",
  gallery: "h-4",
};

interface MiniPreviewProps {
  template: SiteTemplate;
}

function MiniLayoutPreview({ template }: MiniPreviewProps) {
  const enabledSections = template.default_layout_json
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .slice(0, 6); // show max 6 rows so the card doesn't overflow

  const { primary, secondary, accent } = template.preview_palette;

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-white/10"
      style={{ backgroundColor: template.preview_palette.background + "dd" }}
    >
      {/* Fake browser top bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-black/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400/70" />
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70" />
        <span className="w-1.5 h-1.5 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-2 h-1.5 rounded-full bg-white/10" />
      </div>

      {/* Mini section rows */}
      <div className="flex flex-col gap-1 p-1.5">
        {enabledSections.map((s, idx) => {
          const baseColor = SECTION_COLORS[s.section] ?? "bg-white/5";
          const height = SECTION_HEIGHTS[s.section] ?? "h-3";
          // Apply brand primary tint to hero & booking rows
          const heroStyle =
            s.section === "hero" ? { backgroundColor: primary + "44" } : {};
          const ctaStyle =
            s.section === "booking" ? { backgroundColor: accent + "55" } : {};
          const svcStyle =
            s.section === "services"
              ? { backgroundColor: secondary + "33" }
              : {};
          const inlineStyle = { ...heroStyle, ...ctaStyle, ...svcStyle };

          return (
            <div
              key={`${s.section}-${idx}`}
              className={`w-full rounded ${height} ${baseColor} transition-all`}
              style={inlineStyle}
            />
          );
        })}
      </div>

      {/* Brand-colour accent strip at bottom */}
      <div className="flex h-1">
        <div className="flex-1" style={{ backgroundColor: primary }} />
        <div className="flex-1" style={{ backgroundColor: secondary }} />
        <div className="flex-1" style={{ backgroundColor: accent }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Palette swatch strip
// ---------------------------------------------------------------------------

function PaletteSwatch({
  palette,
}: {
  palette: SiteTemplate["preview_palette"];
}) {
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
      <div className="flex-[2]" style={{ backgroundColor: palette.primary }} />
      <div
        className="flex-[2]"
        style={{ backgroundColor: palette.secondary }}
      />
      <div className="flex-[1]" style={{ backgroundColor: palette.accent }} />
      <div
        className="flex-[1]"
        style={{ backgroundColor: palette.background }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aesthetic → human label map
// ---------------------------------------------------------------------------

const AESTHETIC_LABELS: Record<string, string> = {
  clean: "Clean & Minimal",
  bold: "Bold Impact",
  trust: "Trust First",
  local: "Local & Friendly",
  premium: "Premium",
  urgent: "Emergency Ready",
  visual: "Visual Showcase",
  process: "Process Driven",
  community: "Community",
  conversion: "Conversion Focused",
};

// SEO strategy → short label
const SEO_LABELS: Record<string, string> = {
  "local-service": "📍 Local SEO",
  "trust-authority": "🏅 Trust & Authority",
  "visual-portfolio": "🖼 Portfolio SEO",
  emergency: "⚡ Emergency SEO",
  consultative: "📚 FAQ & How-To SEO",
  conversion: "🎯 Conversion SEO",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TemplatePreviewCard({
  template,
  isSelected,
  onSelect,
  recommendRank,
  compact = false,
}: TemplatePreviewCardProps) {
  const isBestMatch = recommendRank === 1;
  const isRecommended = recommendRank === 2 || recommendRank === 3;

  const paddingClass = compact ? "p-3" : "p-4";

  return (
    <button
      type="button"
      onClick={() => onSelect(template.slug)}
      aria-pressed={isSelected}
      aria-label={`Select ${template.name} template`}
      className={[
        "group relative w-full text-left rounded-xl border-2 transition-all duration-200",
        "flex flex-col gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
        paddingClass,
        isSelected
          ? "border-violet-500/70 bg-violet-500/[0.06] shadow-lg shadow-violet-500/20 scale-[1.01]"
          : "border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/[0.05] hover:scale-[1.005]",
      ].join(" ")}
    >
      {/* ── ① Best-match / recommended badge ── */}
      {(isBestMatch || isRecommended) && (
        <div
          className={[
            "absolute -top-2.5 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide",
            isBestMatch
              ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 border border-slate-200 dark:border-white/10",
          ].join(" ")}
        >
          {isBestMatch ? "⭐ Best Match" : "✓ Recommended"}
        </div>
      )}

      {/* ── ② Selected check icon ── */}
      {isSelected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow-sm z-10">
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            viewBox="0 0 12 12"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2 6l3 3 5-5"
            />
          </svg>
        </div>
      )}

      {/* ── ③ Palette swatch ── */}
      <PaletteSwatch palette={template.preview_palette} />

      {/* ── ④ Mini layout preview ── */}
      <MiniLayoutPreview template={template} />

      {/* ── ⑤ Name + tagline ── */}
      <div className="space-y-0.5">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">
          {template.name}
        </h3>
        <p className="text-xs text-slate-500 dark:text-white/50 leading-snug line-clamp-2">
          {template.tagline}
        </p>
      </div>

      {/* ── ⑥ Aesthetic + mood pills ── */}
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-white/60 border border-slate-200 dark:border-white/10">
          {AESTHETIC_LABELS[template.aesthetic] ?? template.aesthetic}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-white/60 border border-slate-200 dark:border-white/10">
          {template.mood}
        </span>
      </div>

      {/* ── ⑦ Feature highlight chips (max 3 shown, +N overflow) ── */}
      {template.feature_highlights.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.feature_highlights.slice(0, 3).map((feat, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20"
            >
              <span className="w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-400 shrink-0" />
              {feat}
            </span>
          ))}
          {template.feature_highlights.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 dark:text-white/40">
              +{template.feature_highlights.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* ── ⑧ SEO strategy badge — visible when selected ── */}
      <div
        className={[
          "flex items-center gap-1.5 transition-all duration-200",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        ].join(" ")}
      >
        <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">
          {SEO_LABELS[template.seo_strategy] ?? template.seo_strategy}
        </span>
      </div>
    </button>
  );
}

export default TemplatePreviewCard;
