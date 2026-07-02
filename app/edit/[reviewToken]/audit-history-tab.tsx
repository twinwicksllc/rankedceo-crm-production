"use client";

// =============================================================================
// app/edit/[reviewToken]/audit-history-tab.tsx
// Phase 8.4 — Tenant Portal: Audit History Tab
//
// Shows all past completed audits for the tenant with scores, grade badges,
// and links to full audit reports.
//
// Data is pre-loaded server-side in page.tsx and passed as props.
// =============================================================================

import Link from "next/link";
import type { TenantAuditHistoryItem } from "@/lib/waas/actions/client-edit";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuditHistoryTabProps {
  items: TenantAuditHistoryItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function scoreGrade(score: number | null): string {
  if (score === null) return "–";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ScorePill({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`text-lg font-extrabold leading-none ${scoreColor(score)}`}
      >
        {score !== null ? score : "–"}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="text-5xl mb-4">📊</div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        No audits yet
      </h3>
      <p className="text-sm text-slate-400 max-w-xs">
        Your SEO audit history will appear here once audits have been completed
        for your site.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit row card
// ---------------------------------------------------------------------------

function AuditRow({ item }: { item: TenantAuditHistoryItem }) {
  const overall = item.overallScore;
  const failed = item.status === "failed";

  // Truncate long URLs for display
  const displayUrl = item.targetUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .slice(0, 45);
  const urlTruncated =
    item.targetUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").length > 45;

  return (
    <div
      className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow ${
        failed ? "border-red-200 bg-red-50/30" : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Overall grade circle */}
        <div
          className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${scoreBg(overall)}`}
        >
          <span
            className={`text-lg font-extrabold leading-none ${scoreColor(overall)}`}
          >
            {failed ? "!" : scoreGrade(overall)}
          </span>
          {!failed && overall !== null && (
            <span className={`text-[9px] font-semibold ${scoreColor(overall)}`}>
              {overall}
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p
                className="text-sm font-semibold text-slate-800 truncate"
                title={item.targetUrl}
              >
                {displayUrl}
                {urlTruncated ? "…" : ""}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatDate(item.completedAt)}
                {item.auditType === "prospect" && (
                  <span className="ml-2 text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                    Prospect
                  </span>
                )}
              </p>
            </div>
            {!failed && (
              <Link
                href={item.reportUrl}
                className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                target="_blank"
              >
                View report →
              </Link>
            )}
          </div>

          {/* Score pills */}
          {!failed && (
            <div className="flex items-center gap-5">
              <ScorePill label="SEO" score={item.seoScore} />
              <ScorePill label="Perf" score={item.performanceScore} />
              <ScorePill label="Mobile" score={item.mobileScore} />
            </div>
          )}

          {failed && (
            <p className="text-xs text-red-500">
              Audit failed — please contact support if this persists.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AuditHistoryTab({ items }: AuditHistoryTabProps) {
  const completedItems = items.filter((i) => i.status === "completed");
  const failedItems = items.filter((i) => i.status === "failed");

  // Best overall score across all audits
  const bestScore = completedItems.reduce<number | null>((best, item) => {
    if (item.overallScore === null) return best;
    if (best === null) return item.overallScore;
    return item.overallScore > best ? item.overallScore : best;
  }, null);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Page title */}
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Audit History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            SEO audit scores for your website over time.
          </p>
        </div>

        {/* Summary strip — only shown when there are results */}
        {completedItems.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className={`text-2xl font-extrabold ${scoreColor(bestScore)}`}>
                {bestScore ?? "–"}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
                Best score
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-800">
                {completedItems.length}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
                Audits run
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p
                className={`text-2xl font-extrabold ${scoreColor(completedItems[0]?.overallScore ?? null)}`}
              >
                {completedItems[0]?.overallScore ?? "–"}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
                Latest score
              </p>
            </div>
          </div>
        )}

        {/* Audit list */}
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <AuditRow key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Note about failed audits */}
        {failedItems.length > 0 && completedItems.length > 0 && (
          <p className="text-xs text-center text-slate-400">
            {failedItems.length} audit{failedItems.length > 1 ? "s" : ""}{" "}
            failed.{" "}
            <a
              href="mailto:support@rankedceo.com"
              className="text-blue-500 hover:underline"
            >
              Contact support
            </a>{" "}
            if the issue persists.
          </p>
        )}
      </div>
    </div>
  );
}
