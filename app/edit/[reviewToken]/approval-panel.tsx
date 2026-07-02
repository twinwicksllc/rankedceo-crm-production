"use client";

// =============================================================================
// app/edit/[reviewToken]/approval-panel.tsx
// Modal that handles the "Approve & Publish" and "Undo Approval" actions.
//
// Task 8: When the tenant has no active subscription (isPaid=false),
// renders a PaymentGate that lets the client choose a plan and subscribe
// via Stripe Checkout.  After successful payment Stripe redirects back to
// /edit/[token]?tab=edit&approve=1 which auto-opens the normal approval form.
// =============================================================================

import { useState, useTransition } from "react";
import {
  submitClientApproval,
  revokeClientApproval,
} from "@/lib/waas/actions/client-edit";
import { createCheckoutSession } from "@/lib/waas/actions/billing";
import { WAAS_PLAN_DISPLAY } from "@/lib/waas/billing-config";
import type { EditorSessionProps } from "./editor-shell";

// ---------------------------------------------------------------------------
// Payment gate — shown when isPaid=false and client attempts to approve
// ---------------------------------------------------------------------------

function PaymentGate({
  tenantId,
  reviewToken,
  onClose,
}: {
  tenantId: string;
  reviewToken: string;
  onClose: () => void;
}) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [tier, setTier] = useState<"standard" | "premium">("standard");
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const plans = (["standard", "premium"] as const).map((t) => ({
    tier: t,
    ...WAAS_PLAN_DISPLAY[t],
  }));

  function subscribe() {
    setError(null);
    start(async () => {
      const res = await createCheckoutSession({
        tenantId,
        packageTier: tier,
        interval,
        successUrl: `${window.location.origin}/edit/${reviewToken}?tab=edit&approve=1`,
        cancelUrl: `${window.location.origin}/edit/${reviewToken}?tab=edit`,
      });
      if (res.success && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setError(res.error ?? "Could not start checkout.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              🚀
            </span>
            <div className="text-base font-semibold text-slate-900">
              Subscribe to Publish
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Choose a plan to publish your website. You&apos;ll be taken to a
            secure checkout — then brought straight back here to confirm your
            approval.
          </p>
        </div>

        {/* Interval toggle */}
        <div className="flex justify-center pt-5 px-6">
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                interval === "month"
                  ? "bg-white shadow text-slate-800"
                  : "text-slate-500"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`px-4 py-1.5 rounded-full font-medium transition-all flex items-center gap-1 ${
                interval === "year"
                  ? "bg-white shadow text-slate-800"
                  : "text-slate-500"
              }`}
            >
              Annual
              <span className="text-[9px] font-bold text-emerald-600">
                –15%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-3 px-6 pt-4 pb-2">
          {plans.map((plan) => {
            const price =
              interval === "year" ? plan.yearlyPrice : plan.monthlyPrice;
            const priceSub = interval === "year" ? "/yr" : "/mo";
            const isSelected = tier === plan.tier;
            return (
              <button
                key={plan.tier}
                type="button"
                onClick={() => setTier(plan.tier)}
                className={`relative text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-400"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-2.5 left-3 text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
                <p className="text-sm font-semibold text-slate-800">
                  {plan.label}
                </p>
                <p className="mt-0.5">
                  <span className="text-xl font-extrabold text-slate-900">
                    ${price}
                  </span>
                  <span className="text-xs text-slate-400 ml-0.5">
                    {priceSub}
                  </span>
                </p>
                <ul className="mt-2 space-y-0.5">
                  {plan.features.slice(0, 3).map((f) => (
                    <li
                      key={f}
                      className="text-[10px] text-slate-500 flex items-center gap-1"
                    >
                      <span className="text-emerald-500" aria-hidden="true">
                        ✓
                      </span>{" "}
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mx-6 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={subscribe}
            className="rounded-md bg-blue-600 hover:bg-blue-700 px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Redirecting…" : "Subscribe & Publish →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ApprovalPanel
// ---------------------------------------------------------------------------

interface ApprovalPanelProps {
  session: EditorSessionProps;
  isPaid: boolean; // Task 8: false → show PaymentGate first
  onClose: () => void;
  onCompleted: (kind: "approved" | "revoked") => void;
}

export function ApprovalPanel({
  session,
  isPaid,
  onClose,
  onCompleted,
}: ApprovalPanelProps) {
  const mode: "approve" | "revoke" = session.approvalAt ? "revoke" : "approve";
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  // Task 8: gate approval behind payment when not yet subscribed
  if (mode === "approve" && !isPaid) {
    return (
      <PaymentGate
        tenantId={session.tenantId}
        reviewToken={session.reviewToken}
        onClose={onClose}
      />
    );
  }

  const submit = () => {
    setError(null);
    start(async () => {
      try {
        if (mode === "approve") {
          const r = await submitClientApproval({
            reviewToken: session.reviewToken,
            approvalNote: note.trim() || undefined,
          });
          if (!r.success) {
            setError(r.error ?? "Unable to submit approval.");
            return;
          }
          onCompleted("approved");
        } else {
          const r = await revokeClientApproval(session.reviewToken);
          if (!r.success) {
            setError(r.error ?? "Unable to revoke approval.");
            return;
          }
          onCompleted("revoked");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="text-base font-semibold text-slate-900">
            {mode === "approve" ? "Approve & Publish" : "Undo Approval?"}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "approve"
              ? "Once approved, our team will deploy your website to your domain. You'll have a 1-hour window to undo this if needed."
              : "You can keep editing. Once you're happy, approve again to publish."}
          </p>
        </div>

        <div className="p-6">
          {mode === "approve" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Anything else you&apos;d like us to know?{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Any final notes for our team…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="mt-1 text-right text-[11px] text-slate-400">
                {note.length} / 500
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={submit}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === "approve"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {isPending
              ? "Working…"
              : mode === "approve"
                ? "Yes, Approve & Publish"
                : "Yes, Undo Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
