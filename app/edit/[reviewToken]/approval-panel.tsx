'use client'

// =============================================================================
// app/edit/[reviewToken]/approval-panel.tsx
// Modal that handles the "Approve & Publish" and "Undo Approval" actions.
// =============================================================================

import { useState, useTransition } from 'react'
import {
  submitClientApproval,
  revokeClientApproval,
} from '@/lib/waas/actions/client-edit'
import type { EditorSessionProps } from './editor-shell'

interface ApprovalPanelProps {
  session:     EditorSessionProps
  onClose:     () => void
  onCompleted: (kind: 'approved' | 'revoked') => void
}

export function ApprovalPanel({ session, onClose, onCompleted }: ApprovalPanelProps) {
  const mode: 'approve' | 'revoke' = session.approvalAt ? 'revoke' : 'approve'
  const [note, setNote]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  const submit = () => {
    setError(null)
    start(async () => {
      try {
        if (mode === 'approve') {
          const r = await submitClientApproval({
            reviewToken:  session.reviewToken,
            approvalNote: note.trim() || undefined,
          })
          if (!r.success) {
            setError(r.error ?? 'Unable to submit approval.')
            return
          }
          onCompleted('approved')
        } else {
          const r = await revokeClientApproval(session.reviewToken)
          if (!r.success) {
            setError(r.error ?? 'Unable to revoke approval.')
            return
          }
          onCompleted('revoked')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error.')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="text-base font-semibold text-slate-900">
            {mode === 'approve' ? 'Approve & Publish' : 'Undo Approval?'}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'approve'
              ? "Once approved, our team will deploy your website to your domain. You'll have a 1-hour window to undo this if needed."
              : "You can keep editing. Once you're happy, approve again to publish."}
          </p>
        </div>

        <div className="p-6">
          {mode === 'approve' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Anything else you&apos;d like us to know? <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Any final notes for our team…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="mt-1 text-right text-[11px] text-slate-400">
                {note.length} / 500
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={submit}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'approve'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isPending
              ? 'Working…'
              : mode === 'approve'
                ? 'Yes, Approve & Publish'
                : 'Yes, Undo Approval'}
          </button>
        </div>
      </div>
    </div>
  )
}
