'use client'

// Purge button — fires purgeQaRuns() server action and shows feedback

import { useState, useTransition } from 'react'
import { purgeQaRuns } from '@/lib/waas/actions/qa'

export function PurgeButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function handlePurge() {
    if (!confirm('Delete ALL qa_agent_* records from the QA schema? This cannot be undone.')) return
    startTransition(async () => {
      const res = await purgeQaRuns()
      if (res.error) {
        setResult(`Error: ${res.error}`)
      } else {
        setResult(`✅ Purged ${res.purged} record${res.purged !== 1 ? 's' : ''}`)
        setTimeout(() => setResult(null), 4000)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs text-white/60">{result}</span>
      )}
      <button
        onClick={handlePurge}
        disabled={isPending}
        data-testid="purge-qa-runs-btn"
        className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        {isPending ? '⏳ Purging…' : '🗑️ Purge QA Records'}
      </button>
    </div>
  )
}
