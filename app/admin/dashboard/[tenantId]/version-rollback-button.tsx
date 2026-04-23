'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rollbackTenantSiteVersion } from '@/lib/waas/actions/admin'

interface Props {
  tenantId: string
  versionId: string
}

export function VersionRollbackButton({ tenantId, versionId }: Props) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRollback = async () => {
    setIsPending(true)
    setError(null)

    const result = await rollbackTenantSiteVersion(tenantId, versionId)
    if (!result.success) {
      setError(result.error ?? 'Rollback failed')
      setIsPending(false)
      return
    }

    setIsPending(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRollback}
        disabled={isPending}
        className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Restoring…' : 'Restore'}
      </button>
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  )
}
