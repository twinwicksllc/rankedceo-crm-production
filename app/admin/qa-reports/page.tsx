// =============================================================================
// app/admin/qa-reports/page.tsx
// QA Agent — Run History Dashboard
// Lists all QA agent runs with status, steps, findings, and links to reports.
// Includes a purge button to clear all qa_agent_* records.
// =============================================================================

import Link from "next/link";
import { listQaRuns, purgeQaRuns } from "@/lib/waas/actions/qa";
import { PurgeButton } from "./purge-button";

export const dynamic = "force-dynamic";

const STATUS_CONFIG = {
  pass: {
    emoji: "✅",
    label: "Pass",
    class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  pass_with_findings: {
    emoji: "⚠️",
    label: "Pass w/ findings",
    class: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  error: {
    emoji: "❌",
    label: "Error",
    class: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  critical_halt: {
    emoji: "🚨",
    label: "Critical Halt",
    class: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
  },
  running: {
    emoji: "🔄",
    label: "Running",
    class: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
} as const;

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default async function QaReportsPage() {
  const { data: runs, error } = await listQaRuns(50);

  return (
    <div data-testid="qa-reports-page">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-white"
            data-testid="qa-reports-heading"
          >
            QA Agent — Run History
          </h1>
          <p className="text-white/40 mt-1 text-sm">
            Weekly full lifecycle runs + PR smoke tests. All records tagged{" "}
            <code className="text-white/30 bg-white/5 px-1.5 py-0.5 rounded text-xs">
              qa_agent_*
            </code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/qa-scenarios"
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors"
          >
            ⚙️ Manage Scenarios
          </Link>
          <PurgeButton />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 text-sm text-red-300 mb-6">
          Failed to load run history: {error}
        </div>
      )}

      {/* Run list */}
      {!runs || runs.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-10 text-center">
          <p className="text-4xl mb-4">🤖</p>
          <p className="text-white/60 text-sm">No QA runs recorded yet.</p>
          <p className="text-white/30 text-xs mt-2">
            Runs appear here after the weekly scheduled run or a manual trigger.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden"
          data-testid="qa-runs-table"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs">
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Scenario</th>
                <th className="px-5 py-3 text-left font-medium hidden md:table-cell">
                  Mode
                </th>
                <th className="px-5 py-3 text-left font-medium hidden lg:table-cell">
                  Steps
                </th>
                <th className="px-5 py-3 text-left font-medium hidden lg:table-cell">
                  Duration
                </th>
                <th className="px-5 py-3 text-left font-medium hidden xl:table-cell">
                  Run ID
                </th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-left font-medium">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {runs.map((run) => {
                const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.running;
                return (
                  <tr
                    key={run.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.class}`}
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                      {run.critical_step && (
                        <div className="text-[10px] text-fuchsia-400/70 mt-1">
                          halted at: {run.critical_step}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-white/80 font-medium">
                      {run.scenario}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className="text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                        {run.mode}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell text-white/50 text-xs">
                      {run.passed_steps}/{run.total_steps}
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell text-white/40 text-xs">
                      {formatDuration(run.started_at, run.completed_at)}
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell">
                      <code className="text-[10px] text-white/30">
                        {run.run_id.slice(0, 24)}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-white/40 text-xs">
                      {new Date(run.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/qa-reports/${run.run_id}`}
                        className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
