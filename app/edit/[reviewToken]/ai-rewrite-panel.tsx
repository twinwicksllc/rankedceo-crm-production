"use client";

// =============================================================================
// app/edit/[reviewToken]/ai-rewrite-panel.tsx
// Slide-in side panel offering 3 AI-generated rewrite variants.
//
// Usage flow:
//   1. User clicks "✨ Rewrite with AI" in inline-edit-modal
//   2. Panel slides in from the right over the modal
//   3. User types an intent ("make it punchier") + optional tone preset
//   4. Clicks "Generate 3 options" → server action → 3 variant cards render
//   5. User clicks "Use this" on a card → onPick(text) → panel closes
//      The modal still shows; user can tweak before saving.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { requestAiRewriteVariants } from "@/lib/waas/actions/client-edit";
import type { EditableField } from "@/lib/waas/client-edit/editable-fields";

const RATE_LIMIT_MS = 6000; // 6-second cooldown between Generate calls

interface AiRewritePanelProps {
  field: EditableField;
  reviewToken: string;
  onPick: (text: string) => void;
  onClose: () => void;
}

interface Variant {
  tone: string;
  text: string;
}

const TONE_PRESETS = [
  { label: "Professional", desc: "Polished, business-like" },
  { label: "Friendly", desc: "Warm, approachable" },
  { label: "Bold & concise", desc: "Punchy, short, direct" },
  { label: "Local & trustworthy", desc: "Community-focused, credible" },
];

function buildFieldContext(field: EditableField): string {
  return `${field.label} (group: ${field.group})`;
}

export function AiRewritePanel({
  field,
  reviewToken,
  onPick,
  onClose,
}: AiRewritePanelProps) {
  const [intent, setIntent] = useState("");
  const [tones, setTones] = useState<string[]>([
    "Professional",
    "Friendly",
    "Bold & concise",
  ]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const intentRef = useRef<HTMLTextAreaElement>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus intent textarea
  useEffect(() => {
    const t = setTimeout(() => intentRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // ESC closes panel (not the underlying modal)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  // Toggle a tone preset chip
  const toggleTone = useCallback((label: string) => {
    setTones((prev) => {
      if (prev.includes(label)) {
        return prev.length > 1 ? prev.filter((t) => t !== label) : prev;
      }
      const next = [...prev.filter((t) => t !== label), label];
      return next.slice(-3); // keep max 3 active
    });
  }, []);

  const generate = useCallback(async () => {
    if (!intent.trim() || loading || cooldown) return;
    setError(null);
    setVariants([]);
    setLoading(true);

    try {
      const result = await requestAiRewriteVariants({
        reviewToken,
        currentText: field.value,
        intent: intent.trim(),
        fieldContext: buildFieldContext(field),
        maxLength: field.maxLength ?? 300,
        toneHints: tones,
      });

      if (!result.success || !result.data) {
        setError(result.error ?? "AI returned no results. Please try again.");
        return;
      }
      setVariants(result.data.variants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
      // Start cooldown
      setCooldown(true);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      cooldownTimer.current = setTimeout(
        () => setCooldown(false),
        RATE_LIMIT_MS,
      );
    }
  }, [intent, loading, cooldown, reviewToken, field, tones]);

  // Cmd/Ctrl+Enter to generate
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void generate();
    }
  };

  // -------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[420px] flex-col bg-white shadow-2xl ring-1 ring-slate-200"
      aria-label="AI rewrite suggestions"
      role="complementary"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <span className="text-sm font-semibold text-slate-900">
              Rewrite with AI
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 truncate max-w-[280px]">
            {field.label} · {field.group}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI panel"
          className="rounded p-1.5 text-slate-400 hover:bg-white/80 hover:text-slate-700"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Current text preview */}
      <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
          Current text
        </div>
        <p className="text-sm text-slate-700 line-clamp-3">
          {field.value || <em className="text-slate-400">Empty</em>}
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Intent */}
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">
            What do you want to change?
          </label>
          <textarea
            ref={intentRef}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={500}
            placeholder='e.g. "Make it sound more local and trustworthy" or "Shorter and punchier"'
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">
                ⌘↵
              </kbd>{" "}
              to generate
            </span>
            <span>{intent.length} / 500</span>
          </div>
        </div>

        {/* Tone chips */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Tone presets (select up to 3)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TONE_PRESETS.map((preset) => {
              const active = tones.includes(preset.label);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => toggleTone(preset.label)}
                  title={preset.desc}
                  className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    active
                      ? "border-indigo-400 bg-indigo-100 text-indigo-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate button */}
        <button
          type="button"
          disabled={!intent.trim() || loading || cooldown}
          onClick={() => void generate()}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {loading
            ? "Generating…"
            : cooldown
              ? "Please wait…"
              : "✨ Generate 3 options"}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-lg border border-slate-200 p-4 space-y-2"
              >
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-3/4 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {/* Variant cards */}
        {!loading && variants.length > 0 && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Pick a version to use
            </div>
            {variants.map((v, i) => (
              <VariantCard
                key={i}
                variant={v}
                maxLength={field.maxLength}
                onUse={() => onPick(v.text)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-500">
        AI suggestions may need a quick review before publishing. Picking a
        variant lets you edit it further before saving.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant card
// ---------------------------------------------------------------------------

interface VariantCardProps {
  variant: Variant;
  maxLength?: number;
  onUse: () => void;
}

function VariantCard({ variant, maxLength, onUse }: VariantCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isTruncatable = variant.text.length > 160;

  const charCount = variant.text.length;
  const overLimit = maxLength != null && charCount > maxLength;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
          {variant.tone}
        </span>
        <span
          className={`text-[11px] ${overLimit ? "text-amber-600 font-medium" : "text-slate-400"}`}
        >
          {charCount}
          {maxLength != null ? ` / ${maxLength}` : ""} chars
        </span>
      </div>

      <p
        className={`text-sm text-slate-800 leading-relaxed ${!expanded && isTruncatable ? "line-clamp-4" : ""}`}
      >
        {variant.text}
      </p>

      {isTruncatable && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-[11px] text-indigo-600 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <button
        type="button"
        onClick={onUse}
        className="mt-3 w-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
      >
        Use this
      </button>
    </div>
  );
}
