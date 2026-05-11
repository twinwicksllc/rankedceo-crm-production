// =============================================================================
// app/admin/dashboard/domain-requests/page.tsx
//
// Admin domain requests queue — shows all tenant domain requests
// with workflow status management.
//
// Phase 6.3
// =============================================================================

import { getDomainRequests } from '@/lib/waas/actions/admin'
import { RequestRow }        from './request-row'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export default async function DomainRequestsPage() {
  const result = await getDomainRequests({ workflowStatus: 'all' })
  const requests = result.data ?? []

  const counts = {
    all:          requests.length,
    requested:    requests.filter(r => r.workflowStatus === 'requested').length,
    under_review: requests.filter(r => r.workflowStatus === 'under_review').length,
    provisioning: requests.filter(r => r.workflowStatus === 'provisioning').length,
    live:         requests.filter(r => r.workflowStatus === 'live').length,
    rejected:     requests.filter(r => r.workflowStatus === 'rejected').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Domain Requests</h1>
        <p className="text-white/40 mt-1 text-sm">
          Manage tenant domain requests through the provisioning workflow.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {([
          { label: 'Requested',    value: counts.requested,    color: 'text-sky-400'     },
          { label: 'Under Review', value: counts.under_review, color: 'text-amber-400'   },
          { label: 'Provisioning', value: counts.provisioning, color: 'text-violet-400'  },
          { label: 'Live',         value: counts.live,         color: 'text-emerald-400' },
          { label: 'Rejected',     value: counts.rejected,     color: 'text-red-400'     },
        ] as const).map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center"
          >
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {!result.success && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {result.error ?? 'Failed to load domain requests.'}
        </div>
      )}

      {/* Request list */}
      {requests.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
          <p className="text-white/30 text-sm">No domain requests yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="divide-y divide-white/5">
            {requests.map((req) => (
              <RequestRow key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
