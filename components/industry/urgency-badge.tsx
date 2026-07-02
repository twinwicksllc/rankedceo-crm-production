import { cn } from "@/lib/utils";
import type { ServiceUrgency } from "@/lib/types/industry-lead";

interface UrgencyBadgeProps {
  urgency: ServiceUrgency;
  className?: string;
}

const URGENCY_CONFIG: Record<
  ServiceUrgency,
  { label: string; classes: string; dot: string }
> = {
  emergency: {
    label: "🚨 Emergency",
    classes: "bg-red-100 text-red-800 border border-red-200",
    dot: "bg-red-500",
  },
  urgent: {
    label: "⚡ Urgent",
    classes: "bg-orange-100 text-orange-800 border border-orange-200",
    dot: "bg-orange-500",
  },
  scheduled: {
    label: "📅 Scheduled",
    classes: "bg-blue-100 text-blue-800 border border-blue-200",
    dot: "bg-blue-500",
  },
  estimate_only: {
    label: "💬 Estimate Only",
    classes: "bg-gray-100 text-gray-700 border border-gray-200",
    dot: "bg-gray-400",
  },
};

export function UrgencyBadge({ urgency, className }: UrgencyBadgeProps) {
  const config = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG.scheduled;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.classes,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
