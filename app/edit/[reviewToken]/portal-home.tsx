'use client'

// =============================================================================
// app/edit/[reviewToken]/portal-home.tsx
//
// Tenant portal home — the "Overview" tab on /edit/[reviewToken].
//
// Shows:
//   - Site status card (variant, approval state, live URL)
//   - Quick action buttons (Edit / View Site / History)
//   - Recent edits mini-feed (last 5, non-undo)
//   - AI rewrite usage count + total edit count
//
// Props are pre-loaded server-side in page.tsx to avoid an extra client fetch.
// The component itself is 'use client' only for the copy-URL interaction.
//
// Phase 6.1
// =============================================================================

import { useState } from 'react'
import type {
  TenantPortalData,
  TenantPortalRecentEdit,
  TenantPortalSiteStatus,
} from '@/lib/waas/actions/client-edit'
import type { EditType } from '@/lib/waas/actions/client-edit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDIT_TYPE_ICONS: Record<EditType, string> = {
  text_edit:      '✏️',
  image_swap:     '🖼️',
  color_change:   '🎨',
  ai_rewrite:     '✨',
  section_toggle: '👁️',
}

function formatPath(path: string): string {
  return path
    .replace(/sections\[(\d+)\]\.content\./, 'Section $1 › ')
    .replace(/brand_config\./, 'Brand › ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s*\.\s*/g, ' › ')
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatValue(val: string | null, editType: EditType): string {
  if (val === null) return '—'
  if (editType === 'section_toggle') return val === 'true' ? 'Visible' : 'Hidden'
  if (editType === 'color_change') return val.startsWith('#') ? val.toUpperCase() : val
  if (editType === 'image_swap') {
    try {
      const u = new URL(val)
      return u.pathname.split('/').pop() ?? val
    } catch { return val.slice(0, 40) }
  }
  return val.length > 55 ? val.slice(0, 55) + '…' : val
}

function buildLiveUrl(status: TenantPortalSiteStatus): string | null {
  if (status.liveDomain)     return `https://${status.liveDomain}`
  if (status.liveSubdomain)  return `https://${status.liveSubdomain}.rankedceo.com`
  return null
}

function statusConfig(status: TenantPortalSiteStatus): {
  label: string; color: string; dot: string; description: string
} {
  if (status.approvalLocked && status.tenantStatus === 'active') {
    return {
      label: 'Live',
      color: 'text-emerald-400',
      dot:   'bg-emerald-400',
      description: 'Your site is live.',
    }
  }
  if (status.approvalAt && !status.approvalLocked) {
    return {
      label: 'Approved — Deploying',
      color: 'text-violet-400',
      dot:   'bg-violet-400',
      description: 'Approved! Our team is deploying your site now.',
    }
  }
  if (status.tenantStatus === 'active') {
    return {
      label: 'Active',
      color: 'text-emerald-400',
      dot:   'bg-emerald-400',
      description: 'Your site is active.',
    }
  }
  if (status.tenantStatus === 'pending_review') {
    return {
      label: 'Pending Review',
      color: 'text-amber-400',
      dot:   'bg-amber-400',
      description: 'Review your designs and click Approve & Publish when ready.',
    }
  }
  return {
    label: 'Getting Ready',
    color: 'text-sky-400',
    dot:   'bg-sky-400',
    description: 'Your website designs are being prepared.',
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatChip({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-w-[80px]">
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-white/40 text-center leading-tight">{label}</span>
    </div>
  )
}

function RecentEditRow({ edit }: { edit: TenantPortalRecentEdit }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="shrink-0 mt-0.5 text-[13px]">{EDIT_TYPE_ICONS[edit.editType]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-white/70 truncate">{formatPath(edit.fieldPath)}</p>
        {edit.newValue && (
          <p className="text-[10px] text-white/35 truncate mt-0.5">
            {formatValue(edit.newValue, edit.editType)}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-white/30 tabular-nums mt-0.5">
        {timeAgo(edit.createdAt)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PortalHomeProps {
  businessName: string
  data:         TenantPortalData
  onGoToEdit:   () => void
  onGoToHistory: () => void
}

export function PortalHome({
  businessName,
  data,
  onGoToEdit,
  onGoToHistory,
}: PortalHomeProps) {
  const [copied, setCopied] = useState(false)
  const { siteStatus, recentEdits, aiRewriteCount, editCount } = data

  const sc      = statusConfig(siteStatus)
  const liveUrl = buildLiveUrl(siteStatus)

  const handleCopyUrl = () => {
    if (!liveUrl) return
    void navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        {/* Welcome header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here&apos;s an overview of your <span className="font-medium text-slate-700">{businessName}</span> website.
          </p>
        </div>

        {/* Status card */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${sc.dot} animate-pulse`} />
              <span className={`text-sm font-semibold ${sc.color}`}>{sc.label}</span>
              {siteStatus.variantLabel && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {siteStatus.variantLabel}
                </span>
              )}
            </div>
            {liveUrl && (
              <button
                type="button"
                onClick={handleCopyUrl}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
              >
                {copied ? '✓ Copied' : '📋 Copy URL'}
              </button>
            )}
          </div>

          <div className="px-5 py-4">
            <p className="text-sm text-slate-600 mb-3">{sc.description}</p>

            {/* Live URL */}
            {liveUrl ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {liveUrl.replace('https://', '')}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
                  <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                </svg>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                URL will be confirmed after deployment
              </span>
            )}

            {/* Approval timestamp */}
            {siteStatus.approvalAt && (
              <p className="text-[11px] text-slate-400 mt-2">
                Approved {timeAgo(siteStatus.approvalAt)}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
          <StatChip
            label="Total Edits"
            value={editCount}
            color={editCount > 0 ? 'text-slate-800' : 'text-slate-400'}
          />
          <StatChip
            label="AI Rewrites"
            value={aiRewriteCount}
            color={aiRewriteCount > 0 ? 'text-violet-600' : 'text-slate-400'}
          />
          {siteStatus.lastClientEdit && (
            <StatChip
              label="Last Edit"
              value={timeAgo(siteStatus.lastClientEdit)}
              color="text-slate-600"
            />
          )}
        </div>

        {/* Quick actions */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onGoToEdit}
            className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
          >
            <span className="text-2xl">✏️</span>
            <div>
              <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">Edit Content</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Text, images, colours</p>
            </div>
          </button>

          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
            >
              <span className="text-2xl">🌐</span>
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">View Live Site</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Opens in new tab</p>
              </div>
            </a>
          ) : (
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm opacity-50 cursor-not-allowed">
              <span className="text-2xl">🌐</span>
              <div>
                <p className="text-sm font-semibold text-slate-400">View Live Site</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Not yet live</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onGoToHistory}
            className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
          >
            <span className="text-2xl">🕐</span>
            <div>
              <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">Edit History</p>
              <p className="text-[11px] text-slate-500 mt-0.5">View & undo changes</p>
            </div>
          </button>
        </div>

        {/* Recent edits */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Recent Changes</h2>
            {editCount > 5 && (
              <button
                type="button"
                onClick={onGoToHistory}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                View all {editCount} →
              </button>
            )}
          </div>

          <div className="px-5 divide-y divide-slate-50">
            {recentEdits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-3xl mb-2">📝</span>
                <p className="text-sm text-slate-400">No edits yet.</p>
                <p className="text-xs text-slate-300 mt-1">
                  Changes you make will appear here.
                </p>
                <button
                  type="button"
                  onClick={onGoToEdit}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                >
                  ✏️ Start editing
                </button>
              </div>
            ) : (
              recentEdits.map((edit) => (
                <RecentEditRow key={edit.id} edit={edit} />
              ))
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Need help? Contact us at{' '}
          <a href="mailto:support@rankedceo.com" className="underline hover:text-slate-600">
            support@rankedceo.com
          </a>
        </p>
      </div>
    </div>
  )
}
