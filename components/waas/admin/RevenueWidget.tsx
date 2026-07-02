// =============================================================================
// components/waas/admin/RevenueWidget.tsx
// Phase 8.6 — Admin WaaS Revenue Dashboard Widget
//
// Server component — receives pre-fetched WaasRevenueStats as props.
// Shows MRR, ARR, active paid count, plan breakdown bar, and recent subs table.
// =============================================================================

import type { WaasRevenueStats } from "@/lib/waas/actions/admin";
import { WAAS_PLAN_DISPLAY } from "@/lib/waas/billing-config";
import type { WaasPackageTier } from "@/lib/waas/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RevenueWidgetProps {
  stats: WaasRevenueStats | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TIER_COLOURS: Partial<Record<WaasPackageTier, string>> = {
  hosting_only: "bg-teal-500",
  standard: "bg-blue-500",
  premium: "bg-indigo-600",
};

const INTERVAL_BADGE: Record<string, string> = {
  month: "bg-amber-50 text-amber-700 border border-amber-200",
  year: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  colour,
}: {
  label: string;
  value: string;
  sub?: string;
  colour: string;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-white/10 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </p>
      <p className={`text-3xl font-extrabold ${colour}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan breakdown bar
// ---------------------------------------------------------------------------

function PlanBreakdownBar({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  const PAID_TIERS: WaasPackageTier[] = ["hosting_only", "standard", "premium"];

  if (total === 0) {
    return (
      <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-slate-700 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {PAID_TIERS.map((tier) => {
          const count = breakdown[tier] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={tier}
              className={`h-full ${TIER_COLOURS[tier] ?? "bg-slate-600"}`}
              style={{ width: `${pct}%` }}
              title={`${WAAS_PLAN_DISPLAY[tier]?.label ?? tier}: ${count}`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {PAID_TIERS.map((tier) => {
          const count = breakdown[tier] ?? 0;
          if (count === 0) return null;
          return (
            <div
              key={tier}
              className="flex items-center gap-1.5 text-xs text-slate-400"
            >
              <span
                className={`h-2 w-2 rounded-full ${TIER_COLOURS[tier] ?? "bg-slate-600"}`}
              />
              {WAAS_PLAN_DISPLAY[tier]?.label ?? tier}:{" "}
              <span className="font-semibold text-slate-300">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------

export function RevenueWidget({ stats }: RevenueWidgetProps) {
  if (!stats) {
    return (
      <section className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-4">
          WaaS Revenue
        </h2>
        <p className="text-white/30 text-sm">Revenue data unavailable.</p>
      </section>
    );
  }

  const { mrr, arr, activePaidCount, planBreakdown, recentSubscriptions } =
    stats;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">
          WaaS Revenue
        </h2>
        <span className="text-xs text-slate-500">
          {activePaidCount} active paid subscription
          {activePaidCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="MRR"
          value={formatCurrency(mrr)}
          sub="Monthly recurring revenue"
          colour="text-emerald-400"
        />
        <StatCard
          label="ARR"
          value={formatCurrency(arr)}
          sub="Annual recurring revenue"
          colour="text-blue-400"
        />
        <StatCard
          label="Paid Subscribers"
          value={String(activePaidCount)}
          sub="Active subscriptions"
          colour="text-white"
        />
      </div>

      {/* Plan breakdown */}
      {activePaidCount > 0 && (
        <div className="bg-slate-900 rounded-xl border border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Plan distribution
          </p>
          <PlanBreakdownBar breakdown={planBreakdown} total={activePaidCount} />
        </div>
      )}

      {/* Recent subscriptions */}
      {recentSubscriptions.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Recent subscriptions
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {recentSubscriptions.map((sub) => {
              const tier = (sub.packageTier as WaasPackageTier) ?? "hosting";
              const interval = sub.planInterval;
              return (
                <div
                  key={sub.tenantId}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {sub.businessName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(sub.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        TIER_COLOURS[tier]
                          ? `${TIER_COLOURS[tier]} bg-opacity-20 text-white`
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {WAAS_PLAN_DISPLAY[tier]?.label ?? tier}
                    </span>
                    {interval && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${INTERVAL_BADGE[interval] ?? "bg-slate-700 text-slate-300"}`}
                      >
                        {interval === "year" ? "Annual" : "Monthly"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activePaidCount === 0 && (
        <div className="bg-slate-900 rounded-xl border border-white/10 p-8 text-center">
          <p className="text-3xl mb-2">💳</p>
          <p className="text-sm text-slate-400">
            No paid WaaS subscriptions yet.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Revenue will appear here as tenants subscribe.
          </p>
        </div>
      )}
    </section>
  );
}
