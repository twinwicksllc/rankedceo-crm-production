'use client'

// =============================================================================
// Domain Status Manager — inline status update for domain requests
// =============================================================================

import React, { useState } from 'react'
import { updateDomainStatus } from '@/lib/waas/actions/admin'
import type { WaasDomainRequest } from '@/lib/waas/types'

const STATUS_OPTIONS: WaasDomainRequest['status'][] = [
  'requested', 'checking', 'available', 'taken', 'registered', 'connected',
]

const STATUS_CONFIG: Record<WaasDomainRequest['status'], { label: string; class: string }> = {
  requested:  { label: 'Requested',  class: 'bg-amber-500/10 text-amber-400 border-amber-500/20'    },
  checking:   { label: 'Checking',   class: 'bg-blue-500/10 text-blue-400 border-blue-500/20'       },
  available:  { label: 'Available',  class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  taken:      { label: 'Taken',      class: 'bg-red-500/10 text-red-400 border-red-500/20'          },
  registered: { label: 'Registered', class: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  connected:  { label: 'Connected',  class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

const PRIORITY_LABELS = ['1st Choice', '2nd Choice', '3rd Choice']

interface Props {
  request: WaasDomainRequest
}

export function DomainStatusManager({ request }: Props) {
  const [status,   setStatusState] = useState(request.status)
  const [loading,  setLoading]     = useState(false)
  const [editing,  setEditing]     = useState(false)
  const [newStatus, setNewStatus]  = useState(request.status)
  const [notes,    setNotes]       = useState(request.notes ?? '')

  const cfg = STATUS_CONFIG[status]

  const handleSave = async () => {
    setLoading(true)
    const result = await updateDomainStatus(request.id, newStatus, notes || undefined)
    if (result.success) {
      setStatusState(newStatus)
      setEditing(false)
    }
    setLoading(false)
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="flex items-center gap-3">
        {/* Priority badge */}
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {request.priority}
        </div>

        {/* Domain */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-white font-semibold text-sm">{request.domain_name}</span>
            <span className="text-blue-400 text-sm font-medium">{request.extension}</span>
          </div>
          <span className="text-white/30 text-xs">{PRIORITY_LABELS[request.priority - 1]}</span>
        </div>

        {/* Status badge */}
        {!editing ? (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.class}`}>
              {cfg.label}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
              title="Update status"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8.5 1.5L10.5 3.5l-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Update Status</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as WaasDomainRequest['status'])}
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-sm outline-none focus:border-blue-500/60 [&_option]:bg-[#0A0F1E] cursor-pointer"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Registered via Namecheap, expires 2026"
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/20 outline-none focus:border-blue-500/60"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-60 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Saving…
                </>
              ) : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setNewStatus(status) }}
              className="px-3 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white text-xs transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}