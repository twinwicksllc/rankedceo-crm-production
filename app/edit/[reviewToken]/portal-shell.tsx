'use client'

// =============================================================================
// app/edit/[reviewToken]/portal-shell.tsx
//
// Outer wrapper for the client portal — renders the top tab nav
// (Overview / Edit / History) and switches between PortalHome and
// EditorShell based on the active tab.
//
// Tab state is URL-driven (?tab=overview | edit | history).
// Navigating tabs does a shallow router.push so Next.js re-fetches
// the correct server content (overview loads portal data, edit/history
// loads editable fields).
//
// Phase 6.1
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { useRouter }      from 'next/navigation'
import type { ClientEditPermissions } from '@/lib/waas/client-edit/edit-session'
import type { TenantPortalData }      from '@/lib/waas/actions/client-edit'
import type { EditableField }         from '@/lib/waas/client-edit/editable-fields'
import { PortalHome }     from './portal-home'
import { EditorShell }    from './editor-shell'

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
  session:    PortalSession
  portalData: TenantPortalData | null
  activeTab:  'overview' | 'edit' | 'history'
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
] as const

type TabId = typeof TABS[number]['id']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortalShell({
  session,
  portalData,
  activeTab,
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
    <div className="flex h-dvh flex-col bg-white">

      {/* ------------------------------------------------------------------ */}
      {/* Top bar: business name + tab nav                                     */}
      {/* ------------------------------------------------------------------ */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        {/* Business name row */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
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
        </div>

        {/* Tab nav row */}
        <nav className="flex px-4" aria-label="Portal tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
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
      {/* Tab content                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-0 flex-1">

        {/* Overview tab */}
        {activeTab === 'overview' && portalData && (
          <PortalHome
            businessName={session.businessName}
            tenantId={session.tenantId}
            reviewToken={session.reviewToken}
            data={portalData}
            onGoToEdit={() => navigateTab('edit')}
            onGoToHistory={() => navigateTab('history')}
          />
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
          <EditorShell
            session={session}
            initialFields={editorProps.initialFields}
            initialHistoryOpen={historyOpenOnMount}
          />
        )}

        {/* Edge case: edit tab but no editorProps (should not happen) */}
        {(activeTab === 'edit' || activeTab === 'history') && !editorProps && (
          <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
            Loading editor…
          </div>
        )}
      </div>
    </div>
  )
}
