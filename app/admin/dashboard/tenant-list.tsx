'use client'

// =============================================================================
// app/admin/dashboard/tenant-list.tsx
//
// Enhanced tenant list for Phase 6.2.
// Supports live search, status filter tabs, sort controls,
// per-row checkbox selection, and wires into BulkActionBar.
//
// Renders inside the admin dashboard page as a client component so that
// search/filter state can be managed without full-page server round-trips.
//
// Props:
//   initialTenants — passed from the server page (pre-loaded on mount)
// =============================================================================

import { useCallback, useMemo, useState, useTransition } from 'react'
import Link    from 'next/link'
import {
  searchTenants,
  bulkUpdateTenantStatus,
  type AdminTenantListItem,
  type TenantSearchFilters,
  type BulkTenantAction,
} from '@/lib/waas/actions/admin'
import type { WaasTenantStatus } from '@/lib/waas/types'
import { BulkActionBar }  from './bulk-action-bar'
import { ReadinessChips, ReadinessScore } from '@/components/waas/admin/ReadinessChips'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_TABS: Array<{ id: WaasTenantStatus | 'all'; label: string }> = [
  { id: 'all',            label: 'All'           },
  { id: 'onboarding',     label: 'Onboarding'    },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'active',         label: 'Active'        },
  { id: 'suspended',      label: 'Suspended'     },
]

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending_review: { label: 'Pending Review', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  onboarding:     { label: 'Onboarding',     class: 'bg-blue-500/10 text-blue-400 border-blue-500/20'   },
  active:         { label: 'Active',         class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  suspended:      { label: 'Suspended',      class: 'bg-red-500/10 text-red-400 border-red-500/20'      },
  cancelled:      { label: 'Cancelled',      class: 'bg-white/5 text-white/30 border-white/10'          },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.onboarding
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.class}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  )
}

function getBusinessName(t: AdminTenantListItem): string {
  const bc = t.brand_config as { business_name?: string } | null
  return bc?.business_name ?? t.slug ?? '—'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function exportCsv(tenants: AdminTenantListItem[]) {
  const header = 'Business Name,Status,Slug,Domain,Created At,Template Selected'
  const rows = tenants.map((t) => {
    const name = getBusinessName(t).replace(/,/g, ' ')
    const domain = t.domain ?? t.subdomain ?? ''
    const selected = t.client_selected_template_slug ?? ''
    return `${name},${t.status},${t.slug},${domain},${formatDate(t.created_at)},${selected}`
  })
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TenantListProps {
  initialTenants: AdminTenantListItem[]
}

export function TenantList({ initialTenants }: TenantListProps) {
  const [tenants,  setTenants]  = useState<AdminTenantListItem[]>(initialTenants)
  const [query,    setQuery]    = useState('')
  const [status,   setStatus]   = useState<WaasTenantStatus | 'all'>('all')
  const [sortBy,   setSortBy]   = useState<TenantSearchFilters['sortBy']>('created_at')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error,    setError]    = useState<string | null>(null)
  const [bulkMsg,  setBulkMsg]  = useState<string | null>(null)

  const [isSearching, startSearch] = useTransition()
  const [isBulking,   startBulk]   = useTransition()

  // ---- Search / filter ----
  const runSearch = useCallback((
    newQuery: string,
    newStatus: WaasTenantStatus | 'all',
    newSortBy: TenantSearchFilters['sortBy'],
    newSortDir: 'asc' | 'desc',
  ) => {
    setError(null)
    startSearch(async () => {
      const result = await searchTenants({
        query:   newQuery,
        status:  newStatus,
        sortBy:  newSortBy,
        sortDir: newSortDir,
      })
      if (result.success && result.data) {
        setTenants(result.data)
        setSelected(new Set()) // clear selection on new search
      } else {
        setError(result.error ?? 'Search failed')
      }
    })
  }, [])

  const handleQueryChange = (q: string) => {
    setQuery(q)
    runSearch(q, status, sortBy, sortDir)
  }

  const handleStatusChange = (s: WaasTenantStatus | 'all') => {
    setStatus(s)
    runSearch(query, s, sortBy, sortDir)
  }

  const handleSort = (field: TenantSearchFilters['sortBy']) => {
    const newDir = sortBy === field && sortDir === 'desc' ? 'asc' : 'desc'
    setSortBy(field)
    setSortDir(newDir)
    runSearch(query, status, field, newDir)
  }

  // ---- Selection ----
  const allIds     = useMemo(() => tenants.map((t) => t.id), [tenants])
  const allChecked = selected.size === allIds.length && allIds.length > 0

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ---- Bulk actions ----
  const handleBulkAction = (action: BulkTenantAction) => {
    if (!selected.size) return
    setBulkMsg(null)
    setError(null)
    startBulk(async () => {
      const result = await bulkUpdateTenantStatus(Array.from(selected), action)
      if (result.success && result.data) {
        setBulkMsg(`Updated ${result.data.updatedCount} tenant${result.data.updatedCount === 1 ? '' : 's'}.`)
        setSelected(new Set())
        // Refresh list
        const refreshed = await searchTenants({ query, status, sortBy, sortDir })
        if (refreshed.success && refreshed.data) setTenants(refreshed.data)
      } else {
        setError(result.error ?? 'Bulk action failed')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">

      {/* Search + controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
            viewBox="0 0 16 16" fill="none" aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            placeholder="Search tenants…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        {/* Sort button */}
        <button
          type="button"
          onClick={() => handleSort('business_name')}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition-colors"
        >
          A→Z {sortBy === 'business_name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          type="button"
          onClick={() => handleSort('created_at')}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition-colors"
        >
          Date {sortBy === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>

        {/* Export CSV */}
        <button
          type="button"
          onClick={() => exportCsv(tenants)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition-colors"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleStatusChange(tab.id as WaasTenantStatus | 'all')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              status === tab.id
                ? 'bg-white text-slate-900'
                : 'text-white/50 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Bulk success message */}
      {bulkMsg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
          ✓ {bulkMsg}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          onActivate={() => handleBulkAction('activate')}
          onSuspend={() => handleBulkAction('suspend')}
          onClear={() => setSelected(new Set())}
          isBusy={isBulking}
        />
      )}

      {/* Searching indicator */}
      {isSearching && (
        <div className="text-xs text-white/30 text-center py-2">Searching…</div>
      )}

      {/* Tenant table */}
      {!isSearching && (
        <div className="overflow-x-auto rounded-xl border border-white/10" data-testid="waas-clients-table-inner">
          <table className="w-full text-sm" data-testid="tenants-table">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="accent-white"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Business</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Domain</th>
                <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Readiness</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/30 text-sm">
                    No tenants found.
                  </td>
                </tr>
              )}
              {tenants.map((tenant) => {
                const name   = getBusinessName(tenant)
                const domain = tenant.domain ?? (tenant.subdomain ? `${tenant.subdomain}.rankedceo.com` : '—')
                const isChecked = selected.has(tenant.id)

                return (
                  <tr
                    key={tenant.id}
                    className={`transition-colors hover:bg-white/[0.03] ${isChecked ? 'bg-white/[0.04]' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(tenant.id)}
                        aria-label={`Select ${name}`}
                        className="accent-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white truncate max-w-[180px]">{name}</div>
                      <div className="text-[11px] text-white/30 mt-0.5">{tenant.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-white/50 text-xs truncate max-w-[160px] block">
                        {domain}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <ReadinessChips tenant={tenant} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-white/40 text-xs">
                      {formatDate(tenant.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden sm:inline">
                          <ReadinessScore tenant={tenant} />
                        </span>
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="text-xs text-white/40 hover:text-white transition-colors"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Count */}
      {!isSearching && tenants.length > 0 && (
        <p className="text-xs text-white/25 text-right">
          {tenants.length} tenant{tenants.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}
