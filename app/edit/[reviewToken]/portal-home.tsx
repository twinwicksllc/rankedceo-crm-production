"use client";

// =============================================================================
// app/edit/[reviewToken]/portal-home.tsx
//
// Tenant portal home — the "Overview" tab on /edit/[reviewToken].
//
// Shows:
//   - Site status card (variant, approval state, live URL)
//   - AI enhancement status banner (in_progress / completed)
//   - Quick action buttons (Edit / View Site / History)
//   - Recent edits mini-feed (last 5, non-undo)
//   - AI rewrite usage count + total edit count
//   - Build-aware empty state when no edits exist
//
// Props are pre-loaded server-side in page.tsx to avoid an extra client fetch.
// The component itself is 'use client' only for the copy-URL interaction.
//
// Phase 6.1 — initial
// PR #96 (GitHub #97) — site-build lifecycle states + AI enhancement banner
// =============================================================================

import { useState } from "react";
import type {
  TenantPortalData,
  TenantPortalRecentEdit,
  TenantPortalSiteStatus,
} from "@/lib/waas/actions/client-edit";
import type { EditType } from "@/lib/waas/actions/client-edit";
import type { WaasPackageTier } from "@/lib/waas/types";
import {
  CompleteProfileCard,
  getMissingProfileFields,
} from "./complete-profile-card";
import { PlanCard } from "./plan-card";
import { StatusStrip } from "./status-strip";
import { WAAS_PLAN_DISPLAY } from "@/lib/waas/billing-config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDIT_TYPE_ICONS: Record<EditType, string> = {
  text_edit: "✏️",
  image_swap: "🖼️",
  color_change: "🎨",
  ai_rewrite: "✨",
  section_toggle: "👁️",
  font_change: "🔤",
  config_change: "⚙️",
};

function formatPath(path: string): string {
  return path
    .replace(/sections\[(\d+)\]\.content\./, "Section $1 › ")
    .replace(/brand_config\./, "Brand › ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s*\.\s*/g, " › ");
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatValue(val: string | null, editType: EditType): string {
  if (val === null) return "—";
  if (editType === "section_toggle")
    return val === "true" ? "Visible" : "Hidden";
  if (editType === "color_change")
    return val.startsWith("#") ? val.toUpperCase() : val;
  if (editType === "image_swap") {
    try {
      const u = new URL(val);
      return u.pathname.split("/").pop() ?? val;
    } catch {
      return val.slice(0, 40);
    }
  }
  return val.length > 55 ? val.slice(0, 55) + "…" : val;
}

function buildLiveUrl(status: TenantPortalSiteStatus): string | null {
  if (status.liveDomain) return `https://${status.liveDomain}`;
  if (status.liveSubdomain)
    return `https://${status.liveSubdomain}.rankedceo.com`;
  return null;
}

// ---------------------------------------------------------------------------
// Status config — determines label, color, dot + description for the status card
// Now also handles the site-build lifecycle from migration 022.
// ---------------------------------------------------------------------------

function statusConfig(status: TenantPortalSiteStatus): {
  label: string;
  color: string;
  dot: string;
  description: string;
  pulseDot: boolean;
} {
  // Terminal states first
  if (status.approvalLocked && status.tenantStatus === "active") {
    return {
      label: "Live",
      color: "text-emerald-400",
      dot: "bg-emerald-400",
      description: "Your site is live and visible to the world.",
      pulseDot: false,
    };
  }
  if (status.approvalAt && !status.approvalLocked) {
    return {
      label: "Approved — Deploying",
      color: "text-violet-400",
      dot: "bg-violet-400",
      description: "Approved! Our team is deploying your site now.",
      pulseDot: true,
    };
  }
  if (status.tenantStatus === "active") {
    return {
      label: "Active",
      color: "text-emerald-400",
      dot: "bg-emerald-400",
      description: "Your site is active.",
      pulseDot: false,
    };
  }
  if (status.tenantStatus === "pending_review") {
    return {
      label: "Pending Review",
      color: "text-amber-400",
      dot: "bg-amber-400",
      description:
        "Review your designs and click Approve & Publish when ready.",
      pulseDot: false,
    };
  }

  // ── Site-build lifecycle ─────────────────────────────────────────
  // Tier 1 completed + AI still enhancing in background
  if (
    status.initialBuildCompletedAt &&
    status.aiEnhancementStatus === "in_progress"
  ) {
    return {
      label: "Site Ready — AI Enhancing",
      color: "text-violet-500",
      dot: "bg-violet-400",
      description:
        "Your site is ready to edit. AI is polishing the copy in the background.",
      pulseDot: true,
    };
  }
  // Tier 1 completed (AI done, failed, or not configured)
  if (status.initialBuildCompletedAt) {
    return {
      label: "Site Ready",
      color: "text-sky-500",
      dot: "bg-sky-400",
      description: "Your site has been built and is ready to review and edit.",
      pulseDot: false,
    };
  }
  // Still building (Tier 1 not yet complete)
  return {
    label: "Building Your Site",
    color: "text-sky-400",
    dot: "bg-sky-400",
    description:
      "We're putting together your personalised website. This usually takes less than a minute.",
    pulseDot: true,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatChip({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-4 py-3 min-w-[80px] shadow-sm">
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-slate-400 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

function RecentEditRow({ edit }: { edit: TenantPortalRecentEdit }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="shrink-0 mt-0.5 text-[13px]">
        {EDIT_TYPE_ICONS[edit.editType]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-white/70 truncate">
          {formatPath(edit.fieldPath)}
        </p>
        {edit.newValue && (
          <p className="text-[10px] text-white/35 truncate mt-0.5">
            {formatValue(edit.newValue, edit.editType)}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-white/30 tabular-nums mt-0.5">
        {timeAgo(edit.createdAt)}
      </span>
    </div>
  );
}

// AI Enhancement status banner — shown inside the status card when relevant
function AIEnhancementBanner({
  status,
}: {
  status: "in_progress" | "completed" | "failed" | null;
}) {
  if (!status || status === "failed") return null;

  if (status === "in_progress") {
    return (
      <div className="flex items-center gap-2 mt-3 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2">
        <svg
          className="h-3.5 w-3.5 text-violet-500 shrink-0 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <p className="text-[11px] text-violet-700 font-medium">
          ✨ AI is refining your website copy — it will update automatically
          when done.
        </p>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="flex items-center gap-2 mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
        <span className="text-[11px]">✨</span>
        <p className="text-[11px] text-emerald-700 font-medium">
          AI-enhanced copy is live on your site.
        </p>
      </div>
    );
  }

  return null;
}

// Build-in-progress skeleton card shown when Tier 1 hasn't finished yet
function BuildingCard() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      {/* Animated pulse rows */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-sky-100">
          <svg
            className="h-6 w-6 text-sky-500 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Building your site…
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            We're generating your personalised website content. This usually
            takes less than a minute.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2 mt-1">
          <div className="h-2 bg-slate-200 rounded animate-pulse w-full" />
          <div className="h-2 bg-slate-200 rounded animate-pulse w-4/5 mx-auto" />
          <div className="h-2 bg-slate-200 rounded animate-pulse w-3/5 mx-auto" />
        </div>
        <p className="text-[10px] text-slate-300 mt-1">
          Refresh this page in a moment to see your site.
        </p>
      </div>
    </div>
  );
}

// First-time CTA shown when the build is done but no edits have been made
function SiteReadyCTA({
  templateSlug,
  aiStatus,
  onGoToEdit,
}: {
  templateSlug: string | null;
  aiStatus: "in_progress" | "completed" | "failed" | null;
  onGoToEdit: () => void;
}) {
  const templateDisplay = templateSlug
    ? templateSlug.charAt(0).toUpperCase() +
      templateSlug.slice(1).replace(/-/g, " ")
    : null;

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-sky-50 border border-sky-200 mb-4">
        <span className="text-2xl">🎉</span>
      </div>
      <p className="text-sm font-semibold text-slate-700">
        Your site is ready!
      </p>
      {templateDisplay && (
        <p className="text-xs text-slate-500 mt-1">
          Built with the{" "}
          <span className="font-medium text-slate-600">{templateDisplay}</span>{" "}
          template.
        </p>
      )}
      {aiStatus === "in_progress" && (
        <p className="text-[11px] text-violet-600 mt-1.5 flex items-center gap-1.5 justify-center">
          <svg
            className="h-3 w-3 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          AI is polishing your copy in the background
        </p>
      )}
      {aiStatus === "completed" && (
        <p className="text-[11px] text-emerald-600 mt-1.5">
          ✨ AI-enhanced copy applied
        </p>
      )}
      <p className="text-xs text-slate-400 mt-3 mb-5 max-w-xs">
        Start editing your content, or review your site as-is and approve when
        you're happy.
      </p>
      <button
        type="button"
        onClick={onGoToEdit}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
      >
        ✏️ Start editing
      </button>
    </div>
  );
}

// Deploy readiness checklist — Initiative 8 (docs/waas/AUDIT_TO_WEBSITE_FLOW_RECOMMENDATIONS.md).
// Same checks admin sees before deploying, surfaced here so the client can
// fix their own blockers (missing phone number, short meta description,
// etc.) without waiting on an admin round-trip.
function DeployReadinessCard({
  readiness,
}: {
  readiness: NonNullable<TenantPortalData["deployReadiness"]>;
}) {
  const passCount = readiness.checks.filter((c) => c.status === "pass").length;

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">
          Ready to Go Live?
        </h2>
        <span
          className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
            readiness.ready
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {readiness.ready
            ? "All checks passed"
            : `${passCount}/${readiness.checks.length} passed`}
        </span>
      </div>

      <div className="px-5 divide-y divide-slate-50">
        {readiness.checks.map((check) => (
          <div key={check.id} className="flex items-start gap-3 py-2.5">
            <span className="shrink-0 mt-0.5 text-sm">
              {check.status === "pass"
                ? "✅"
                : check.status === "warn"
                  ? "⚠️"
                  : "❌"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-700">
                {check.label}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {check.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {!readiness.ready && (
        <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100">
          <p className="text-[11px] text-amber-700">
            Fix the items above in the Edit tab, then let us know you&apos;re
            ready — no need to wait on an email back-and-forth.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PortalHomeProps {
  businessName: string;
  tenantId: string;
  reviewToken: string;
  data: TenantPortalData;
  onGoToEdit: () => void;
  onGoToHistory: () => void;
}

export function PortalHome({
  businessName,
  tenantId,
  reviewToken,
  data,
  onGoToEdit,
  onGoToHistory,
}: PortalHomeProps) {
  const [copied, setCopied] = useState(false);
  const {
    siteStatus,
    recentEdits,
    aiRewriteCount,
    editCount,
    billingStatus,
    deployReadiness,
  } = data;

  const sc = statusConfig(siteStatus);
  const liveUrl = buildLiveUrl(siteStatus);

  // Determine if the site build has completed (Tier 1 done)
  const buildDone = Boolean(siteStatus.initialBuildCompletedAt);
  // Still in initial build: Tier 1 not done yet
  const buildInProgress =
    !buildDone && siteStatus.tenantStatus === "onboarding";

  // Get missing optional profile fields for the complete-profile card
  const missingProfileFields = getMissingProfileFields(data.brandConfig ?? {});

  const handleCopyUrl = () => {
    if (!liveUrl) return;
    void navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Welcome header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back 👋</h1>
          <p className="text-sm text-slate-500 mt-1">
            Here&apos;s an overview of your{" "}
            <span className="font-medium text-slate-700">{businessName}</span>{" "}
            website.
          </p>
        </div>

        {/* ── Status strip / SLA timeline ── always shown */}
        <StatusStrip siteStatus={siteStatus} />

        {/* ── Building skeleton ── shown only while Tier 1 is still in progress */}
        {buildInProgress && (
          <div className="mb-5">
            <BuildingCard />
          </div>
        )}

        {/* ── Status card ── shown once build starts OR for non-onboarding states */}
        {!buildInProgress && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${sc.dot} ${sc.pulseDot ? "animate-pulse" : ""}`}
                />
                <span className={`text-sm font-semibold ${sc.color}`}>
                  {sc.label}
                </span>
                {siteStatus.variantLabel && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {siteStatus.variantLabel}
                  </span>
                )}
                {/* AI Enhanced badge */}
                {siteStatus.aiEnhancementStatus === "completed" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                    ✨ AI Enhanced
                  </span>
                )}
              </div>
              {liveUrl && (
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
                >
                  {copied ? "✓ Copied" : "📋 Copy URL"}
                </button>
              )}
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 mb-3">{sc.description}</p>

              {/* AI enhancement banner */}
              <AIEnhancementBanner status={siteStatus.aiEnhancementStatus} />

              {/* Live URL */}
              {liveUrl ? (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {liveUrl.replace("https://", "")}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className="opacity-60"
                  >
                    <path
                      d="M2 8L8 2M8 2H4M8 2v4"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                    />
                  </svg>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  URL will be confirmed after deployment
                </span>
              )}

              {/* Approval timestamp */}
              {siteStatus.approvalAt && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Approved {timeAgo(siteStatus.approvalAt)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Stats row ── only meaningful once build is done */}
        {buildDone && (
          <>
            {/* Complete your profile card — shown when optional fields are missing */}
            <CompleteProfileCard
              tenantId={tenantId}
              reviewToken={reviewToken}
              missingFields={missingProfileFields}
            />

            <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
              <StatChip
                label="Total Edits"
                value={editCount}
                color={editCount > 0 ? "text-slate-800" : "text-slate-400"}
              />
              <StatChip
                label="AI Rewrites"
                value={aiRewriteCount}
                color={
                  aiRewriteCount > 0 ? "text-violet-600" : "text-slate-400"
                }
              />
              {siteStatus.lastClientEdit && (
                <StatChip
                  label="Last Edit"
                  value={timeAgo(siteStatus.lastClientEdit)}
                  color="text-slate-600"
                />
              )}
            </div>
          </>
        )}

        {/* ── Quick actions ── disabled / greyed when build is in progress */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Edit Content — active as soon as buildDone; disabled while building */}
          {buildDone ? (
            <button
              type="button"
              onClick={onGoToEdit}
              className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
            >
              <span className="text-2xl">✏️</span>
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">
                  Edit Content
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Text, images, colours
                </p>
              </div>
            </button>
          ) : (
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm opacity-50 cursor-not-allowed">
              <span className="text-2xl">✏️</span>
              <div>
                <p className="text-sm font-semibold text-slate-400">
                  Edit Content
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Available once site is built
                </p>
              </div>
            </div>
          )}

          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
            >
              <span className="text-2xl">🌐</span>
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">
                  View Live Site
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Opens in new tab
                </p>
              </div>
            </a>
          ) : (
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm opacity-50 cursor-not-allowed">
              <span className="text-2xl">🌐</span>
              <div>
                <p className="text-sm font-semibold text-slate-400">
                  View Live Site
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Not yet live
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onGoToHistory}
            className={`flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all group ${
              buildDone
                ? "hover:border-slate-300 hover:shadow-md"
                : "opacity-50 cursor-not-allowed pointer-events-none"
            }`}
          >
            <span className="text-2xl">🕐</span>
            <div>
              <p
                className={`text-sm font-semibold mt-0 ${buildDone ? "text-slate-800 group-hover:text-slate-900" : "text-slate-400"}`}
              >
                Edit History
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                View &amp; undo changes
              </p>
            </div>
          </button>
        </div>

        {/* ── Deploy readiness checklist ── shown until the site is live */}
        {deployReadiness &&
          !(siteStatus.approvalLocked && siteStatus.tenantStatus === "active") && (
            <DeployReadinessCard readiness={deployReadiness} />
          )}

        {/* ── Recent edits / first-time state ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">
              Recent Changes
            </h2>
            {editCount > 5 && (
              <button
                type="button"
                onClick={onGoToHistory}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                View all {editCount} →
              </button>
            )}
          </div>

          <div className="px-5 divide-y divide-slate-50">
            {/* Still building — show building state */}
            {buildInProgress && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="text-3xl mb-2">⏳</span>
                <p className="text-sm text-slate-500 font-medium">
                  Building your website…
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Your recent changes will appear here once your site is ready.
                </p>
              </div>
            )}

            {/* Build done, no edits yet — show welcome CTA */}
            {buildDone && recentEdits.length === 0 && (
              <SiteReadyCTA
                templateSlug={siteStatus.templateSlugDisplay}
                aiStatus={siteStatus.aiEnhancementStatus}
                onGoToEdit={onGoToEdit}
              />
            )}

            {/* Has edits */}
            {buildDone &&
              recentEdits.length > 0 &&
              recentEdits.map((edit) => (
                <RecentEditRow key={edit.id} edit={edit} />
              ))}
          </div>
        </div>

        {/* Plan card — Phase 7.4 */}
        {billingStatus && (
          <div className="mt-5 mb-5">
            <PlanCard
              tenantId={tenantId}
              reviewToken={reviewToken}
              billingStatus={{
                packageTier: billingStatus.packageTier as WaasPackageTier,
                planInterval: billingStatus.planInterval,
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                hasActiveSubscription: billingStatus.hasActiveSubscription,
                planDisplay:
                  WAAS_PLAN_DISPLAY[
                    billingStatus.packageTier as WaasPackageTier
                  ],
              }}
            />
          </div>
        )}

        {/* Footer note */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Need help? Contact us at{" "}
          <a
            href="mailto:support@rankedceo.com"
            className="underline hover:text-slate-600"
          >
            support@rankedceo.com
          </a>
        </p>
      </div>
    </div>
  );
}
