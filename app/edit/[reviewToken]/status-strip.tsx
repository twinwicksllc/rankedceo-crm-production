// =============================================================================
// app/edit/[reviewToken]/status-strip.tsx
//
// Client portal status strip + SLA timeline.
// Shows the 5 stages of the Audit → WaaS → Live journey as a horizontal
// progress stepper with completion dates and SLA estimates for pending steps.
//
// Stages:
//   1. Signed Up        — always complete
//   2. Site Built       — initialBuildCompletedAt not null
//   3. Sent for Review  — tenantStatus = 'pending_review' | 'active'
//   4. Approved         — approvalAt not null
//   5. Live             — tenantStatus = 'active' && approvalLocked
//
// Usage: <StatusStrip siteStatus={siteStatus} />
// (Server component safe — no client state)
// =============================================================================

import type { TenantPortalSiteStatus } from "@/lib/waas/actions/client-edit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepState = "complete" | "active" | "pending";

interface JourneyStep {
  key: string;
  label: string;
  state: StepState;
  date: string | null; // ISO timestamp if completed
  sla: string; // shown when pending
}

// ---------------------------------------------------------------------------
// Derive journey steps from siteStatus
// ---------------------------------------------------------------------------

function buildJourneySteps(s: TenantPortalSiteStatus): JourneyStep[] {
  const isReview =
    s.tenantStatus === "pending_review" || s.tenantStatus === "active";
  const isLive = s.tenantStatus === "active" && s.approvalLocked;

  return [
    {
      key: "signup",
      label: "Signed Up",
      state: "complete",
      date: s.tenantCreatedAt,
      sla: "",
    },
    {
      key: "built",
      label: "Site Built",
      state: s.initialBuildCompletedAt ? "complete" : "active",
      date: s.initialBuildCompletedAt,
      sla: "~2 min",
    },
    {
      key: "review",
      label: "Sent for Review",
      state: isReview
        ? "complete"
        : s.initialBuildCompletedAt
          ? "active"
          : "pending",
      date: null, // no dedicated column — infer from context
      sla: "Within 24 hrs",
    },
    {
      key: "approved",
      label: "Approved",
      state: s.approvalAt ? "complete" : isReview ? "active" : "pending",
      date: s.approvalAt,
      sla: "When you\u2019re ready",
    },
    {
      key: "live",
      label: "Live",
      state: isLive ? "complete" : s.approvalAt ? "active" : "pending",
      date: null, // no dedicated column; infer from approvalAt + offset
      sla: "~15 min",
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIcon({ state }: { state: StepState }) {
  if (state === "complete") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 shrink-0 shadow-sm">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 6l3 3 5-5"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 border-2 border-sky-500 shrink-0">
        <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 border-2 border-slate-200 shrink-0">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Connector line between steps
// ---------------------------------------------------------------------------

function Connector({ leftState }: { leftState: StepState }) {
  const filled = leftState === "complete";
  return (
    <div
      className={`hidden sm:block flex-1 h-0.5 mt-3.5 mx-1 rounded-full transition-colors ${
        filled ? "bg-emerald-400" : "bg-slate-200"
      }`}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface StatusStripProps {
  siteStatus: TenantPortalSiteStatus;
}

export function StatusStrip({ siteStatus }: StatusStripProps) {
  const steps = buildJourneySteps(siteStatus);
  const activeIndex = steps.findLastIndex((s) => s.state !== "pending");

  return (
    <div
      className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      role="list"
      aria-label="Website launch progress"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Your Launch Journey
        </h2>
        <span className="text-[11px] text-slate-400">
          Step {Math.min(activeIndex + 2, steps.length)} of {steps.length}
        </span>
      </div>

      {/* Steps row */}
      <div className="px-4 py-4">
        {/* Desktop: horizontal stepper */}
        <div className="hidden sm:flex items-start" role="presentation">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-start flex-1">
              {/* Step */}
              <div
                className="flex flex-col items-center gap-1.5 flex-1"
                role="listitem"
              >
                <StepIcon state={step.state} />
                <span
                  className={`text-[11px] font-medium text-center leading-tight ${
                    step.state === "complete"
                      ? "text-emerald-600"
                      : step.state === "active"
                        ? "text-sky-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-[10px] text-center leading-tight text-slate-400">
                  {step.state === "complete" && formatShortDate(step.date)
                    ? formatShortDate(step.date)
                    : step.state === "active"
                      ? "In progress"
                      : step.sla
                        ? `Est. ${step.sla}`
                        : null}
                </span>
              </div>
              {/* Connector (not after last step) */}
              {i < steps.length - 1 && <Connector leftState={step.state} />}
            </div>
          ))}
        </div>

        {/* Mobile: vertical list */}
        <ol className="sm:hidden space-y-3">
          {steps.map((step) => (
            <li key={step.key} className="flex items-center gap-3">
              <StepIcon state={step.state} />
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm font-medium ${
                    step.state === "complete"
                      ? "text-emerald-600"
                      : step.state === "active"
                        ? "text-sky-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                {step.state === "complete" && formatShortDate(step.date) && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatShortDate(step.date)}
                  </p>
                )}
                {step.state === "active" && (
                  <p className="text-[11px] text-sky-500 mt-0.5">In progress</p>
                )}
                {step.state === "pending" && step.sla && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Est. {step.sla}
                  </p>
                )}
              </div>
              {step.state === "complete" && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="shrink-0 text-emerald-500"
                  aria-hidden="true"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="6.5"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M4 7l2.5 2.5L10 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Bottom SLA note for active step */}
      {steps[activeIndex + 1] && steps[activeIndex + 1].sla && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-500">
            <span className="font-medium">
              Next step: {steps[activeIndex + 1]?.label}
            </span>
            {" — "}
            {steps[activeIndex + 1]?.key === "approved"
              ? "Ready when you are. Review your site and click Approve when happy."
              : `Estimated ${steps[activeIndex + 1]?.sla} after previous step completes.`}
          </p>
        </div>
      )}

      {/* All done */}
      {steps.every((s) => s.state === "complete") && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-emerald-50/50">
          <p className="text-[11px] text-emerald-700 font-medium">
            🎉 Your website is live — all launch steps complete!
          </p>
        </div>
      )}
    </div>
  );
}
