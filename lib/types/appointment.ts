// ============================================================
// Appointment & AI Agent Type Definitions
// ============================================================

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'
export type AppointmentType = 'call' | 'meeting' | 'video_call' | 'in_person' | 'other'
export type AppointmentSource = 'manual' | 'ai_agent' | 'hvac' | 'plumbing' | 'electrical' | 'smile' | 'crm'

export interface Appointment {
  id: string
  created_at: string
  updated_at: string
  account_id: string
  contact_id?: string | null
  company_id?: string | null
  deal_id?: string | null
  booked_by_user_id?: string | null

  // Invitee
  invitee_name: string
  invitee_email: string
  invitee_phone?: string | null

  // Details
  title: string
  description?: string | null
  status: AppointmentStatus
  appointment_type: AppointmentType

  // Timing
  start_time: string
  end_time: string
  timezone: string
  duration_minutes?: number | null

  // Location
  location?: string | null
  meeting_url?: string | null

  // Calendly
  calendly_event_uri?: string | null
  calendly_invitee_uri?: string | null
  calendly_event_type_uri?: string | null
  calendly_cancel_url?: string | null
  calendly_reschedule_url?: string | null

  // Source
  source: AppointmentSource
  source_lead_id?: string | null

  // AI context
  agent_conversation?: AgentMessage[]

  // Notifications
  confirmation_sent_at?: string | null
  reminder_sent_at?: string | null

  notes?: string | null
  metadata?: Record<string, any>
}

export interface AppointmentWithRelations extends Appointment {
  contact?: {
    id: string
    first_name: string
    last_name: string
    email?: string | null
    phone?: string | null
  } | null
  company?: {
    id: string
    name: string
  } | null
  deal?: {
    id: string
    title: string
  } | null
  booked_by_user?: {
    id: string
    name: string
    email: string
  } | null
}

export interface CreateAppointmentInput {
  account_id: string
  invitee_name: string
  invitee_email: string
  invitee_phone?: string
  title: string
  description?: string
  appointment_type?: AppointmentType
  start_time: string
  end_time: string
  timezone?: string
  duration_minutes?: number
  location?: string
  meeting_url?: string
  contact_id?: string
  company_id?: string
  deal_id?: string
  booked_by_user_id?: string
  calendly_event_uri?: string
  calendly_invitee_uri?: string
  calendly_event_type_uri?: string
  calendly_cancel_url?: string
  calendly_reschedule_url?: string
  source?: AppointmentSource
  source_lead_id?: string
  agent_conversation?: AgentMessage[]
  notes?: string
  metadata?: Record<string, any>
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus
  notes?: string
  contact_id?: string
  company_id?: string
  deal_id?: string
  metadata?: Record<string, any>
}

export interface AppointmentFilters {
  status?: AppointmentStatus
  source?: AppointmentSource
  contact_id?: string
  date_from?: string
  date_to?: string
  search?: string
}

// ============================================================
// Calendly Types
// ============================================================

export interface CalendlyConnection {
  id: string
  created_at: string
  updated_at: string
  account_id: string
  user_id: string
  access_token: string
  refresh_token?: string | null
  token_expires_at?: string | null
  calendly_user_uri: string
  calendly_user_name?: string | null
  calendly_user_email?: string | null
  calendly_organization_uri?: string | null
  is_active: boolean
}

export interface CalendlyEventType {
  uri: string
  name: string
  description?: string | null
  duration: number // minutes
  slug: string
  scheduling_url: string
  active: boolean
  kind: 'solo' | 'group'
  color?: string
}

export interface CalendlyAvailableSlot {
  start_time: string
  end_time: string
  status: 'available'
  invitees_remaining: number
}

export interface CalendlyBookingResult {
  event_uri: string
  invitee_uri: string
  cancel_url: string
  reschedule_url: string
  meeting_url?: string
  start_time: string
  end_time: string
  location?: string
}

// ============================================================
// AI Agent Types
// ============================================================

export type AgentMessageRole = 'user' | 'assistant' | 'system'

export interface AgentMessage {
  role: AgentMessageRole
  content: string
  timestamp?: string
  metadata?: Record<string, any>
}

export interface AgentConversation {
  id: string
  created_at: string
  updated_at: string
  account_id?: string | null
  session_id: string
  source: AppointmentSource
  lead_name?: string | null
  lead_email?: string | null
  lead_phone?: string | null
  messages: AgentMessage[]
  appointment_id?: string | null
  status: 'active' | 'booked' | 'abandoned' | 'completed'
}

export interface AgentContext {
  source: AppointmentSource
  accountId?: string
  sessionId: string
  leadInfo?: {
    name?: string
    email?: string
    phone?: string
    serviceType?: string
    notes?: string
  }
  availableEventTypes?: CalendlyEventType[]
}

export interface AgentChatRequest {
  message: string
  sessionId: string
  source: AppointmentSource
  accountId?: string
  leadInfo?: AgentContext['leadInfo']
}

export interface AgentChatResponse {
  message: string
  action?: 'show_booking' | 'booking_confirmed' | 'collect_info' | 'none'
  bookingData?: {
    eventTypeUri?: string
    eventTypeName?: string
    schedulingUrl?: string
  }
  appointment?: Appointment
}