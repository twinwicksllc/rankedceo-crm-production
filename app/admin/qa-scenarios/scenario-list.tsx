'use client'

// Scenario list with toggle active / delete actions

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateQaScenario, deleteQaScenario } from '@/lib/waas/actions/qa'
import type { QaScenario } from '@/lib/waas/actions/qa'

interface Props { scenarios: QaScenario[] }

export function ScenarioList({ scenarios }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(null), 3500)
  }

  function handleToggle(scenario: QaScenario) {
    startTransition(async () => {
      const res = await updateQaScenario(scenario.id, {
        is_active: !scenario.is_active,
        admin_email: 'admin',
      })
      if (res.error) flash(`Error: ${res.error}`)
      else { flash(`Scenario ${res.data?.is_active ? 'enabled' : 'disabled'}`); router.refresh() }
    })
  }

  function handleDelete(scenario: QaScenario) {
    if (!confirm(`Delete scenario "${scenario.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const res = await deleteQaScenario(scenario.id)
      if (res.error) flash(`Error: ${res.error}`)
      else { flash('Scenario deleted'); router.refresh() }
    })
  }

  if (scenarios.length === 0) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-10 text-center">
        <p className="text-3xl mb-3">📋</p>
        <p className="text-white/60 text-sm">No scenarios yet. Create one using the form →</p>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="scenario-list">
      {msg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
          {msg}
        </div>
      )}
      {scenarios.map((s) => (
        <div
          key={s.id}
          data-testid={`scenario-card-${s.scenario_id}`}
          className={`rounded-2xl border backdrop-blur-xl p-5 transition-opacity ${
            s.is_active
              ? 'bg-white/5 border-white/10'
              : 'bg-white/[0.02] border-white/5 opacity-60'
          }`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm">{s.name}</span>
                <code className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                  {s.scenario_id}
                </code>
                {!s.is_active && (
                  <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    disabled
                  </span>
                )}
              </div>
              {s.description && (
                <p className="text-white/40 text-xs mt-1">{s.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {s.modes.map(m => (
                  <span key={m} className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    {m}
                  </span>
                ))}
                {s.requires_stripe && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    stripe
                  </span>
                )}
                {s.requires_email && (
                  <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                    email
                  </span>
                )}
                <span className="text-[10px] text-white/30">{s.step_count} steps</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggle(s)}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                {s.is_active ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => handleDelete(s)}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>

          {/* YAML preview */}
          <details className="mt-3">
            <summary className="text-[11px] text-white/30 cursor-pointer hover:text-white/50">
              View YAML ▾
            </summary>
            <pre className="mt-2 text-[10px] text-white/40 bg-white/5 rounded-lg p-3 overflow-auto max-h-48 font-mono">
              {s.yaml_content}
            </pre>
          </details>
        </div>
      ))}
    </div>
  )
}
