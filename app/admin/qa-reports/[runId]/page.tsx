// =============================================================================
// app/admin/qa-reports/[runId]/page.tsx
// Individual QA run report viewer — renders the stored HTML report inline.
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { getQaRunDetail } from "@/lib/waas/actions/qa";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ runId: string }>;
}

export default async function QaRunReportPage({ params }: Props) {
  const { runId } = await params;
  const { data: run, error } = await getQaRunDetail(runId);

  if (error || !run) notFound();

  return (
    <div>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/admin/qa-reports"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          ← Back to Run History
        </Link>
      </div>

      {run.report_html ? (
        // Render the full standalone HTML report in an iframe for isolation
        <div
          className="rounded-2xl overflow-hidden border border-white/10"
          style={{ height: "80vh" }}
        >
          <iframe
            srcDoc={run.report_html}
            className="w-full h-full"
            title={`QA Report — ${run.run_id}`}
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        // Fallback: show raw JSON summary if HTML not available
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <h2 className="text-white font-semibold mb-4">Run: {run.run_id}</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Status", run.status],
              ["Scenario", run.scenario],
              ["Mode", run.mode],
              ["Steps", `${run.passed_steps}/${run.total_steps}`],
              ["Started", run.started_at],
              ["Ended", run.completed_at],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-white/40 text-xs">{label}</dt>
                <dd className="text-white/80 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <p className="text-white/40 text-xs mb-2">
              Findings ({run.findings?.length ?? 0})
            </p>
            <pre className="text-xs text-white/50 bg-white/5 rounded-lg p-4 overflow-auto max-h-64">
              {JSON.stringify(run.findings, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
