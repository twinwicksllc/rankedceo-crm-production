"use client";

// =============================================================================
// app/edit/[reviewToken]/font-picker.tsx
//
// Font family picker used inside the inline edit modal when field.kind === 'font'.
//
// - Renders a dropdown of FONT_OPTIONS grouped by category
// - Shows a live preview of each font using a Google Fonts CSS import
//   scoped to the picker itself (no side effects on the rest of the page)
// - Emits the selected slug string via onSelect
//
// Phase 7.1
// =============================================================================

import { useEffect, useState } from "react";
import {
  FONT_OPTIONS,
  buildGoogleFontsUrl,
  DEFAULT_HEADING_FONT,
  type FontOption,
} from "@/lib/waas/client-edit/font-options";

interface FontPickerProps {
  value: string; // current slug, e.g. 'Inter'
  label: string; // 'Heading Font' | 'Body Font'
  onSelect: (slug: string) => void;
  disabled?: boolean;
}

// Group font options by category for the <select> optgroup
const CATEGORY_LABELS: Record<FontOption["category"], string> = {
  "sans-serif": "Sans-Serif",
  serif: "Serif",
  display: "Display",
};

const CATEGORIES: FontOption["category"][] = ["sans-serif", "display", "serif"];

export function FontPicker({
  value,
  label,
  onSelect,
  disabled,
}: FontPickerProps) {
  const currentSlug = value || DEFAULT_HEADING_FONT;
  const [preview, setPreview] = useState(currentSlug);

  // Load Google Fonts for all options at once (for previews in the picker)
  useEffect(() => {
    const url = buildGoogleFontsUrl(FONT_OPTIONS.map((f) => f.slug));
    if (!url) return;

    const existing = document.getElementById("waas-font-picker-gf");
    if (existing) return; // already loaded

    const link = document.createElement("link");
    link.id = "waas-font-picker-gf";
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }, []);

  return (
    <div className="space-y-3">
      {/* Label */}
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </p>

      {/* Dropdown */}
      <select
        value={currentSlug}
        disabled={disabled}
        onChange={(e) => {
          const slug = e.target.value;
          setPreview(slug);
          onSelect(slug);
        }}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
        aria-label={`Select ${label}`}
      >
        {CATEGORIES.map((cat) => {
          const opts = FONT_OPTIONS.filter((f) => f.category === cat);
          if (opts.length === 0) return null;
          return (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {opts.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      {/* Live preview */}
      <div
        className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
        aria-label="Font preview"
      >
        <p
          className="text-2xl font-bold leading-tight text-slate-900 truncate"
          style={{ fontFamily: `'${preview}', sans-serif` }}
        >
          RankedCEO
        </p>
        <p
          className="mt-1 text-sm text-slate-600 leading-relaxed"
          style={{ fontFamily: `'${preview}', sans-serif` }}
        >
          Professional services you can trust — serving your local area.
        </p>
        <p
          className="mt-2 text-[11px] text-slate-400"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {preview}
        </p>
      </div>
    </div>
  );
}
