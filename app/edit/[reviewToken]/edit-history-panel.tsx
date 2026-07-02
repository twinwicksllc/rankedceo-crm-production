"use client";

// =============================================================================
// app/edit/[reviewToken]/edit-history-panel.tsx
//
// Slide-in panel showing the client's edit history with per-row undo.
//
// Opens from a clock-icon button in the editor top bar.
// Shows the last 50 edits for the active variant, most-recent first.
// Each row has an "Undo" button that calls undoClientEdit server action,
// then reloads the list and fires onUndo() so the editor shell refreshes
// the iframe preview.
//
// Props:
//   reviewToken    — raw review token
//   variantIndex   — which variant is being edited (filters the list)
//   isLocked       — when true, undo buttons are hidden
//   onUndo()       — called after a successful undo so the shell can bump
//                    previewVersion
//   onClose()      — close the panel
// =============================================================================

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  getClientEditHistory,
  undoClientEdit,
  type EditHistoryEvent,
  type EditType,
} from "@/lib/waas/actions/client-edit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDIT_TYPE_LABELS: Record<EditType, string> = {
  text_edit: "Text",
  image_swap: "Image",
  color_change: "Colour",
  ai_rewrite: "AI rewrite",
  section_toggle: "Section toggle",
  font_change: "Font",
};

const EDIT_TYPE_ICONS: Record<EditType, string> = {
  text_edit: "✏️",
  image_swap: "🖼️",
  color_change: "🎨",
  ai_rewrite: "✨",
  section_toggle: "👁️",
  font_change: "🔤",
};

function formatPath(path: string): string {
  // sections[0].content.headline → "Hero › Headline"
  return path
    .replace(/sections\[(\d+)\]\.content\./, "Section $1 › ")
    .replace(/brand_config\./, "Brand › ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s*\.\s*/g, " › ");
}

function formatValue(val: string | null, editType: EditType): string {
  if (val === null) return "—";
  if (editType === "section_toggle")
    return val === "true" ? "Visible" : "Hidden";
  if (editType === "color_change") {
    return val.startsWith("#") ? val.toUpperCase() : val;
  }
  if (editType === "image_swap") {
    try {
      const u = new URL(val);
      return u.pathname.split("/").pop() ?? val;
    } catch {
      return val.slice(0, 40);
    }
  }
  return val.length > 60 ? val.slice(0, 60) + "…" : val;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function isUndoEvent(event: EditHistoryEvent): boolean {
  return (
    typeof event.aiIntent === "string" && event.aiIntent.startsWith("undo:")
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EditHistoryPanelProps {
  reviewToken: string;
  variantIndex: number | null;
  isLocked: boolean;
  onUndo: () => void;
  onClose: () => void;
}

export function EditHistoryPanel({
  reviewToken,
  variantIndex,
  isLocked,
  onUndo,
  onClose,
}: EditHistoryPanelProps) {
  const [events, setEvents] = useState<EditHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // ---- Load history ----
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getClientEditHistory(
      reviewToken,
      variantIndex ?? undefined,
      50,
    );
    setLoading(false);
    if (result.success && result.data) {
      setEvents(result.data);
    } else {
      setError(result.error ?? "Failed to load history");
    }
  }, [reviewToken, variantIndex]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // ---- ESC closes panel (capture phase so it doesn't bubble to modal) ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () =>
      document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  // ---- Focus trap ----
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // ---- Undo handler ----
  const handleUndo = (eventId: string) => {
    if (undoingId || isLocked) return;
    setUndoingId(eventId);
    setUndoError(null);
    startTransition(async () => {
      const result = await undoClientEdit({ reviewToken, eventId });
      setUndoingId(null);
      if (result.success) {
        onUndo(); // tell shell to bump previewVersion
        void loadHistory(); // reload the list (undo itself is now in history)
      } else {
        setUndoError(result.error ?? "Undo failed");
        setTimeout(() => setUndoError(null), 4000);
      }
    });
  };

  // ---- Render ----
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Edit history"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex h-full w-full max-w-sm flex-col bg-slate-900 shadow-2xl outline-none border-l border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🕐</span>
            <h2 className="text-sm font-semibold text-white">Edit History</h2>
            {events.length > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                {events.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit history"
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Undo error banner */}
        {undoError && (
          <div className="mx-4 mt-3 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            {undoError}
          </div>
        )}

        {/* Locked banner */}
        {isLocked && (
          <div className="mx-4 mt-3 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
            Design is approved — undo is disabled.
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading && (
            <div className="flex items-center justify-center py-16 text-white/30 text-sm">
              Loading history…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
              <button
                type="button"
                onClick={() => void loadHistory()}
                className="ml-2 underline text-red-200 hover:text-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-3xl mb-3">📝</span>
              <p className="text-sm text-white/40">No edits yet.</p>
              <p className="text-xs text-white/25 mt-1">
                Changes you make will appear here.
              </p>
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {events.map((event) => {
                const isUndo = isUndoEvent(event);
                const isUndoing = undoingId === event.id;
                const canUndo =
                  !isLocked && !isUndo && event.oldValue !== null && !isPending;

                return (
                  <div
                    key={event.id}
                    className={`rounded-xl border px-3 py-2.5 transition-colors ${
                      isUndo
                        ? "border-white/5 bg-white/3 opacity-60"
                        : "border-white/10 bg-slate-800/50 hover:border-white/20"
                    }`}
                  >
                    {/* Top row: icon + type + time */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px]">
                          {isUndo ? "↩️" : EDIT_TYPE_ICONS[event.editType]}
                        </span>
                        <span className="text-[11px] font-semibold text-white/60">
                          {isUndo ? "Undone" : EDIT_TYPE_LABELS[event.editType]}
                          {event.source === "ai_assist" && !isUndo && (
                            <span className="ml-1 text-violet-400">✨</span>
                          )}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/30 tabular-nums">
                        {timeAgo(event.createdAt)}
                      </span>
                    </div>

                    {/* Field path */}
                    <p className="text-[11px] text-white/50 mb-1.5 truncate">
                      {formatPath(event.fieldPath)}
                    </p>

                    {/* Value change */}
                    {event.editType !== "section_toggle" && (
                      <div className="flex flex-col gap-0.5 mb-2">
                        {event.oldValue !== null && (
                          <div className="flex items-start gap-1.5 text-[10px]">
                            <span className="shrink-0 text-red-400/70 font-mono mt-px">
                              −
                            </span>
                            <span className="text-white/30 line-clamp-1">
                              {formatValue(event.oldValue, event.editType)}
                            </span>
                          </div>
                        )}
                        {event.newValue !== null && (
                          <div className="flex items-start gap-1.5 text-[10px]">
                            <span className="shrink-0 text-emerald-400/70 font-mono mt-px">
                              +
                            </span>
                            <span className="text-white/50 line-clamp-1">
                              {formatValue(event.newValue, event.editType)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {event.editType === "section_toggle" && (
                      <div className="flex items-center gap-1.5 text-[10px] mb-2">
                        <span className="text-white/30">
                          {event.oldValue !== null && (
                            <span className="line-through">
                              {formatValue(event.oldValue, event.editType)}
                            </span>
                          )}
                          {event.oldValue !== null &&
                            event.newValue !== null &&
                            " → "}
                          {event.newValue !== null && (
                            <span className="text-white/50">
                              {formatValue(event.newValue, event.editType)}
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Undo button */}
                    {canUndo && (
                      <button
                        type="button"
                        onClick={() => handleUndo(event.id)}
                        disabled={isUndoing || isPending}
                        className={`w-full rounded-lg border border-white/10 py-1 text-[11px] font-medium transition-colors ${
                          isUndoing
                            ? "cursor-wait text-white/30"
                            : "text-white/60 hover:border-white/25 hover:bg-white/5 hover:text-white/90"
                        }`}
                      >
                        {isUndoing ? "Undoing…" : "↩ Undo this change"}
                      </button>
                    )}

                    {isUndo && (
                      <p className="text-[10px] text-white/25 text-center">
                        Undo applied
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-3 text-[10px] text-white/25 text-center">
          Showing last {events.length > 0 ? events.length : "—"} edits for this
          variant
        </div>
      </div>
    </div>
  );
}
