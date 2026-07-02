import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types/industry-lead";

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; classes: string }> = {
  new: {
    label: "New",
    classes: "bg-green-100 text-green-800 border border-green-200",
  },
  contacted: {
    label: "Contacted",
    classes: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  scheduled: {
    label: "Scheduled",
    classes: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  completed: {
    label: "Completed",
    classes: "bg-gray-100 text-gray-700 border border-gray-200",
  },
  lost: {
    label: "Lost",
    classes: "bg-red-50 text-red-600 border border-red-100",
  },
};

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.classes,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
