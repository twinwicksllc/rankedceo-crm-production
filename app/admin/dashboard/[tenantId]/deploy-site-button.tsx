'use client'

// =============================================================================
// Deploy Site Button — triggers deploySite() server action
// =============================================================================

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deploySite, getDeployReadiness, type DeployReadinessReport } from '@/lib/waas/actions/admin'

interface Props {
  tenantId:     string
  businessName: string
}

export function DeploySiteButton({ tenantId, businessName }: Props) {
  const router              = useRouter()
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)
  const [readiness, setReadiness] = useState<DeployReadinessReport | null>(null)

  const openConfirm = async () => {
    setChecking(true)
    setError(null)
    const result = await getDeployReadiness(tenantId)
    if (!result.success || !result.data) {
      setError(result.error ?? 'Unable to run deploy checks')
      setChecking(false)
      return
    }
    setReadiness(result.data)
    setConfirm(true)
    setChecking(false)
  }

  const handleConfirm = async () => {
    if (!readiness?.ready) return
    setLoading(true)
    setError(null)
    const result = await deploySite(tenantId)
    if (!result.success) {
      setError(result.error ?? 'Deploy failed')
      setLoading(false)
      setConfirm(false)
      return
    }
    router.refresh()
    setLoading(false)
    setConfirm(false)
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
          <p className="text-emerald-300 text-xs font-medium mb-2">
            Deploy <strong>{businessName}</strong>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading || !readiness?.ready}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-all disabled:opacity-60 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Deploying…
                </>
              ) : '✓ Confirm Deploy'}
            </button>
            <button
              onClick={() => {
                setConfirm(false)
                setReadiness(null)
              }}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-white/50 hover:text-white text-xs transition-all"
            >
              Cancel
            </button>
          </div>
          {readiness && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-1.5">
              {readiness.checks.map((check) => (
                <p key={check.id} className={`text-[11px] ${
                  check.status === 'pass'
                    ? 'text-emerald-300'
                    : check.status === 'warn'
                      ? 'text-amber-300'
                      : 'text-red-300'
                }`}>
                  {check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL'} • {check.label}: {check.detail}
                </p>
              ))}
            </div>
          )}
          {readiness && !readiness.ready && (
            <p className="text-red-300 text-xs mt-2">Deploy is blocked until all FAIL checks are resolved.</p>
          )}
          {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={openConfirm}
      disabled={checking}
      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {checking ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          Checking Deploy Readiness...
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 8l-6 6M2 8h12" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Deploy Site
        </>
      )}
    </button>
  )
}