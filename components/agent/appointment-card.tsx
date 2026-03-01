'use client'

import { Calendar, Clock, Phone, Mail, Video, MapPin, ExternalLink, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AppointmentWithRelations, AppointmentStatus } from '@/lib/types/appointment'
import { format, parseISO } from 'date-fns'

interface AppointmentCardProps {
  appointment: AppointmentWithRelations
  onCancel?: (id: string) => void
  onComplete?: (id: string) => void
  compact?: boolean
}

const STATUS_CONFIG: Record<AppointmentStatus, {
  label: string
  color: string
  icon: React.ReactNode
}> = {
  scheduled: {
    label: 'Scheduled',
    color: 'bg-blue-100 text-blue-700',
    icon: <Calendar className="w-3 h-3" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="w-3 h-3" />,
  },
  rescheduled: {
    label: 'Rescheduled',
    color: 'bg-yellow-100 text-yellow-700',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  no_show: {
    label: 'No Show',
    color: 'bg-gray-100 text-gray-700',
    icon: <AlertCircle className="w-3 h-3" />,
  },
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  ai_agent: 'AI Agent',
  hvac: 'HVAC Pro',
  plumbing: 'Plumb Pro',
  electrical: 'Spark Pro',
  smile: 'Smile',
  crm: 'CRM',
}

export function AppointmentCard({
  appointment,
  onCancel,
  onComplete,
  compact = false,
}: AppointmentCardProps) {
  const statusConfig = STATUS_CONFIG[appointment.status]
  const startTime = parseISO(appointment.start_time)
  const endTime = parseISO(appointment.end_time)

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-5 h-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{appointment.invitee_name}</p>
          <p className="text-xs text-gray-500">
            {format(startTime, 'MMM d, h:mm a')}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{appointment.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {SOURCE_LABELS[appointment.source] || appointment.source}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span>{format(startTime, 'EEEE, MMMM d, yyyy')}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span>
          {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
          {appointment.duration_minutes && (
            <span className="text-gray-400 ml-1">({appointment.duration_minutes} min)</span>
          )}
        </span>
      </div>

      {/* Invitee */}
      <div className="border-t border-gray-100 pt-4 mb-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Invitee</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span>{appointment.invitee_name}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{appointment.invitee_email}</span>
          </div>
          {appointment.invitee_phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>{appointment.invitee_phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Location / Meeting URL */}
      {(appointment.meeting_url || appointment.location) && (
        <div className="mb-4">
          {appointment.meeting_url ? (
            <a
              href={appointment.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              <Video className="w-4 h-4" />
              Join Meeting
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{appointment.location}</span>
            </div>
          )}
        </div>
      )}

      {/* CRM Links */}
      {(appointment.contact || appointment.company || appointment.deal) && (
        <div className="border-t border-gray-100 pt-4 mb-4 flex flex-wrap gap-2">
          {appointment.contact && (
            <Badge variant="secondary" className="text-xs">
              Contact: {appointment.contact.first_name} {appointment.contact.last_name}
            </Badge>
          )}
          {appointment.company && (
            <Badge variant="secondary" className="text-xs">
              Company: {appointment.company.name}
            </Badge>
          )}
          {appointment.deal && (
            <Badge variant="secondary" className="text-xs">
              Deal: {appointment.deal.title}
            </Badge>
          )}
        </div>
      )}

      {/* Calendly Links */}
      {appointment.status === 'scheduled' && (appointment.calendly_cancel_url || appointment.calendly_reschedule_url) && (
        <div className="border-t border-gray-100 pt-4 flex gap-3">
          {appointment.calendly_reschedule_url && (
            <a
              href={appointment.calendly_reschedule_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Reschedule
            </a>
          )}
          {appointment.calendly_cancel_url && (
            <a
              href={appointment.calendly_cancel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-red-500 hover:underline flex items-center gap-1"
            >
              <XCircle className="w-3 h-3" />
              Cancel via Calendly
            </a>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {appointment.status === 'scheduled' && (onCancel || onComplete) && (
        <div className="border-t border-gray-100 pt-4 flex gap-2">
          {onComplete && (
            <button
              onClick={() => onComplete(appointment.id)}
              className="flex-1 text-xs py-2 px-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors"
            >
              Mark Complete
            </button>
          )}
          {onCancel && (
            <button
              onClick={() => onCancel(appointment.id)}
              className="flex-1 text-xs py-2 px-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}