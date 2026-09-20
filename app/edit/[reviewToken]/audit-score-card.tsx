// =============================================================================
// app/edit/[reviewToken]/audit-score-card.tsx
// Initiative 9: Close the loop with a before/after audit score.
//
// Shows:
//   - Baseline (prospect / pre-WaaS) audit score vs Latest completed audit score
//   - Delta pill (+X pts) or status indicator
//   - Mini category breakdown (SEO, Mobile, Performance)
//   - Deep link to the Audit tab (?tab=audits)
// =============================================================================

import Link from "next/link";
import type { AuditScoreComparison } from "@/lib/waas/actions/client-edit/compute-audit-score-comparison";

interface AuditScoreComparisonCardProps {
  comparison: AuditScoreComparison;
  reviewToken: string;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-slate-100";
  if (score >= 80) return "bg-emerald-50 border border-emerald-200";
  if (score >= 50) return "bg-amber-50 border border-amber-200";
  return "bg-red-50 border border-red-200";
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AuditScoreComparisonCard({
  comparison,
  reviewToken,
}: AuditScoreComparisonCardProps) {
  const { baseline, latest, delta, hasReAudit } = comparison;

  return (
    <div
      className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      data-testid="audit-score-comparison-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-base" role="img" aria-label="chart">
            📈
          </span>
          <h2 className="text-sm font-semibold text-slate-700">
            SEO &amp; Performance Progress
          </h2>
        </div>
        <Link
          href={`/edit/${reviewToken}?tab=audits`}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
        >
          View audit history →
        </Link>
      </div>

      {/* Main score comparison row */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50/70 rounded-xl p-4 border border-slate-100">
          {/* Baseline Score */}
          <div className="flex items-center gap-3.5">
            <div
              className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${scoreBg(
                baseline.overallScore,
              )}`}
            >
              <span
                className={`text-xl font-black leading-none ${scoreColor(
                  baseline.overallScore,
                )}`}
              >
                {baseline.overallScore}
              </span>
              <span className="text-[9px] font-medium text-slate-400 mt-0.5">
                /100
              </span>
            </div>
            <div className="min-w-0">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                Initial Audit
              </span>
              <p className="text-xs font-medium text-slate-700 truncate mt-1">
                {baseline.targetUrl.replace(/^https?:\/\//, "")}
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDate(baseline.completedAt)}
              </p>
            </div>
          </div>

          {/* Arrow / Delta / Re-audit Score */}
          <div className="flex items-center gap-3.5 border-t sm:border-t-0 sm:border-l border-slate-200/70 pt-3 sm:pt-0 sm:pl-4">
            {hasReAudit && latest ? (
              <>
                <div
                  className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${scoreBg(
                    latest.overallScore,
                  )}`}
                >
                  <span
                    className={`text-xl font-black leading-none ${scoreColor(
                      latest.overallScore,
                    )}`}
                  >
                    {latest.overallScore}
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 mt-0.5">
                    /100
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                      Latest Score
                    </span>
                    {delta && delta.overall !== 0 && (
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          delta.overall > 0
                            ? "bg-emerald-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {delta.overall > 0 ? `+${delta.overall}` : delta.overall}{" "}
                        pts
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700 truncate mt-1">
                    {latest.targetUrl.replace(/^https?:\/\//, "")}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatDate(latest.completedAt)}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 text-slate-500 py-1">
                <div className="h-10 w-10 rounded-xl bg-slate-200/50 flex items-center justify-center text-slate-400">
                  <span>⏳</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Post-launch score pending
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    A re-audit will compare your improved site against this baseline.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
              SEO
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-xs font-bold text-slate-700">
                {baseline.seoScore ?? "–"}
              </span>
              {hasReAudit && latest?.seoScore != null && (
                <>
                  <span className="text-[10px] text-slate-400">→</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {latest.seoScore}
                  </span>
                </>
              )}
            </div>
            {hasReAudit && delta?.seo != null && delta.seo !== 0 && (
              <span
                className={`text-[9px] font-medium block mt-0.5 ${
                  delta.seo > 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {delta.seo > 0 ? `+${delta.seo}` : delta.seo} pts
              </span>
            )}
          </div>

          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
              Performance
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-xs font-bold text-slate-700">
                {baseline.performanceScore ?? "–"}
              </span>
              {hasReAudit && latest?.performanceScore != null && (
                <>
                  <span className="text-[10px] text-slate-400">→</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {latest.performanceScore}
                  </span>
                </>
              )}
            </div>
            {hasReAudit && delta?.performance != null && delta.performance !== 0 && (
              <span
                className={`text-[9px] font-medium block mt-0.5 ${
                  delta.performance > 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {delta.performance > 0 ? `+${delta.performance}` : delta.performance}{" "}
                pts
              </span>
            )}
          </div>

          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
              Mobile
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-xs font-bold text-slate-700">
                {baseline.mobileScore ?? "–"}
              </span>
              {hasReAudit && latest?.mobileScore != null && (
                <>
                  <span className="text-[10px] text-slate-400">→</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {latest.mobileScore}
                  </span>
                </>
              )}
            </div>
            {hasReAudit && delta?.mobile != null && delta.mobile !== 0 && (
              <span
                className={`text-[9px] font-medium block mt-0.5 ${
                  delta.mobile > 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {delta.mobile > 0 ? `+${delta.mobile}` : delta.mobile} pts
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
