'use client'

// New Scenario Form — admin UI to create a new QA scenario
// Stores YAML content + metadata in qa.qa_scenarios

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createQaScenario } from '@/lib/waas/actions/qa'

const STARTER_YAML = `id: my_scenario
name: My Custom Scenario
description: Describe what this scenario tests
modes:
  - smoke
requires_stripe: false
requires_email: false

steps:
  - id: step_01
    type: navigate
    persona: admin
    severity: error
    description: Admin navigates to dashboard
    url: /admin/dashboard
    intent: Admin should land on the dashboard

  - id: step_02
    type: assert_url
    persona: admin
    severity: error
    description: Confirm dashboard URL
    pattern: /admin
    intent: Verify admin dashboard URL
`

export function NewScenarioForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    scenario_id:     '',
    name:            '',
    description:     '',
    modes:           ['smoke'] as string[],
    requires_stripe: false,
    requires_email:  false,
    yaml_content:    STARTER_YAML,
  })

  function handleModeToggle(mode: string) {
    setForm(f => ({
      ...f,
      modes: f.modes.includes(mode)
        ? f.modes.filter(m => m !== mode)
        : [...f.modes, mode],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.scenario_id.trim() || !form.name.trim() || !form.yaml_content.trim()) {
      setError('Scenario ID, Name, and YAML content are required.')
      return
    }
    if (form.modes.length === 0) {
      setError('Select at least one mode.')
      return
    }

    // Count steps naively from YAML (lines starting with `  - id:`)
    const stepCount = (form.yaml_content.match(/^\s{2}- id:/gm) ?? []).length

    startTransition(async () => {
      const res = await createQaScenario({
        ...form,
        step_count: stepCount,
        admin_email: 'admin',
      })
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(`✅ Scenario "${res.data?.name}" created (${stepCount} steps)`)
        setForm({
          scenario_id: '', name: '', description: '',
          modes: ['smoke'], requires_stripe: false, requires_email: false,
          yaml_content: STARTER_YAML,
        })
        setTimeout(() => setSuccess(null), 4000)
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6" data-testid="new-scenario-form">
      <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-5">
        New Scenario
      </h2>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-300 mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-300 mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Scenario ID */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Scenario ID <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.scenario_id}
            onChange={e => setForm(f => ({ ...f, scenario_id: e.target.value }))}
            placeholder="e.g. custom_01"
            data-testid="new-scenario-id"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Name <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Custom Admin Flow"
            data-testid="new-scenario-name"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What does this scenario test?"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Modes */}
        <div>
          <label className="block text-xs text-white/50 mb-2">Modes <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            {(['smoke', 'full'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeToggle(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  form.modes.includes(m)
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requires_stripe}
              onChange={e => setForm(f => ({ ...f, requires_stripe: e.target.checked }))}
              className="rounded"
            />
            <span className="text-xs text-white/50">Requires Stripe</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requires_email}
              onChange={e => setForm(f => ({ ...f, requires_email: e.target.checked }))}
              className="rounded"
            />
            <span className="text-xs text-white/50">Requires Email</span>
          </label>
        </div>

        {/* YAML editor */}
        <div>
          <label className="block text-xs text-white/50 mb-1">
            YAML Content <span className="text-red-400">*</span>
            <span className="ml-2 text-white/20">(validated on save)</span>
          </label>
          <textarea
            value={form.yaml_content}
            onChange={e => setForm(f => ({ ...f, yaml_content: e.target.value }))}
            rows={14}
            spellCheck={false}
            data-testid="new-scenario-yaml"
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/70 font-mono placeholder-white/20 focus:outline-none focus:border-white/30 resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          data-testid="new-scenario-submit"
          className="w-full rounded-xl bg-white text-slate-900 font-semibold text-sm py-2.5 hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Scenario'}
        </button>
      </form>
    </div>
  )
}
