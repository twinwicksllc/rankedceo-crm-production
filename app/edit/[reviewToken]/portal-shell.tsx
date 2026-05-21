'use client'

// =============================================================================
// app/edit/[reviewToken]/portal-shell.tsx
//
// Outer wrapper for the client portal — renders the top tab nav
// (Overview / Edit / History / Billing) and switches between tab views.
//
// Tab state is URL-driven (?tab=overview | edit | history | billing).
// Navigating tabs does a shallow router.push so Next.js re-fetches
// the correct server content.
//
// Phase 6.1 — initial
// Phase 8.2 — added Billing tab
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { useRouter }      from 'next/navigation'
import type { ClientEditPermissions } from '@/lib/waas/client-edit/edit-session'
import type { TenantPortalData }      from '@/lib/waas/actions/client-edit'
import type { EditableField }         from '@/lib/waas/client-edit/editable-fields'
import type { TenantBillingStatus }   from '@/lib/waas/actions/billing'
import type { TenantAuditHistoryItem } from '@/lib/waas/actions/client-edit'
import { PortalHome }     from './portal-home'
import { EditorShell }    from './editor-shell'
import { BillingTab }     from './billing-tab'
import { AuditHistoryTab } from './audit-history-tab'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortalSession {
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

interface PortalShellProps {
  session:       PortalSession
  portalData:    TenantPortalData | null
  activeTab:     'overview' | 'edit' | 'history' | 'billing' | 'audits'
  billingStatus?: TenantBillingStatus | null
  checkoutSuccess?: boolean
  auditHistory?:  TenantAuditHistoryItem[]
  editorProps?: {
    initialFields: EditableField[]
  }
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'overview', label: '🏠 Overview' },
  { id: 'edit',     label: '✏️ Edit'     },
  { id: 'history',  label: '🕐 History'  },
  { id: 'audits',   label: '📊 Audits'   },
  { id: 'billing',  label: '💳 Billing'  },
] as const

type TabId = typeof TABS[number]['id']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortalShell({
  session,
  portalData,
  activeTab,
  billingStatus,
  checkoutSuccess,
  auditHistory,
  editorProps,
}: PortalShellProps) {
  const router = useRouter()

  // Track whether the history panel is open in editor mode
  const [historyOpenOnMount, setHistoryOpenOnMount] = useState(activeTab === 'history')

  // When server renders tab=history, open the history panel inside EditorShell
  useEffect(() => {
    if (activeTab === 'history') setHistoryOpenOnMount(true)
  }, [activeTab])

  const navigateTab = useCallback((tab: TabId) => {
    router.push(`/edit/${session.reviewToken}?tab=${tab}`)
  }, [router, session.reviewToken])

  return (
    <div className="flex h-dvh flex-col bg-white" data-testid="client-portal-root">

      {/* ------------------------------------------------------------------ */}
      {/* Top bar: business name + tab nav                                     */}
      {/* ------------------------------------------------------------------ */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        {/* Business name row + Logout */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-sm font-semibold text-slate-800 truncate">
              {session.businessName}
            </span>
          {session.approvalLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          {session.approvalAt && !session.approvalLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
              Deploying
            </span>
          )}
          {/* Build-in-progress badge — shown when tenant is onboarding and no approval yet */}
          {!session.approvalLocked && !session.approvalAt && portalData?.siteStatus && !portalData.siteStatus.initialBuildCompletedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              <svg className="h-2.5 w-2.5 text-sky-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Building
            </span>
          )}
          {/* AI Enhancing badge — Tier 1 done, Tier 2 in progress */}
          {!session.approvalLocked && !session.approvalAt && portalData?.siteStatus?.initialBuildCompletedAt && portalData.siteStatus.aiEnhancementStatus === 'in_progress' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-600">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              AI Enhancing
            </span>
          )}
          </div>
          {/* Logout button */}
          <a
            href="/api/auth/logout"
            data-testid="logout"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors whitespace-nowrap"
            title="Exit the portal"
          >
            Exit
          </a>
        </div>

        {/* Tab nav row */}
        <nav className="flex px-4" aria-label="Portal tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              data-testid={`portal-tab-${tab.id}`}
              className={`
                mr-1 flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1.5 text-xs font-medium transition-colors
                ${activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:border-slate-300 hover:text-slate-600'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Tab content */}
      <div className="flex min-h-0 flex-1">

        {/* Overview tab */}
        {activeTab === 'overview' && portalData && (
          <div data-testid="overview-tab-content" className="flex flex-1 min-h-0">
          <PortalHome
            businessName={session.businessName}
            tenantId={session.tenantId}
            reviewToken={session.reviewToken}
            data={portalData}
            onGoToEdit={() => navigateTab('edit')}
            onGoToHistory={() => navigateTab('history')}
          />
          </div>
        )}

        {/* Overview tab — no portal data (edge case) */}
        {activeTab === 'overview' && !portalData && (
          <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
            Unable to load portal data. &nbsp;
            <button
              type="button"
              onClick={() => router.refresh()}
              className="underline hover:text-slate-600"
            >
              Retry
            </button>
          </div>
        )}

        {/* Edit or History tab — EditorShell */}
        {(activeTab === 'edit' || activeTab === 'history') && editorProps && (
          <div data-testid="editor-tab-content" className="flex flex-1 min-h-0">
          <EditorShell
            session={session}
            initialFields={editorProps.initialFields}
            initialHistoryOpen={historyOpenOnMount}
          />
          </div>
        )}

        {/* Edge case: edit tab but no editorProps */}
        {(activeTab === 'edit' || activeTab === 'history') && !editorProps && (
          <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
            Loading editor…
          </div>
        )}

        {/* Billing tab */}
        {activeTab === 'billing' && (
          <div data-testid="billing-tab-content" className="flex flex-1 min-h-0">
          <BillingTab
            tenantId={session.tenantId}
            reviewToken={session.reviewToken}
            billingStatus={billingStatus ?? null}
            checkoutSuccess={checkoutSuccess}
          />
          </div>
        )}

        {/* Audits tab */}
        {activeTab === 'audits' && (
          <div data-testid="audits-tab-content" className="flex flex-1 min-h-0">
          <AuditHistoryTab items={auditHistory ?? []} />
          </div>
        )}
      </div>
    </div>
  )
}
