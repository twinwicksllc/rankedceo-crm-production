// =============================================================================
// AdvantagePoint — Admin Dashboard (Server Component)
// Shows all pending + active tenants with stats
// =============================================================================

import React from 'react'
import Link from 'next/link'
import { getAdminTenants, getAdminStats } from '@/lib/waas/actions/admin'
import type { WaasTenant } from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: WaasTenant['status'] }) {
  const config = {
    pending_review: { label: 'Pending Review', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    onboarding:     { label: 'Onboarding',     class: 'bg-blue-500/10 text-blue-400 border-blue-500/20'   },
    active:         { label: 'Active',         class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    suspended:      { label: 'Suspended',      class: 'bg-red-500/10 text-red-400 border-red-500/20'      },
    cancelled:      { label: 'Cancelled',      class: 'bg-white/5 text-white/30 border-white/10'          },
  }
  const c = config[status] ?? config.onboarding
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.class}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminDashboardPage() {
  const [tenantsResult, statsResult] = await Promise.all([
    getAdminTenants(),
    getAdminStats(),
  ])

  const tenants = tenantsResult.data ?? []
  const stats   = statsResult.data ?? { pendingCount: 0, activeCount: 0, totalLeads: 0 }

  const pending = tenants.filter(t => t.status === 'pending_review' || t.status === 'onboarding')
  const active  = tenants.filter(t => t.status === 'active')

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Command Center</h1>
        <p className="text-white/40 mt-1 text-sm">Manage all AdvantagePoint tenants and deployments.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {[
          {
            label: 'Pending Review',
            value: stats.pendingCount,
            icon:  '⏳',
            color: 'amber',
            glow:  'shadow-amber-500/10',
          },
          {
            label: 'Active Sites',
            value: stats.activeCount,
            icon:  '🚀',
            color: 'emerald',
            glow:  'shadow-emerald-500/10',
          },
          {
            label: 'Total Leads',
            value: stats.totalLeads,
            icon:  '👥',
            color: 'blue',
            glow:  'shadow-blue-500/10',
          },
        ].map(card => (
          <div
            key={card.label}
            className={`rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6 shadow-xl ${card.glow}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
            <div className="text-white/40 text-sm">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Pending tenants */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Pending Review
            {pending.length > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                {pending.length}
              </span>
            )}
          </h2>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl bg-white/3 border border-dashed border-white/10 p-10 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">✅</span>
            <p className="text-white/30 text-sm">No tenants pending review.</p>
          </div>
        ) : (
          <TenantTable tenants={pending} />
        )}
      </div>

      {/* Active tenants */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Active Sites
            {active.length > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                {active.length}
              </span>
            )}
          </h2>
        </div>

        {active.length === 0 ? (
          <div className="rounded-2xl bg-white/3 border border-dashed border-white/10 p-10 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">🏗️</span>
            <p className="text-white/30 text-sm">No active sites yet. Deploy a pending tenant to see it here.</p>
          </div>
        ) : (
          <TenantTable tenants={active} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tenant Table
// ---------------------------------------------------------------------------

function TenantTable({ tenants }: { tenants: WaasTenant[] }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {['Business', 'Trade', 'Location', 'Package', 'Status', 'Submitted', ''].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-white/3 transition-colors group">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {/* Brand color dot */}
                    <div
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: `linear-gradient(135deg, ${t.brand_config?.colors?.primary ?? '#2563EB'}, ${t.brand_config?.colors?.secondary ?? '#1E40AF'})` }}
                    >
                      {(t.brand_config?.business_name ?? t.legal_name ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm truncate max-w-[160px]">
                        {t.brand_config?.business_name ?? t.legal_name ?? '—'}
                      </p>
                      <p className="text-white/30 text-xs">{t.submitted_by_email ?? '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-white/60 text-sm">{t.primary_trade ?? '—'}</td>
                <td className="px-5 py-4 text-white/60 text-sm">
                  {t.city && t.state ? `${t.city}, ${t.state}` : '—'}
                </td>
                <td className="px-5 py-4">
                  <span className="capitalize text-white/60 text-sm">{t.package_tier}</span>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-5 py-4 text-white/40 text-xs">
                  {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/dashboard/${t.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-white/5">
        {tenants.map(t => (
          <Link key={t.id} href={`/admin/dashboard/${t.id}`} className="block p-4 hover:bg-white/3 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: `linear-gradient(135deg, ${t.brand_config?.colors?.primary ?? '#2563EB'}, ${t.brand_config?.colors?.secondary ?? '#1E40AF'})` }}
              >
                {(t.brand_config?.business_name ?? t.legal_name ?? '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {t.brand_config?.business_name ?? t.legal_name ?? '—'}
                </p>
                <p className="text-white/40 text-xs">{t.primary_trade ?? '—'} • {t.city ?? '—'}</p>
              </div>
              <StatusBadge status={t.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}