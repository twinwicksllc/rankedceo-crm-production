"use client";

import React, { useState, useMemo } from "react";
import type { AdminLeadListItem } from "@/lib/waas/actions/admin";

interface LeadListProps {
  initialLeads: AdminLeadListItem[];
}

export function LeadList({ initialLeads }: LeadListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "optimization">("all");

  const filteredLeads = useMemo(() => {
    return initialLeads.filter((lead) => {
      const matchesSearch =
        !search ||
        lead.email.toLowerCase().includes(search.toLowerCase()) ||
        (lead.company?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (lead.name?.toLowerCase() || "").includes(search.toLowerCase());

      const matchesFilter = filter === "all" || lead.optimization_requested === true;

      return matchesSearch && matchesFilter;
    });
  }, [initialLeads, search, filter]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "all" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            }`}
          >
            All Leads
          </button>
          <button
            onClick={() => setFilter("optimization")}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "optimization" ? "bg-amber-500/20 text-amber-400" : "text-white/40 hover:text-white"
            }`}
          >
            Optimization Requests 🚀
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs font-semibold text-white/40 uppercase tracking-wider">
                <th className="px-6 py-4">Lead Info</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Target Site</th>
                <th className="px-6 py-4">Request Type</th>
                <th className="px-6 py-4">Captured</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/30 text-sm">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{lead.name || "Anonymous"}</div>
                      <div className="text-xs text-white/40">{lead.email}</div>
                      {lead.phone && <div className="text-[10px] text-white/30 mt-0.5">{lead.phone}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60">
                      {lead.company || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-blue-400 truncate max-w-[200px]" title={lead.target_url || ""}>
                        {lead.target_url ? lead.target_url.replace(/^https?:\/\//, "") : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lead.optimization_requested ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          OPTIMIZATION 🚀
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          NEW BUILD
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-white/30">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <a
                          href={`/audit/${lead.audit_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/60 hover:bg-white/10 transition-colors"
                        >
                          Report
                        </a>
                        <a
                          href={`/api/audit/${lead.audit_id}/pdf`}
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/60 hover:bg-white/10 transition-colors"
                        >
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
