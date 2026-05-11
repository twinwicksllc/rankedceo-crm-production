// =============================================================================
// app/admin/qa-scenarios/page.tsx
// QA Scenarios Manager — admin form UI to create/edit/delete test scenarios.
// Scenarios are stored in the `qa` schema and used by the QA agent.
// (Decision Q7: Admin UI, form-based, no code required)
// =============================================================================

import { listQaScenarios } from '@/lib/waas/actions/qa'
import { ScenarioList } from './scenario-list'
import { NewScenarioForm } from './new-scenario-form'

export const dynamic = 'force-dynamic'

export default async function QaScenariosPage() {
  const { data: scenarios, error } = await listQaScenarios()

  return (
    <div data-testid="qa-scenarios-page">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="qa-scenarios-heading">
            QA Scenarios
          </h1>
          <p className="text-white/40 mt-1 text-sm">
            Create and manage test scenarios for the QA agent. No code required.
          </p>
        </div>
        <a
          href="/admin/qa-reports"
          className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors"
        >
          📋 View Run History
        </a>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 text-sm text-red-300 mb-6">
          Failed to load scenarios: {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Scenario list */}
        <div className="xl:col-span-2">
          <ScenarioList scenarios={scenarios ?? []} />
        </div>

        {/* New scenario form */}
        <div>
          <NewScenarioForm />
        </div>
      </div>
    </div>
  )
}
