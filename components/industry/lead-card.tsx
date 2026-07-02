"use client";

import { useState } from "react";
import {
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UrgencyBadge } from "./urgency-badge";
import { LeadStatusBadge } from "./lead-status-badge";
import { updateIndustryLead } from "@/lib/actions/industry-lead";
import type {
  IndustryLead,
  LeadStatus,
  IndustryType,
} from "@/lib/types/industry-lead";
import { INDUSTRY_CONFIGS } from "@/lib/types/industry-lead";

interface LeadCardProps {
  lead: IndustryLead;
  industry: IndustryType;
  onStatusChange?: (leadId: string, newStatus: LeadStatus) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getServiceTypeLabel(serviceDetails: Record<string, unknown>): string {
  const type = serviceDetails?.service_type as string | undefined;
  if (!type) return "General Service";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeadCard({ lead, industry, onStatusChange }: LeadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const config = INDUSTRY_CONFIGS[industry];

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setUpdating(true);
    try {
      await updateIndustryLead(lead.id, { status: newStatus });
      onStatusChange?.(lead.id, newStatus);
    } catch (err) {
      console.error("[LeadCard] Status update failed");
    } finally {
      setUpdating(false);
    }
  };

  const contactIcon = {
    phone: <Phone className="h-3 w-3" />,
    email: <Mail className="h-3 w-3" />,
    text: <MessageSquare className="h-3 w-3" />,
  }[lead.preferred_contact_method] ?? <Phone className="h-3 w-3" />;

  const isEmergency = lead.urgency === "emergency";

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
        isEmergency ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">
              {lead.customer_name}
            </h3>
            <UrgencyBadge urgency={lead.urgency} />
            <LeadStatusBadge status={lead.status} />
          </div>

          <p className="mt-1 text-sm text-gray-500">
            {getServiceTypeLabel(lead.service_details)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.customer_phone}
            </span>
            {lead.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lead.city}
                {lead.state ? `, ${lead.state}` : ""}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(lead.submitted_at)}
            </span>
            <span
              className={`flex items-center gap-1 font-medium text-${config.color.text}`}
            >
              {contactIcon}
              Prefers {lead.preferred_contact_method}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          {/* Contact details */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Email
              </span>
              <p className="text-gray-700">{lead.customer_email}</p>
            </div>
            {lead.service_address && (
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Address
                </span>
                <p className="text-gray-700">
                  {lead.service_address}
                  {lead.city && `, ${lead.city}`}
                  {lead.state && `, ${lead.state}`}
                  {lead.zip_code && ` ${lead.zip_code}`}
                </p>
              </div>
            )}
            {lead.preferred_time && (
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Preferred Time
                </span>
                <p className="text-gray-700">{lead.preferred_time}</p>
              </div>
            )}
            {lead.estimated_value != null && (
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Est. Value
                </span>
                <p className="text-gray-700 font-semibold">
                  ${lead.estimated_value.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Service details */}
          {Object.keys(lead.service_details).length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Service Details
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                {(lead.service_details.symptoms as string[] | undefined)?.map(
                  (s) => (
                    <span
                      key={s}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {s.replace(/_/g, " ")}
                    </span>
                  ),
                )}
              </div>
              {typeof lead.service_details.problem_description === "string" &&
                lead.service_details.problem_description && (
                  <p className="mt-2 text-sm text-gray-600 italic">
                    &ldquo;{lead.service_details.problem_description}&rdquo;
                  </p>
                )}
            </div>
          )}

          {/* Notes */}
          {lead.notes && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Notes
              </span>
              <p className="mt-1 text-sm text-gray-600">{lead.notes}</p>
            </div>
          )}

          {/* Quick status actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {lead.status === "new" && (
              <Button
                size="sm"
                variant="outline"
                disabled={updating}
                onClick={() => handleStatusChange("contacted")}
                className="text-xs"
              >
                ✓ Mark Contacted
              </Button>
            )}
            {lead.status === "contacted" && (
              <Button
                size="sm"
                variant="outline"
                disabled={updating}
                onClick={() => handleStatusChange("scheduled")}
                className="text-xs"
              >
                📅 Mark Scheduled
              </Button>
            )}
            {(lead.status === "scheduled" || lead.status === "contacted") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updating}
                  onClick={() => handleStatusChange("completed")}
                  className="text-xs text-green-700 border-green-200 hover:bg-green-50"
                >
                  ✅ Mark Completed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updating}
                  onClick={() => handleStatusChange("lost")}
                  className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  ✗ Mark Lost
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
