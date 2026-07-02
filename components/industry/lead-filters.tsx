"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type {
  IndustryType,
  LeadStatus,
  ServiceUrgency,
  LeadFilters,
} from "@/lib/types/industry-lead";
import { INDUSTRY_CONFIGS } from "@/lib/types/industry-lead";

interface LeadFiltersProps {
  industry: IndustryType;
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
}

const STATUS_OPTIONS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "lost", label: "Lost" },
];

const URGENCY_OPTIONS: { value: ServiceUrgency | "all"; label: string }[] = [
  { value: "all", label: "All Urgency" },
  { value: "emergency", label: "🚨 Emergency" },
  { value: "urgent", label: "⚡ Urgent" },
  { value: "scheduled", label: "📅 Scheduled" },
  { value: "estimate_only", label: "💬 Estimate Only" },
];

export function LeadFiltersBar({
  industry,
  filters,
  onChange,
}: LeadFiltersProps) {
  const config = INDUSTRY_CONFIGS[industry];
  const [searchValue, setSearchValue] = useState(filters.search ?? "");

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onChange({ ...filters, search: value || undefined });
  };

  const handleStatusChange = (value: string) => {
    onChange({ ...filters, status: value as LeadStatus | "all" });
  };

  const handleUrgencyChange = (value: string) => {
    onChange({ ...filters, urgency: value as ServiceUrgency | "all" });
  };

  const hasActiveFilters =
    (filters.status && filters.status !== "all") ||
    (filters.urgency && filters.urgency !== "all") ||
    !!filters.search;

  const clearFilters = () => {
    setSearchValue("");
    onChange({ industry });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name, email, phone, city..."
          className="pl-9 pr-4"
        />
        {searchValue && (
          <button
            onClick={() => handleSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status filter */}
      <select
        value={filters.status ?? "all"}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Urgency filter */}
      <select
        value={filters.urgency ?? "all"}
        onChange={(e) => handleUrgencyChange(e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
      >
        {URGENCY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
