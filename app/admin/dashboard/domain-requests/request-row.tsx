'use client'

// =============================================================================
// app/admin/dashboard/domain-requests/request-row.tsx
//
// Individual domain request row in the admin queue.
// Shows: domain, business, workflow status, history, and action buttons.
//
// Phase 6.3
// =============================================================================

import { useState, useTransition } from 'react'
import {
  updateDomainRequestStatus,
  type AdminDomainRequest,
  type DomainWorkflowStatus,
} from '@/lib/waas/actions/admin'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKFLOW_CONFIG: Record<DomainWorkflowStatus, { label: string; color: string; dot: string }> = {
  requested:    { label: 'Requested',    color: 'text-sky-400',     dot: 'bg-sky-400'     },
  under_review: { label: 'Under Review', color: 'text-amber-400',   dot: 'bg-amber-400'   },
  provisioning: { label: 'Provisioning', color: 'text-violet-400',  dot: 'bg-violet-400'  },
  live:         { label: 'Live',         color: 'text-emerald-400', dot: 'bg-emerald-400' },
  rejected:     { label: 'Rejected',     color: 'text-red-400',     dot: 'bg-red-400'     },
}

const NEXT_ACTIONS: Record<DomainWorkflowStatus, DomainWorkflowStatus[]> = {
  requested:    ['under_review', 'rejected'],
  under_review: ['provisioning', 'rejected'],
  provisioning: ['live', 'rejected'],
  live:         [],
  rejected:     ['requested'],
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RequestRowProps {
  request: AdminDomainRequest
}

export function RequestRow({ request }: RequestRowProps) {
  const router = useRouter()
  const [expanded,    setExpanded]    = useState(false)
  const [adminNotes,  setAdminNotes]  = useState(request.adminNotes ?? '')
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()

  const wc = WORKFLOW_CONFIG[request.workflowStatus]
  const nextActions = NEXT_ACTIONS[request.workflowStatus]

  const handleAction = (newStatus: DomainWorkflowStatus) => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await updateDomainRequestStatus({
        requestId:      request.id,
        workflowStatus: newStatus,
        adminNotes:     adminNotes || undefined,
        changedBy:      'admin',
      })
      if (result.success) {
        setSuccess(`Moved to "${WORKFLOW_CONFIG[newStatus].label}"`)
        router.refresh()
      } else {
        setError(result.error ?? 'Update failed')
      }
    })
  }

  return (
    <div className="px-5 py-4">
      {/* Main row */}
      <div className="flex items-start gap-4">
        {/* Priority badge */}
        <div className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[10px] font-bold text-white/50">
          {request.priority}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-white">
              {request.fullDomain}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-white/10 ${wc.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${wc.dot}`} />
              {wc.label}
            </span>
          </div>
          <p className="text-xs text-white/50 truncate">
            {request.businessName}
            <span className="text-white/25 mx-1.5">·</span>
            {timeAgo(request.createdAt)}
            {request.notes && (
              <>
                <span className="text-white/25 mx-1.5">·</span>
                <span className="italic text-white/35">{request.notes}</span>
              </>
            )}
          </p>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-white/30 hover:text-white/60 transition-colors text-xs"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="mt-4 ml-10 space-y-4">
          {/* Status history */}
          {request.statusHistory.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-white/30 uppercase mb-1.5">History</p>
              <div className="flex flex-col gap-1">
                {request.statusHistory.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-white/40">
                    <span className={`font-medium ${WORKFLOW_CONFIG[entry.workflowStatus]?.color ?? 'text-white/40'}`}>
                      {WORKFLOW_CONFIG[entry.workflowStatus]?.label ?? entry.workflowStatus}
                    </span>
                    <span>→</span>
                    <span className="text-white/25">{timeAgo(entry.changedAt)} by {entry.changedBy}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin notes */}
          <div>
            <label className="text-[10px] font-semibold text-white/30 uppercase" htmlFor={`notes-${request.id}`}>
              Internal Notes
            </label>
            <textarea
              id={`notes-${request.id}`}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Notes visible to admins only…"
              rows={2}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
            />
          </div>

          {/* Error / success */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-400">✓ {success}</p>
          )}

          {/* Action buttons */}
          {nextActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nextActions.map((next) => {
                const nc = WORKFLOW_CONFIG[next]
                const isReject = next === 'rejected'
                return (
                  <button
                    key={next}
                    type="button"
                    onClick={() => handleAction(next)}
                    disabled={isPending}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 border ${
                      isReject
                        ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {isPending ? '…' : `→ ${nc.label}`}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
