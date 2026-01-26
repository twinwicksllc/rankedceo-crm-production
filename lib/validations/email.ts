import { z } from 'zod'

// Email message validation schemas
export const createEmailMessageSchema = z.object({
  message_id: z.string().min(1, 'Message ID is required'),
  in_reply_to: z.string().nullable().optional(),
  references: z.array(z.string()).nullable().optional(),
  from_address: z.string().email('Invalid from address'),
  from_name: z.string().nullable().optional(),
  to_addresses: z.array(z.string().email('Invalid to address')).min(1, 'At least one recipient required'),
  cc_addresses: z.array(z.string().email('Invalid CC address')).nullable().optional(),
  bcc_addresses: z.array(z.string().email('Invalid BCC address')).nullable().optional(),
  subject: z.string().min(1, 'Subject is required'),
  body_plain: z.string().nullable().optional(),
  body_html: z.string().nullable().optional(),
  direction: z.enum(['inbound', 'outbound']).default('inbound'),
  headers: z.record(z.any()).nullable().optional(),
  contact_id: z.string().uuid('Invalid contact ID').nullable().optional(),
  company_id: z.string().uuid('Invalid company ID').nullable().optional(),
  deal_id: z.string().uuid('Invalid deal ID').nullable().optional(),
})

export const updateEmailMessageSchema = z.object({
  body_plain: z.string().nullable().optional(),
  body_html: z.string().nullable().optional(),
  contact_id: z.string().uuid('Invalid contact ID').nullable().optional(),
  company_id: z.string().uuid('Invalid company ID').nullable().optional(),
  deal_id: z.string().uuid('Invalid deal ID').nullable().optional(),
  opened: z.boolean().optional(),
})

// Email thread validation schemas
export const createEmailThreadSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  participants: z.array(z.string().email('Invalid participant email')).min(1, 'At least one participant required'),
})

export const updateEmailThreadSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
})

// Email filters schema
export const emailFiltersSchema = z.object({
  search: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  thread_id: z.string().uuid().optional(),
  status: z.enum(['received', 'processed', 'error']).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
})

// Parsed email validation (from SendGrid webhook)
export const parsedEmailSchema = z.object({
  from_address: z.string().email(),
  from_name: z.string().nullable(),
  to_addresses: z.array(z.string().email()),
  cc_addresses: z.array(z.string().email()).nullable(),
  bcc_addresses: z.array(z.string().email()).nullable(),
  subject: z.string(),
  body_plain: z.string().nullable(),
  body_html: z.string().nullable(),
  message_id: z.string(),
  in_reply_to: z.string().nullable(),
  references: z.array(z.string()).nullable(),
  headers: z.record(z.any()),
  attachments: z.array(z.object({
    filename: z.string(),
    content_type: z.string(),
    content: z.string(),
    size: z.number(),
  })).optional(),
})

// Type exports
export type CreateEmailMessageInput = z.infer<typeof createEmailMessageSchema>
export type UpdateEmailMessageInput = z.infer<typeof updateEmailMessageSchema>
export type CreateEmailThreadInput = z.infer<typeof createEmailThreadSchema>
export type UpdateEmailThreadInput = z.infer<typeof updateEmailThreadSchema>
export type EmailFilters = z.infer<typeof emailFiltersSchema>
export type ParsedEmail = z.infer<typeof parsedEmailSchema>