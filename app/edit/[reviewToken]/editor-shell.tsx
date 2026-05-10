'use client'

// =============================================================================
// app/edit/[reviewToken]/editor-shell.tsx
// Main client UI for the self-service editor.
//
// Layout:
//   ┌────────────────────────────────────────────────────────────┐
//   │  TopBar: business name • status • Approve & Publish        │
//   ├────────────────┬───────────────────────────────────────────┤
//   │                │                                           │
//   │ FieldNavigator │  Preview iframe                           │
//   │                │  (/edit/[token]/preview)                  │
//   │                │                                           │
//   └────────────────┴───────────────────────────────────────────┘
//
// When a field is clicked, InlineEditModal opens anchored top-center.
// Save → calls updateClientVariantContent / updateClientBrandConfig and
// optimistically updates the in-memory field list, then bumps a version
// counter to refresh the preview iframe.
// =============================================================================

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import type { ClientEditPermissions } from '@/lib/waas/client-edit/edit-session'
import type { EditableField }         from '@/lib/waas/client-edit/editable-fields'
import { groupEditableFields }        from '@/lib/waas/client-edit/editable-fields'
import { FieldNavigator }             from './field-navigator'
import { InlineEditModal }            from './inline-edit-modal'
import { ApprovalPanel }              from './approval-panel'
import {
  updateClientVariantContent,
  updateClientBrandConfig,
} from '@/lib/waas/actions/client-edit'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorSessionProps {
  tenantId:             string
  slug:                 string
  businessName:         string
  reviewToken:          string
  selectedVariantIndex: number | null
  selectedTemplateSlug: string | null
  permissions:          ClientEditPermissions
  approvalAt:           string | null
  approvalLocked:       boolean
}

interface EditorShellProps {
  session:       EditorSessionProps
  initialFields: EditableField[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorShell({ session, initialFields }: EditorShellProps) {
  const [fields, setFields]       = useState<EditableField[]>(initialFields)
  const [activeField, setActiveF] = useState<EditableField | null>(null)
  const [toast, setToast]         = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [previewVersion, setPV]   = useState(0)
  const [showApproval, setSA]     = useState(false)
  const [isSaving, startSave]     = useTransition()
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const groups = useMemo(() => groupEditableFields(fields), [fields])

  const showToast = useCallback((kind: 'success' | 'error', text: string) => {
    setToast({ kind, text })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // -------------------------------------------------------------------------
  // Save handler — routes to the right server action based on scope.
  // Optimistic: apply to state immediately, rollback on error.
  // -------------------------------------------------------------------------

  const handleSave = useCallback(
    (field: EditableField, newValue: string) => {
      if (session.permissions.isLocked) {
        showToast('error', 'Editing is locked — approval submitted.')
        return
      }

      // Optimistic update
      const prevValue = field.value
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, value: newValue } : f)),
      )
      setActiveF(null)

      startSave(async () => {
        try {
          let result
          if (field.scope === 'brand') {
            const brandField = field.path.replace(/^brand_config\./, '')
            result = await updateClientBrandConfig({
              reviewToken: session.reviewToken,
              field:       brandField,
              newValue,
            })
          } else {
            if (session.selectedVariantIndex == null) {
              throw new Error('No variant selected — cannot save section edits.')
            }
            result = await updateClientVariantContent({
              reviewToken:  session.reviewToken,
              variantIndex: session.selectedVariantIndex,
              path:         field.path,
              newValue,
            })
          }

          if (!result.success) {
            // Rollback
            setFields((prev) =>
              prev.map((f) => (f.id === field.id ? { ...f, value: prevValue } : f)),
            )
            showToast('error', result.error ?? 'Failed to save edit.')
            return
          }

          showToast('success', 'Saved.')
          setPV((v) => v + 1)
        } catch (err) {
          setFields((prev) =>
            prev.map((f) => (f.id === field.id ? { ...f, value: prevValue } : f)),
          )
          showToast('error', err instanceof Error ? err.message : 'Unexpected error.')
        }
      })
    },
    [session, showToast],
  )

  // -------------------------------------------------------------------------
  // Status pill text
  // -------------------------------------------------------------------------

  const statusPill = useMemo(() => {
    if (session.approvalLocked) {
      return { text: 'Approved & Locked',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    }
    if (session.approvalAt) {
      return { text: 'Approved (editable)', color: 'bg-amber-100 text-amber-700 border-amber-200' }
    }
    return { text: 'Editing', color: 'bg-blue-100 text-blue-700 border-blue-200' }
  }, [session.approvalAt, session.approvalLocked])

  const previewSrc = `/edit/${session.reviewToken}/preview?v=${previewVersion}`

  // -------------------------------------------------------------------------
  // Render
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusPill.color}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusPill.text}
          </span>

          {isSaving && (
            <span className="text-xs text-slate-500">Saving…</span>
          )}

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
          onCancel={() => setActiveF(null)}
          onSave={handleSave}
          reviewToken={session.reviewToken}
          isSaving={isSaving}
        />
      )}

      {/* Approval modal */}
      {showApproval && (
        <ApprovalPanel
          session={session}
          onClose={() => setSA(false)}
          onCompleted={(kind) => {
            setSA(false)
            showToast('success',
              kind === 'approved' ? 'Approved! Our team will deploy shortly.' :
              kind === 'revoked'  ? 'Approval revoked — keep editing.' :
              'Done.',
            )
            // Soft reload to pick up new permissions
            setTimeout(() => window.location.reload(), 1200)
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium shadow-lg ${
            toast.kind === 'success'
              ? 'bg-slate-900 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}
