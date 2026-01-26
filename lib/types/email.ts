// Email Types for Smart BCC System

export interface EmailThread {
  id: string
  account_id: string
  subject: string
  participants: string[]
  message_count: number
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface EmailMessage {
  id: string
  account_id: string
  thread_id: string | null
  message_id: string
  in_reply_to: string | null
  references: string[] | null
  
  from_address: string
  from_name: string | null
  to_addresses: string[]
  cc_addresses: string[] | null
  bcc_addresses: string[] | null
  
  subject: string
  body_plain: string | null
  body_html: string | null
  
  direction: 'inbound' | 'outbound'
  status: 'received' | 'processed' | 'error'
  error_message: string | null
  
  opened: boolean
  opened_at: string | null
  clicks: number
  
  contact_id: string | null
  company_id: string | null
  deal_id: string | null
  
  headers: Record<string, any> | null
  received_at: string
  created_at: string
  updated_at: string
}

export interface EmailMessageWithThread extends EmailMessage {
  thread: EmailThread | null
  contact?: {
    id: string
    name: string
    email: string
  } | null
  company?: {
    id: string
    name: string
  } | null
  deal?: {
    id: string
    name: string
    value: number
  } | null
}

export interface EmailThreadWithMessages extends EmailThread {
  messages: EmailMessage[]
  latest_message: EmailMessage | null
}

export type EmailDirection = 'inbound' | 'outbound'
export type EmailStatus = 'received' | 'processed' | 'error'

// Input types for email operations
export interface CreateEmailMessageInput {
  message_id: string
  in_reply_to?: string | null
  references?: string[] | null
  from_address: string
  from_name?: string | null
  to_addresses: string[]
  cc_addresses?: string[] | null
  bcc_addresses?: string[] | null
  subject: string
  body_plain?: string | null
  body_html?: string | null
  direction?: EmailDirection
  headers?: Record<string, any>
  thread_id?: string | null
  contact_id?: string | null
  company_id?: string | null
  deal_id?: string | null
}

export interface UpdateEmailMessageInput {
  body_plain?: string | null
  body_html?: string | null
  contact_id?: string | null
  company_id?: string | null
  deal_id?: string | null
  opened?: boolean
}

export interface CreateEmailThreadInput {
  subject: string
  participants: string[]
}

export interface UpdateEmailThreadInput {
  subject?: string
}

// Email filters for list views
export interface EmailFilters {
  search?: string
  direction?: EmailDirection
  contact_id?: string
  company_id?: string
  deal_id?: string
  thread_id?: string
  status?: EmailStatus
  from_date?: string
  to_date?: string
}

// Email statistics
export interface EmailStats {
  total_messages: number
  total_threads: number
  inbound_count: number
  outbound_count: number
  unread_count: number
  today_count: number
  week_count: number
  month_count: number
}

// Email attachment (future feature)
export interface EmailAttachment {
  id: string
  email_id: string
  filename: string
  content_type: string
  size: number
  url: string
  created_at: string
}

// Parse result from incoming email
export interface ParsedEmail {
  from_address: string
  from_name: string | null
  to_addresses: string[]
  cc_addresses: string[] | null
  bcc_addresses: string[] | null
  subject: string
  body_plain: string | null
  body_html: string | null
  message_id: string
  in_reply_to: string | null
  references: string[] | null
  headers: Record<string, any>
  attachments?: Array<{
    filename: string
    content_type: string
    content: string
    size: number
  }>
}