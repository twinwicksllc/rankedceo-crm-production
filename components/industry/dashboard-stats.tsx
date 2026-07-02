import { TrendingUp, AlertTriangle, DollarSign, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LeadStats, IndustryType } from "@/lib/types/industry-lead";
import { INDUSTRY_CONFIGS } from "@/lib/types/industry-lead";

interface DashboardStatsProps {
  stats: LeadStats;
  industry: IndustryType;
}

export function DashboardStats({ stats, industry }: DashboardStatsProps) {
  const config = INDUSTRY_CONFIGS[industry];

  const cards = [
    {
      label: "Total Leads",
      value: stats.total.toString(),
      sub: `${stats.new_count} new`,
      icon: <Users className={`h-5 w-5 text-${config.color.primary}`} />,
      bg: `bg-${config.color.light}`,
      border: `border-${config.color.border}`,
    },
    {
      label: "Needs Attention",
      value: (stats.emergency_count + stats.urgent_count).toString(),
      sub: `${stats.emergency_count} emergency · ${stats.urgent_count} urgent`,
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      bg: stats.emergency_count > 0 ? "bg-red-50" : "bg-orange-50",
      border:
        stats.emergency_count > 0 ? "border-red-200" : "border-orange-200",
    },
    {
      label: "Avg Job Value",
      value:
        stats.avg_estimated_value != null
          ? `$${Math.round(stats.avg_estimated_value).toLocaleString()}`
          : "—",
      sub: `$${stats.total_pipeline_value.toLocaleString()} pipeline`,
      icon: <DollarSign className="h-5 w-5 text-green-600" />,
      bg: "bg-green-50",
      border: "border-green-200",
    },
    {
      label: "Conversion Rate",
      value: `${stats.conversion_rate}%`,
      sub: `${stats.completed_count} completed · ${stats.lost_count} lost`,
      icon: <TrendingUp className="h-5 w-5 text-purple-600" />,
      bg: "bg-purple-50",
      border: "border-purple-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.border} ${card.bg}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {card.value}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{card.sub}</p>
              </div>
              <div className={`rounded-full p-2 ${card.bg}`}>{card.icon}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
