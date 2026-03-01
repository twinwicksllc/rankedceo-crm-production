import { z } from 'zod'

export const createAppointmentSchema = z.object({
  invitee_name: z.string().min(1, 'Name is required'),
  invitee_email: z.string().email('Valid email is required'),
  invitee_phone: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  appointment_type: z.enum(['call', 'meeting', 'video_call', 'in_person', 'other']).default('call'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  timezone: z.string().default('UTC'),
  duration_minutes: z.number().optional(),
  location: z.string().optional(),
  meeting_url: z.string().url().optional().or(z.literal('')),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  source: z.enum(['manual', 'ai_agent', 'hvac', 'plumbing', 'electrical', 'smile', 'crm']).default('manual'),
})

export const updateAppointmentSchema = z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show']).optional(),
  notes: z.string().optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
})

export const agentChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
  sessionId: z.string().min(1, 'Session ID is required'),
  source: z.enum(['crm', 'hvac', 'plumbing', 'electrical', 'smile']).default('crm'),
  accountId: z.string().uuid().optional(),
  leadInfo: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    serviceType: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
export type AgentChatInput = z.infer<typeof agentChatSchema>