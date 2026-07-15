// =============================================================================
// app/admin/leads/page.tsx
//
// Admin page to view all captured leads.
// Highlights leads that requested site optimization.
// =============================================================================

import React from "react";
import Link from "next/link";
import { getAdminLeads } from "@/lib/waas/actions/admin";
import { LeadList } from "./lead-list";

export default async function AdminLeadsPage() {
  const result = await getAdminLeads();
  const leads = result.data ?? [];
  const error = result.success ? null : (result.error ?? "Failed to load leads.");

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospect Leads</h1>
          <p className="text-white/40 mt-1 text-sm">
            Review all audit tool submissions and optimization requests.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 transition-colors"
        >
          ← Back to Command Center
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <LeadList initialLeads={leads} />
    </div>
  );
}
