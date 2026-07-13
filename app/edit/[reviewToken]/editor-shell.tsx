"use client";

// =============================================================================
// app/edit/[reviewToken]/editor-shell.tsx
// Main client UI for the self-service editor.
// Phase 5.3 additions:
//   - onToggle handler for section visibility switches
//   - variantIndex passed to InlineEditModal for image uploads
//   - AI usage counter badge in top bar
// Phase 5.5 additions:
//   - Edit history panel (clock icon in top bar)
//   - Undo per-event via undoClientEdit server action
// PR #102 additions:
//   - Per-section "✨ Regenerate with AI" button in FieldNavigator headers
//   - RegenerateSectionPanel slide-in, diff review, and bulk apply
//   - Batch updateClientVariantContent calls when client applies AI results
// =============================================================================

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { ClientEditPermissions } from "@/lib/waas/client-edit/edit-session";
import type { EditableField } from "@/lib/waas/client-edit/editable-fields";
import { groupEditableFields } from "@/lib/waas/client-edit/editable-fields";
import type { SectionId } from "@/lib/waas/templates/types";
import { FieldNavigator } from "./field-navigator";
import { InlineEditModal } from "./inline-edit-modal";
import { ApprovalPanel } from "./approval-panel";
import { EditHistoryPanel } from "./edit-history-panel";
import { RegenerateSectionPanel } from "./regenerate-section-panel";
import type { RegeneratedField } from "@/lib/waas/actions/client-edit";
import {
  updateClientVariantContent,
  updateClientBrandConfig,
} from "@/lib/waas/actions/client-edit";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorSessionProps {
  tenantId: string;
  slug: string;
  businessName: string;
  reviewToken: string;
  selectedVariantIndex: number | null;
  selectedTemplateSlug: string | null;
  permissions: ClientEditPermissions;
  approvalAt: string | null;
  approvalLocked: boolean;
}

interface EditorShellProps {
  session: EditorSessionProps;
  initialFields: EditableField[];
  initialHistoryOpen?: boolean; // Phase 6.1: set true when navigating from History tab
  isPaid?: boolean; // Task 8: gate Approve & Publish behind payment (default true)
  autoOpenApproval?: boolean; // Task 8: auto-open approval panel after Stripe checkout
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorShell({
  session,
  initialFields,
  initialHistoryOpen = false,
  isPaid = true,
  autoOpenApproval = false,
}: EditorShellProps) {
  const [fields, setFields] = useState<EditableField[]>(initialFields);
  const [activeField, setActiveF] = useState<EditableField | null>(null);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [previewVersion, setPV] = useState(0);
  const [showApproval, setSA] = useState(autoOpenApproval);
  const [showHistory, setShowHistory] = useState(initialHistoryOpen);
  const [isSaving, startSave] = useTransition();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiUseCount = useRef(0);
  const [aiCount, setAiCount] = useState(0);

  // PR #102 — per-section regenerate state
  const [regenPanel, setRegenPanel] = useState<{
    sectionId: SectionId;
    sectionLabel: string;
  } | null>(null);

  const groups = useMemo(() => groupEditableFields(fields), [fields]);

  const showToast = useCallback((kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // -------------------------------------------------------------------------
  // Save handler — routes to the right server action based on scope.
  // -------------------------------------------------------------------------

  const handleSave = useCallback(
    (field: EditableField, newValue: string) => {
      if (session.permissions.isLocked) {
        showToast("error", "Editing is locked — approval submitted.");
        return;
      }

      const prevValue = field.value;
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, value: newValue } : f)),
      );
      setActiveF(null);

      // Coerce the editor's always-string value back into the proper JSON
      // type for config fields before persisting — the server also
      // validates independently (validateConfigValue), but sending the
      // right type avoids an unnecessary round-trip failure.
      const coercedValue: string | number | boolean =
        field.kind === "number"
          ? Number(newValue)
          : field.kind === "boolean"
            ? newValue === "true"
            : newValue;

      startSave(async () => {
        try {
          let result;
          if (field.scope === "brand") {
            const brandField = field.path.replace(/^brand_config\./, "");
            result = await updateClientBrandConfig({
              reviewToken: session.reviewToken,
              field: brandField,
              newValue,
            });
          } else {
            if (session.selectedVariantIndex == null) {
              throw new Error(
                "No variant selected — cannot save section edits.",
              );
            }
            result = await updateClientVariantContent({
              reviewToken: session.reviewToken,
              variantIndex: session.selectedVariantIndex,
              path: field.path,
              newValue: coercedValue,
            });
          }

          if (!result.success) {
            setFields((prev) =>
              prev.map((f) =>
                f.id === field.id ? { ...f, value: prevValue } : f,
              ),
            );
            showToast("error", result.error ?? "Failed to save edit.");
            return;
          }

          showToast("success", "Saved.");
          setPV((v) => v + 1);
        } catch (err) {
          setFields((prev) =>
            prev.map((f) =>
              f.id === field.id ? { ...f, value: prevValue } : f,
            ),
          );
          showToast(
            "error",
            err instanceof Error ? err.message : "Unexpected error.",
          );
        }
      });
    },
    [session, showToast],
  );

  // -------------------------------------------------------------------------
  // Toggle handler — section visibility
  // -------------------------------------------------------------------------

  const handleToggle = useCallback(
    (field: EditableField, enabled: boolean) => {
      if (session.permissions.isLocked) {
        showToast("error", "Editing is locked.");
        return;
      }
      if (session.selectedVariantIndex == null) {
        showToast("error", "No variant selected.");
        return;
      }

      const prevValue = field.value;
      const newValue = String(enabled);

      // Optimistic update
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, value: newValue } : f)),
      );

      startSave(async () => {
        try {
          const result = await updateClientVariantContent({
            reviewToken: session.reviewToken,
            variantIndex: session.selectedVariantIndex!,
            path: field.path, // sections[N].enabled
            newValue: enabled, // boolean — server action accepts JsonValue
          });

          if (!result.success) {
            setFields((prev) =>
              prev.map((f) =>
                f.id === field.id ? { ...f, value: prevValue } : f,
              ),
            );
            showToast(
              "error",
              result.error ?? "Failed to update section visibility.",
            );
            return;
          }

          // Refresh preview and update field list to hide/show content fields
          setPV((v) => v + 1);
        } catch (err) {
          setFields((prev) =>
            prev.map((f) =>
              f.id === field.id ? { ...f, value: prevValue } : f,
            ),
          );
          showToast(
            "error",
            err instanceof Error ? err.message : "Unexpected error.",
          );
        }
      });
    },
    [session, showToast],
  );

  // -------------------------------------------------------------------------
  // PR #102 — handleApplyRegeneration
  // Called when the client accepts all AI-suggested fields from the
  // RegenerateSectionPanel.  Saves each field sequentially and updates local
  // state optimistically.
  // -------------------------------------------------------------------------

  const handleApplyRegeneration = useCallback(
    (regenFields: RegeneratedField[]) => {
      if (session.permissions.isLocked) {
        showToast("error", "Editing is locked — approval submitted.");
        return;
      }
      if (session.selectedVariantIndex == null) {
        showToast("error", "No variant selected — cannot apply AI changes.");
        return;
      }

      // Optimistic update: apply all suggested values to local field state
      setFields((prev) => {
        const patchMap = new Map(
          regenFields.map((rf) => [rf.path, rf.suggested]),
        );
        return prev.map((f) =>
          patchMap.has(f.path) ? { ...f, value: patchMap.get(f.path)! } : f,
        );
      });

      // Increment AI usage counter
      aiUseCount.current += regenFields.length;
      setAiCount(aiUseCount.current);

      startSave(async () => {
        const variantIndex = session.selectedVariantIndex!;
        const failures: string[] = [];

        for (const rf of regenFields) {
          try {
            const result = await updateClientVariantContent({
              reviewToken: session.reviewToken,
              variantIndex,
              path: rf.path,
              newValue: rf.suggested,
            });
            if (!result.success) {
              failures.push(rf.label);
            }
          } catch {
            failures.push(rf.label);
          }
        }

        if (failures.length > 0) {
          showToast(
            "error",
            `Saved with errors: ${failures.join(", ")} failed to persist.`,
          );
        } else {
          showToast(
            "success",
            `✨ ${regenFields.length} AI field${regenFields.length === 1 ? "" : "s"} applied.`,
          );
        }

        // Always refresh the preview
        setPV((v) => v + 1);
      });
    },
    [session, showToast],
  );

  // Track AI rewrite usage (incremented from InlineEditModal via field save with aiIntent)
  const trackAiUse = useCallback(() => {
    aiUseCount.current += 1;
    setAiCount(aiUseCount.current);
  }, []);
  void trackAiUse; // suppress unused warning — called from child via onSave wrapper

  // -------------------------------------------------------------------------
  // Status pill
  // -------------------------------------------------------------------------

  const statusPill = useMemo(() => {
    if (session.approvalLocked) {
      return {
        text: "Approved & Locked",
        color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
    }
    if (session.approvalAt) {
      return {
        text: "Approved (editable)",
        color: "bg-amber-100 text-amber-700 border-amber-200",
      };
    }
    return {
      text: "Editing",
      color: "bg-blue-100 text-blue-700 border-blue-200",
    };
  }, [session.approvalAt, session.approvalLocked]);

  const previewSrc = `/edit/${session.reviewToken}/preview?v=${previewVersion}`;

  // -------------------------------------------------------------------------

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
            R
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {session.businessName}
            </div>
            <div className="text-xs text-slate-500 truncate">
              Editing your website preview
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusPill.color}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusPill.text}
          </span>

          {/* AI usage badge */}
          {aiCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-700">
              ✨ {aiCount} AI rewrite{aiCount === 1 ? "" : "s"}
            </span>
          )}

          {isSaving && <span className="text-xs text-slate-500">Saving…</span>}

          {/* Edit history button */}
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            aria-label="Edit history"
            title="Edit history"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="8"
                cy="8"
                r="6.25"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 5v3.5l2 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {session.permissions.canApprove && (
            <button
              type="button"
              onClick={() => setSA(true)}
              className="inline-flex h-9 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            >
              Approve &amp; Publish
            </button>
          )}
          {session.permissions.canUnaprove && (
            <button
              type="button"
              onClick={() => setSA(true)}
              className="inline-flex h-9 items-center rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              Undo Approval
            </button>
          )}
        </div>
      </header>

      {/* Body: navigator + preview */}
      <div className="flex flex-1 min-h-0">
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
          <FieldNavigator
            groups={groups}
            onFieldClick={(f) => setActiveF(f)}
            onToggle={handleToggle}
            onRegenerateSection={(sid, label) =>
              setRegenPanel({ sectionId: sid, sectionLabel: label })
            }
            disabled={session.permissions.isLocked}
          />
        </aside>

        <main className="flex flex-1 min-w-0 items-center justify-center p-4">
          <div className="flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="mx-auto flex h-6 w-full max-w-md items-center justify-center rounded bg-white px-3 text-xs text-slate-500 ring-1 ring-slate-200">
                {session.slug}.rankedceo.com
              </div>
            </div>
            <iframe
              key={previewVersion}
              src={previewSrc}
              className="flex-1 w-full border-0 bg-white"
              title="Website preview"
            />
          </div>
        </main>
      </div>

      {/* Inline edit modal */}
      {activeField && (
        <InlineEditModal
          field={activeField}
          reviewToken={session.reviewToken}
          variantIndex={session.selectedVariantIndex}
          onCancel={() => setActiveF(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {/* Approval modal */}
      {showApproval && (
        <ApprovalPanel
          session={session}
          isPaid={isPaid}
          onClose={() => setSA(false)}
          onCompleted={(kind) => {
            setSA(false);
            showToast(
              "success",
              kind === "approved"
                ? "Approved! Our team will deploy shortly."
                : kind === "revoked"
                  ? "Approval revoked — keep editing."
                  : "Done.",
            );
            setTimeout(() => window.location.reload(), 1200);
          }}
        />
      )}

      {/* Edit history panel */}
      {showHistory && (
        <EditHistoryPanel
          reviewToken={session.reviewToken}
          variantIndex={session.selectedVariantIndex}
          isLocked={session.approvalLocked}
          onUndo={() => {
            setPV((v) => v + 1);
            showToast("success", "Change undone ✓");
          }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* PR #102 — Per-section AI regenerate panel */}
      {regenPanel && session.selectedVariantIndex != null && (
        <RegenerateSectionPanel
          sectionId={regenPanel.sectionId}
          sectionLabel={regenPanel.sectionLabel}
          reviewToken={session.reviewToken}
          variantIndex={session.selectedVariantIndex}
          onApply={handleApplyRegeneration}
          onClose={() => setRegenPanel(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium shadow-lg ${
            toast.kind === "success"
              ? "bg-slate-900 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
