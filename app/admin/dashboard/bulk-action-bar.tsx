"use client";

// =============================================================================
// app/admin/dashboard/bulk-action-bar.tsx
//
// Compact floating action bar shown when one or more tenants are selected
// in the TenantList.
//
// Phase 6.2
// =============================================================================

interface BulkActionBarProps {
  selectedCount: number;
  onActivate: () => void;
  onSuspend: () => void;
  onClear: () => void;
  isBusy: boolean;
}

export function BulkActionBar({
  selectedCount,
  onActivate,
  onSuspend,
  onClear,
  isBusy,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-slate-800 px-4 py-3 shadow-xl">
      <span className="text-sm font-medium text-white">
        {selectedCount} selected
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={onActivate}
          disabled={isBusy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          {isBusy ? "Updating…" : "✓ Set Active"}
        </button>
        <button
          type="button"
          onClick={onSuspend}
          disabled={isBusy}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
        >
          {isBusy ? "Updating…" : "⊘ Suspend"}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isBusy}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/5 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
