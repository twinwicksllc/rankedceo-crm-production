'use client'

// =============================================================================
// Deploy Site Button — triggers deploySite() server action
// =============================================================================

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deploySite } from '@/lib/waas/actions/admin'

interface Props {
  tenantId:     string
  businessName: string
}

export function DeploySiteButton({ tenantId, businessName }: Props) {
  const router              = useRouter()
  const [loading, setLoading]   = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)

  const handleConfirm = async () => {
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
              disabled={loading}
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
              onClick={() => setConfirm(false)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-white/50 hover:text-white text-xs transition-all"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 8l-6 6M2 8h12" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Deploy Site
    </button>
  )
}