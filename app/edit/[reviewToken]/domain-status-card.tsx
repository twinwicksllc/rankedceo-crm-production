"use client";

// =============================================================================
// app/edit/[reviewToken]/domain-status-card.tsx
//
// Tenant-facing card showing domain request status + a form to submit a new
// domain change request post-onboarding.
//
// Rendered inside portal-home.tsx (Phase 6.1) on the Overview tab.
//
// Phase 6.3
// =============================================================================

import { useState, useTransition } from "react";
import {
  submitDomainChangeRequest,
  getClientDomainRequests,
  type ClientDomainChangeRequest,
} from "@/lib/waas/actions/client-edit";

// ---------------------------------------------------------------------------
// Status display
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; description: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-500",
    description: "Your request has been received — we'll review it shortly.",
  },
  acknowledged: {
    label: "Acknowledged",
    color: "text-sky-500",
    description: "Our team has reviewed your request and is working on it.",
  },
  actioned: {
    label: "Actioned",
    color: "text-emerald-500",
    description: "Done! Check the site status card for your updated domain.",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-500",
    description: "We couldn't fulfil this domain request. See the note below.",
  },
};

function RequestStatusRow({ req }: { req: ClientDomainChangeRequest }) {
  const sc = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-mono font-semibold text-slate-800">
          {req.requestedDomain}
        </span>
        <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
      </div>
      <p className="text-[11px] text-slate-500">{sc.description}</p>
      {req.adminResponse && (
        <p className="mt-1.5 text-[11px] text-slate-600 italic border-l-2 border-slate-300 pl-2">
          {req.adminResponse}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DomainStatusCardProps {
  reviewToken: string;
  currentDomain: string | null; // live domain if set
  currentSubdomain: string | null; // subdomain if set
  initialRequests: ClientDomainChangeRequest[];
}

export function DomainStatusCard({
  reviewToken,
  currentDomain,
  currentSubdomain,
  initialRequests,
}: DomainStatusCardProps) {
  const [requests, setRequests] =
    useState<ClientDomainChangeRequest[]>(initialRequests);
  const [showForm, setShowForm] = useState(false);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await submitDomainChangeRequest({
        reviewToken,
        requestedDomain: domain,
        note: note || undefined,
      });

      if (result.success && result.data) {
        setSuccess("Request submitted! We'll be in touch shortly.");
        setDomain("");
        setNote("");
        setShowForm(false);

        // Refresh list
        const refreshed = await getClientDomainRequests(reviewToken);
        if (refreshed.success && refreshed.data) setRequests(refreshed.data);
      } else {
        setError(result.error ?? "Submission failed. Please try again.");
      }
    });
  };

  const hasPendingRequest = requests.some(
    (r) => r.status === "pending" || r.status === "acknowledged",
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Domain</h2>
        {!hasPendingRequest && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            + Request change
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Current domain */}
        {currentDomain ? (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-mono font-semibold text-slate-800">
              {currentDomain}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">
              Live
            </span>
          </div>
        ) : currentSubdomain ? (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span className="text-sm font-mono text-slate-600">
              {currentSubdomain}.rankedceo.com
            </span>
            <span className="text-[10px] text-sky-500 font-medium">
              Subdomain
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No domain configured yet.</p>
        )}

        {/* Timeline info */}
        {requests.length > 0 && (
          <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2.5">
            <p className="text-[11px] text-sky-700 leading-relaxed">
              <span className="font-semibold">Timeline:</span> Domain requests typically take 1–3 business days from submission to completion. We'll update you as we progress through each stage.
            </p>
          </div>
        )}

        {/* Existing requests */}
        {requests.map((req) => (
          <RequestStatusRow key={req.id} req={req} />
        ))}

        {/* Success message */}
        {success && (
          <p className="text-xs text-emerald-600 font-medium">✓ {success}</p>
        )}

        {/* Domain change request form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div>
              <label
                className="text-[11px] font-medium text-slate-500"
                htmlFor="domain-input"
              >
                Requested domain
              </label>
              <input
                id="domain-input"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. acmeplumbing.com"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label
                className="text-[11px] font-medium text-slate-500"
                htmlFor="note-input"
              >
                Note (optional)
              </label>
              <textarea
                id="note-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any preference or context…"
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending || !domain.trim()}
                className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                {isPending ? "Submitting…" : "Submit Request"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
