import { ActivityType } from "@/lib/types/activity";
import { cn } from "@/lib/utils";

interface ActivityIconProps {
  type: ActivityType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const activityIcons: Record<ActivityType, { icon: string; color: string }> = {
  call: { icon: "📞", color: "bg-blue-100" },
  meeting: { icon: "📅", color: "bg-green-100" },
  email: { icon: "📧", color: "bg-purple-100" },
  note: { icon: "📝", color: "bg-yellow-100" },
  task: { icon: "✅", color: "bg-orange-100" },
};

const sizeClasses = {
  sm: "w-8 h-8 text-lg",
  md: "w-10 h-10 text-xl",
  lg: "w-12 h-12 text-2xl",
};

export function ActivityIcon({
  type,
  size = "md",
  className,
}: ActivityIconProps) {
  const config = activityIcons[type];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full",
        config.color,
        sizeClasses[size],
        className,
      )}
    >
      <span>{config.icon}</span>
    </div>
  );
}
