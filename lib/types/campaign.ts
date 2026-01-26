// Campaign Types for RankedCEO CRM

export interface EmailTemplate {
  id: string;
  account_id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateWithRelations extends EmailTemplate {
  created_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface CreateEmailTemplateInput {
  name: string;
  subject: string;
  body: string;
  variables?: string[];
}

export interface UpdateEmailTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  variables?: string[];
}

export type CampaignType = 'one-time' | 'drip' | 'automation' | 'ab_test';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Campaign {
  id: string;
  account_id: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  
  // Email content
  subject: string;
  body: string;
  from_email?: string;
  from_name?: string;
  
  // Template reference
  template_id?: string;
  
  // Targeting
  target_contacts: string[];
  target_companies: string[];
  target_deals: string[];
  segments: any[];
  
  // Scheduling
  scheduled_at?: string;
  sent_at?: string;
  
  // A/B Testing
  is_ab_test: boolean;
  ab_test_variants: any[];
  ab_test_winner_variant?: number;
  ab_test_declared_at?: string;
  
  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithRelations extends Campaign {
  template?: EmailTemplate;
  created_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  analytics?: CampaignAnalytics;
  sequence_count?: number;
  recipient_count?: number;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  subject: string;
  body: string;
  from_email?: string;
  from_name?: string;
  template_id?: string;
  target_contacts?: string[];
  target_companies?: string[];
  target_deals?: string[];
  segments?: any[];
  scheduled_at?: string;
  is_ab_test?: boolean;
  ab_test_variants?: any[];
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  type?: CampaignType;
  status?: CampaignStatus;
  subject?: string;
  body?: string;
  from_email?: string;
  from_name?: string;
  template_id?: string;
  target_contacts?: string[];
  target_companies?: string[];
  target_deals?: string[];
  segments?: any[];
  scheduled_at?: string;
  is_ab_test?: boolean;
  ab_test_variants?: any[];
  ab_test_winner_variant?: number;
}

export interface CampaignFilters {
  type?: CampaignType;
  status?: CampaignStatus;
  search?: string;
  from_date?: string;
  to_date?: string;
}

export type CampaignEmailStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'spam_reported' | 'failed';

export interface CampaignEmail {
  id: string;
  account_id: string;
  campaign_id: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  
  // Email details
  to_email: string;
  to_name?: string;
  subject: string;
  body: string;
  
  // A/B Testing
  variant: number;
  
  // SendGrid tracking
  sendgrid_message_id?: string;
  
  // Tracking metrics
  sent_at: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  bounced_reason?: string;
  unsubscribed_at?: string;
  spam_reported_at?: string;
  
  // Engagement metrics
  open_count: number;
  click_count: number;
  
  // Status
  status: CampaignEmailStatus;
  
  // Error tracking
  error_message?: string;
  
  created_at: string;
}

export interface CampaignEmailWithRelations extends CampaignEmail {
  campaign?: Campaign;
  contact?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  };
  company?: {
    id: string;
    name: string;
  };
  deal?: {
    id: string;
    name: string;
  };
}

export type CampaignSequenceStatus = 'active' | 'paused' | 'completed';

export interface CampaignSequence {
  id: string;
  account_id: string;
  campaign_id: string;
  
  // Sequence step details
  step_number: number;
  name: string;
  description?: string;
  
  // Email content for this step
  subject: string;
  body: string;
  
  // Template reference
  template_id?: string;
  
  // Timing
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days' | 'weeks';
  delay_from: 'campaign_start' | 'previous_step' | 'custom_date';
  
  // Trigger conditions
  trigger_condition: any;
  trigger_event?: string;
  
  // Status
  status: CampaignSequenceStatus;
  
  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignSequenceWithRelations extends CampaignSequence {
  template?: EmailTemplate;
  created_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface CreateCampaignSequenceInput {
  campaign_id: string;
  step_number: number;
  name: string;
  description?: string;
  subject: string;
  body: string;
  template_id?: string;
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days' | 'weeks';
  delay_from?: 'campaign_start' | 'previous_step' | 'custom_date';
  trigger_condition?: any;
  trigger_event?: string;
  status?: CampaignSequenceStatus;
}

export interface UpdateCampaignSequenceInput {
  step_number?: number;
  name?: string;
  description?: string;
  subject?: string;
  body?: string;
  template_id?: string;
  delay_value?: number;
  delay_unit?: 'minutes' | 'hours' | 'days' | 'weeks';
  delay_from?: 'campaign_start' | 'previous_step' | 'custom_date';
  trigger_condition?: any;
  trigger_event?: string;
  status?: CampaignSequenceStatus;
}

export type SequenceExecutionStatus = 'pending' | 'sent' | 'skipped' | 'failed';

export interface CampaignSequenceExecution {
  id: string;
  account_id: string;
  sequence_id: string;
  campaign_id: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  
  // Email sent for this step
  campaign_email_id?: string;
  
  // Timing
  scheduled_at: string;
  sent_at?: string;
  
  // Status
  status: SequenceExecutionStatus;
  
  // Error tracking
  error_message?: string;
  
  created_at: string;
}

export interface CampaignSequenceExecutionWithRelations extends CampaignSequenceExecution {
  sequence?: CampaignSequence;
  campaign?: Campaign;
  contact?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  };
  company?: {
    id: string;
    name: string;
  };
  deal?: {
    id: string;
    name: string;
  };
  campaign_email?: CampaignEmail;
}

export interface CampaignAnalytics {
  id: string;
  account_id: string;
  campaign_id: string;
  
  // Aggregated metrics
  total_recipients: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribed: number;
  total_spam_reports: number;
  
  // Calculated rates
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  unsubscribe_rate: number;
  
  // Timestamp
  calculated_at: string;
}

export interface CampaignAnalyticsWithRelations extends CampaignAnalytics {
  campaign?: Campaign;
}