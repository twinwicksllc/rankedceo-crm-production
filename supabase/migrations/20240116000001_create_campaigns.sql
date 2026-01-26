-- Campaigns & Email Module Database Schema
-- Migration for Phase 8: Campaigns & Email Module

-- Create email_templates table for reusable email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- Array of variable names for personalization
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_account_id ON email_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_at ON email_templates(created_at DESC);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('one-time', 'drip', 'automation', 'ab_test')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  
  -- Email content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  
  -- Template reference
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  
  -- Targeting
  target_contacts UUID[] DEFAULT ARRAY[]::UUID[], -- Specific contacts to target
  target_companies UUID[] DEFAULT ARRAY[]::UUID[], -- All contacts in these companies
  target_deals UUID[] DEFAULT ARRAY[]::UUID[], -- Contacts associated with these deals
  segments JSONB DEFAULT '[]'::jsonb, -- Complex targeting criteria
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- A/B Testing
  is_ab_test BOOLEAN DEFAULT FALSE,
  ab_test_variants JSONB DEFAULT '[]'::jsonb, -- Array of variant configurations
  ab_test_winner_variant INTEGER,
  ab_test_declared_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);

-- Create campaign_emails table for tracking individual emails sent
CREATE TABLE IF NOT EXISTS campaign_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Email details
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- A/B Testing
  variant INTEGER DEFAULT 0,
  
  -- SendGrid tracking
  sendgrid_message_id VARCHAR(255),
  
  -- Tracking metrics
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounced_reason TEXT,
  unsubscribed_at TIMESTAMPTZ,
  spam_reported_at TIMESTAMPTZ,
  
  -- Engagement metrics
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'spam_reported', 'failed')),
  
  -- Error tracking
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for campaign_emails
CREATE INDEX IF NOT EXISTS idx_campaign_emails_account_id ON campaign_emails(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON campaign_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_contact_id ON campaign_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_status ON campaign_emails(status);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_sent_at ON campaign_emails(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_opened_at ON campaign_emails(opened_at DESC);

-- Create campaign_sequences table for drip campaigns and automation
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Sequence step details
  step_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Email content for this step
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Template reference
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  
  -- Timing
  delay_value INTEGER NOT NULL DEFAULT 0, -- Number of units
  delay_unit VARCHAR(20) NOT NULL DEFAULT 'hours' CHECK (delay_unit IN ('minutes', 'hours', 'days', 'weeks')),
  delay_from VARCHAR(20) DEFAULT 'campaign_start' CHECK (delay_from IN ('campaign_start', 'previous_step', 'custom_date')),
  
  -- Trigger conditions
  trigger_condition JSONB DEFAULT '{}', -- Conditions for when to send this step
  trigger_event VARCHAR(50), -- Event that triggers this step (e.g., 'email_opened', 'link_clicked')
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for campaign_sequences
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_account_id ON campaign_sequences(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign_id ON campaign_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_step_number ON campaign_sequences(campaign_id, step_number);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_status ON campaign_sequences(status);

-- Create campaign_sequence_executions table for tracking sequence progress
CREATE TABLE IF NOT EXISTS campaign_sequence_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES campaign_sequences(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Email sent for this step
  campaign_email_id UUID REFERENCES campaign_emails(id) ON DELETE SET NULL,
  
  -- Timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  
  -- Error tracking
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for campaign_sequence_executions
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_account_id ON campaign_sequence_executions(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_sequence_id ON campaign_sequence_executions(sequence_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_campaign_id ON campaign_sequence_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_contact_id ON campaign_sequence_executions(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_status ON campaign_sequence_executions(status);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_scheduled_at ON campaign_sequence_executions(scheduled_at);

-- Create campaign_analytics table for aggregated statistics
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Aggregated metrics
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  total_spam_reports INTEGER DEFAULT 0,
  
  -- Calculated rates
  delivery_rate DECIMAL(5, 2),
  open_rate DECIMAL(5, 2),
  click_rate DECIMAL(5, 2),
  bounce_rate DECIMAL(5, 2),
  unsubscribe_rate DECIMAL(5, 2),
  
  -- Timestamp
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id)
);

-- Create indexes for campaign_analytics
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_account_id ON campaign_analytics(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id ON campaign_analytics(campaign_id);

-- Enable Row Level Security
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequence_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Users can view email_templates in their account"
  ON email_templates FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create email_templates in their account"
  ON email_templates FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update email_templates in their account"
  ON email_templates FOR UPDATE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete email_templates in their account"
  ON email_templates FOR DELETE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns in their account"
  ON campaigns FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create campaigns in their account"
  ON campaigns FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update campaigns in their account"
  ON campaigns FOR UPDATE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete campaigns in their account"
  ON campaigns FOR DELETE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- RLS Policies for campaign_emails
CREATE POLICY "Users can view campaign_emails in their account"
  ON campaign_emails FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create campaign_emails in their account"
  ON campaign_emails FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update campaign_emails in their account"
  ON campaign_emails FOR UPDATE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete campaign_emails in their account"
  ON campaign_emails FOR DELETE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- RLS Policies for campaign_sequences
CREATE POLICY "Users can view campaign_sequences in their account"
  ON campaign_sequences FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create campaign_sequences in their account"
  ON campaign_sequences FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update campaign_sequences in their account"
  ON campaign_sequences FOR UPDATE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete campaign_sequences in their account"
  ON campaign_sequences FOR DELETE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- RLS Policies for campaign_sequence_executions
CREATE POLICY "Users can view campaign_sequence_executions in their account"
  ON campaign_sequence_executions FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create campaign_sequence_executions in their account"
  ON campaign_sequence_executions FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update campaign_sequence_executions in their account"
  ON campaign_sequence_executions FOR UPDATE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete campaign_sequence_executions in their account"
  ON campaign_sequence_executions FOR DELETE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- RLS Policies for campaign_analytics
CREATE POLICY "Users can view campaign_analytics in their account"
  ON campaign_analytics FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create campaign_analytics in their account"
  ON campaign_analytics FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update campaign_analytics in their account"
  ON campaign_analytics FOR UPDATE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete campaign_analytics in their account"
  ON campaign_analytics FOR DELETE
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_sequences_updated_at BEFORE UPDATE ON campaign_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate campaign analytics
CREATE OR REPLACE FUNCTION calculate_campaign_analytics(campaign_id_param UUID)
RETURNS VOID AS $$
DECLARE
  account_id_val UUID;
  total_recipients_val INTEGER;
  total_sent_val INTEGER;
  total_delivered_val INTEGER;
  total_opened_val INTEGER;
  total_clicked_val INTEGER;
  total_bounced_val INTEGER;
  total_unsubscribed_val INTEGER;
  total_spam_reports_val INTEGER;
  delivery_rate_val DECIMAL(5, 2);
  open_rate_val DECIMAL(5, 2);
  click_rate_val DECIMAL(5, 2);
  bounce_rate_val DECIMAL(5, 2);
  unsubscribe_rate_val DECIMAL(5, 2);
BEGIN
  -- Get account_id
  SELECT account_id INTO account_id_val
  FROM campaigns
  WHERE id = campaign_id_param;
  
  -- Calculate metrics
  SELECT 
    COUNT(*) INTO total_recipients_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param;
  
  SELECT 
    COUNT(*) INTO total_sent_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param AND status = 'sent';
  
  SELECT 
    COUNT(*) INTO total_delivered_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param AND status IN ('delivered', 'opened', 'clicked');
  
  SELECT 
    COUNT(*) INTO total_opened_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param AND opened_at IS NOT NULL;
  
  SELECT 
    COUNT(*) INTO total_clicked_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param AND clicked_at IS NOT NULL;
  
  SELECT 
    COUNT(*) INTO total_bounced_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param AND status = 'bounced';
  
  SELECT 
    COUNT(*) INTO total_unsubscribed_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param AND unsubscribed_at IS NOT NULL;
  
  SELECT 
    COUNT(*) INTO total_spam_reports_val
  FROM campaign_emails
  WHERE campaign_id = campaign_id_param AND spam_reported_at IS NOT NULL;
  
  -- Calculate rates
  delivery_rate_val := CASE WHEN total_sent_val > 0 
    THEN (total_delivered_val::DECIMAL / total_sent_val::DECIMAL) * 100 
    ELSE 0 END;
  
  open_rate_val := CASE WHEN total_delivered_val > 0 
    THEN (total_opened_val::DECIMAL / total_delivered_val::DECIMAL) * 100 
    ELSE 0 END;
  
  click_rate_val := CASE WHEN total_opened_val > 0 
    THEN (total_clicked_val::DECIMAL / total_opened_val::DECIMAL) * 100 
    ELSE 0 END;
  
  bounce_rate_val := CASE WHEN total_sent_val > 0 
    THEN (total_bounced_val::DECIMAL / total_sent_val::DECIMAL) * 100 
    ELSE 0 END;
  
  unsubscribe_rate_val := CASE WHEN total_delivered_val > 0 
    THEN (total_unsubscribed_val::DECIMAL / total_delivered_val::DECIMAL) * 100 
    ELSE 0 END;
  
  -- Insert or update analytics
  INSERT INTO campaign_analytics (
    account_id,
    campaign_id,
    total_recipients,
    total_sent,
    total_delivered,
    total_opened,
    total_clicked,
    total_bounced,
    total_unsubscribed,
    total_spam_reports,
    delivery_rate,
    open_rate,
    click_rate,
    bounce_rate,
    unsubscribe_rate,
    calculated_at
  ) VALUES (
    account_id_val,
    campaign_id_param,
    total_recipients_val,
    total_sent_val,
    total_delivered_val,
    total_opened_val,
    total_clicked_val,
    total_bounced_val,
    total_unsubscribed_val,
    total_spam_reports_val,
    delivery_rate_val,
    open_rate_val,
    click_rate_val,
    bounce_rate_val,
    unsubscribe_rate_val,
    NOW()
  )
  ON CONFLICT (campaign_id) DO UPDATE SET
    account_id = EXCLUDED.account_id,
    total_recipients = EXCLUDED.total_recipients,
    total_sent = EXCLUDED.total_sent,
    total_delivered = EXCLUDED.total_delivered,
    total_opened = EXCLUDED.total_opened,
    total_clicked = EXCLUDED.total_clicked,
    total_bounced = EXCLUDED.total_bounced,
    total_unsubscribed = EXCLUDED.total_unsubscribed,
    total_spam_reports = EXCLUDED.total_spam_reports,
    delivery_rate = EXCLUDED.delivery_rate,
    open_rate = EXCLUDED.open_rate,
    click_rate = EXCLUDED.click_rate,
    bounce_rate = EXCLUDED.bounce_rate,
    unsubscribe_rate = EXCLUDED.unsubscribe_rate,
    calculated_at = EXCLUDED.calculated_at;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate analytics
CREATE OR REPLACE FUNCTION trigger_campaign_analytics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_campaign_analytics(NEW.campaign_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to campaign_emails for analytics
CREATE TRIGGER calculate_campaign_analytics_trigger
AFTER INSERT OR UPDATE ON campaign_emails
FOR EACH ROW
WHEN (NEW.status != OLD.status OR OLD.status IS NULL)
EXECUTE FUNCTION trigger_campaign_analytics();

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_campaigns_type_status ON campaigns(type, status);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_status ON campaign_emails(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign_step ON campaign_sequences(campaign_id, step_number);

-- Add comments for documentation
COMMENT ON TABLE email_templates IS 'Reusable email templates for campaigns';
COMMENT ON TABLE campaigns IS 'Email campaigns with support for one-time, drip, and automation campaigns';
COMMENT ON TABLE campaign_emails IS 'Individual emails sent as part of campaigns with tracking metrics';
COMMENT ON TABLE campaign_sequences IS 'Steps in drip campaigns and automation sequences';
COMMENT ON TABLE campaign_sequence_executions IS 'Tracking of sequence execution for each contact';
COMMENT ON TABLE campaign_analytics IS 'Aggregated analytics for campaigns';