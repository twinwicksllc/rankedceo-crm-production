-- ============================================================================
-- CONSOLIDATED MIGRATION FOR RANKEDCEO CRM - SAFE VERSION
-- ============================================================================
-- This migration only creates tables that don't already exist
-- Run this in Supabase SQL Editor after running 000007_correct_link_auth_users.sql
--
-- Tables that already exist and will be skipped:
-- - accounts, users, activities, campaigns, email_templates, forms, form_submissions
-- - companies, contacts, deals, pipelines, pipeline_stages
--
-- Tables that will be created:
-- - email_threads, email_messages (Phase 9 - Smart BCC)
-- - campaign_emails, campaign_sequences, campaign_sequence_executions, campaign_analytics (Phase 8)
-- - form_fields (Phase 10 - Form Builder)
-- - AI tables (Phase 11)
-- ============================================================================

-- ============================================================================
-- PHASE 9: EMAIL MESSAGES & THREADS (SMART BCC)
-- ============================================================================

-- Email Threads table - groups related emails into conversations
CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    participants TEXT[], -- Array of email addresses
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Messages table - stores individual email messages
CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    
    -- Email metadata
    message_id TEXT UNIQUE NOT NULL,
    in_reply_to TEXT,
    reference_headers TEXT[],
    
    -- Email addresses
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_addresses TEXT[] NOT NULL,
    cc_addresses TEXT[],
    bcc_addresses TEXT[],
    
    -- Email content
    subject TEXT NOT NULL,
    body_plain TEXT,
    body_html TEXT,
    
    -- Email status
    direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'inbound',
    status TEXT CHECK (status IN ('received', 'processed', 'error')) DEFAULT 'received',
    error_message TEXT,
    
    -- Email tracking
    opened BOOLEAN DEFAULT FALSE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicks INTEGER DEFAULT 0,
    
    -- Related entities
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    
    -- Metadata
    headers JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add BCC email address to accounts table (if not already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounts' AND column_name = 'bcc_email_address'
    ) THEN
        ALTER TABLE accounts ADD COLUMN bcc_email_address TEXT UNIQUE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_threads_account_id ON email_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_subject ON email_threads USING gin(to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from_address ON email_messages(from_address);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_contact_id ON email_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_company_id ON email_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_deal_id ON email_messages(deal_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_subject ON email_messages USING gin(to_tsvector('english', subject));

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to both tables
DROP TRIGGER IF EXISTS update_email_threads_updated_at ON email_threads;
CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_messages_updated_at ON email_messages;
CREATE TRIGGER update_email_messages_updated_at BEFORE UPDATE ON email_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update thread message count and timestamp
CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE email_threads 
        SET message_count = message_count + 1,
            last_message_at = NEW.received_at,
            updated_at = NOW()
        WHERE id = NEW.thread_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE email_threads 
        SET message_count = message_count - 1,
            updated_at = NOW()
        WHERE id = OLD.thread_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Apply thread stats trigger
DROP TRIGGER IF EXISTS trigger_update_thread_stats ON email_messages;
CREATE TRIGGER trigger_update_thread_stats
    AFTER INSERT OR DELETE ON email_messages
    FOR EACH ROW EXECUTE FUNCTION update_thread_stats();

-- Function to auto-associate email with contact based on from_address
CREATE OR REPLACE FUNCTION associate_email_with_contact()
RETURNS TRIGGER AS $$
BEGIN
    -- Try to find contact matching from_address
    SELECT id INTO NEW.contact_id
    FROM contacts
    WHERE account_id = NEW.account_id
    AND (email = NEW.from_address OR email = ANY(NEW.to_addresses))
    LIMIT 1;
    
    -- If contact found, try to get company
    IF NEW.contact_id IS NOT NULL THEN
        SELECT company_id INTO NEW.company_id
        FROM contacts
        WHERE id = NEW.contact_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply contact association trigger before insert
DROP TRIGGER IF EXISTS trigger_associate_email_with_contact ON email_messages;
CREATE TRIGGER trigger_associate_email_with_contact
    BEFORE INSERT ON email_messages
    FOR EACH ROW EXECUTE FUNCTION associate_email_with_contact();

-- Enable Row Level Security
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_threads
DROP POLICY IF EXISTS "Users can view their account's email threads" ON email_threads;
CREATE POLICY "Users can view their account's email threads"
    ON email_threads FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert email threads for their account" ON email_threads;
CREATE POLICY "Users can insert email threads for their account"
    ON email_threads FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update their account's email threads" ON email_threads;
CREATE POLICY "Users can update their account's email threads"
    ON email_threads FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete their account's email threads" ON email_threads;
CREATE POLICY "Users can delete their account's email threads"
    ON email_threads FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for email_messages
DROP POLICY IF EXISTS "Users can view their account's email messages" ON email_messages;
CREATE POLICY "Users can view their account's email messages"
    ON email_messages FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert email messages for their account" ON email_messages;
CREATE POLICY "Users can insert email messages for their account"
    ON email_messages FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update their account's email messages" ON email_messages;
CREATE POLICY "Users can update their account's email messages"
    ON email_messages FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete their account's email messages" ON email_messages;
CREATE POLICY "Users can delete their account's email messages"
    ON email_messages FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Add helpful comments
COMMENT ON TABLE email_threads IS 'Groups related emails into conversations';
COMMENT ON TABLE email_messages IS 'Stores individual email messages captured via BCC';


-- ============================================================================
-- PHASE 10: FORMS SYSTEM - FORM_FIELDS TABLE ONLY
-- ============================================================================

-- Form Fields table - Stores individual form fields
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    
    -- Field definition
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN (
        'text', 'email', 'phone', 'number', 'textarea', 
        'select', 'radio', 'checkbox', 'date', 'time',
        'file', 'url', 'hidden', 'rating', 'slider',
        'address', 'name'
    )),
    placeholder TEXT,
    default_value TEXT,
    
    -- Field options (for select, radio, checkbox)
    options JSONB,
    
    -- Validation rules
    required BOOLEAN DEFAULT FALSE,
    validation_rules JSONB,
    
    -- Display settings
    order_index INTEGER NOT NULL DEFAULT 0,
    width TEXT DEFAULT 'full' CHECK (width IN ('full', 'half', 'third')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields(form_id, order_index);

-- Enable Row Level Security
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for form_fields
DROP POLICY IF EXISTS "Users can view fields for their account's forms" ON form_fields;
CREATE POLICY "Users can view fields for their account's forms"
    ON form_fields FOR SELECT
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can insert fields for their account's forms" ON form_fields;
CREATE POLICY "Users can insert fields for their account's forms"
    ON form_fields FOR INSERT
    WITH CHECK (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can update fields for their account's forms" ON form_fields;
CREATE POLICY "Users can update fields for their account's forms"
    ON form_fields FOR UPDATE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can delete fields for their account's forms" ON form_fields;
CREATE POLICY "Users can delete fields for their account's forms"
    ON form_fields FOR DELETE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- Add helpful comments
COMMENT ON TABLE form_fields IS 'Stores individual fields for each form';


-- ============================================================================
-- PHASE 8: CAMPAIGNS SYSTEM - ADDITIONAL TABLES
-- ============================================================================

-- Campaign Emails table - tracks individual emails sent
CREATE TABLE IF NOT EXISTS campaign_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Recipient
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    
    -- Email details
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_plain TEXT,
    
    -- A/B Test variant
    variant TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed')),
    
    -- Tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    
    -- SendGrid tracking
    sendgrid_message_id TEXT,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Sequences table - for drip campaigns
CREATE TABLE IF NOT EXISTS campaign_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Sequence details
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    
    -- Email template
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_plain TEXT,
    
    -- Delay settings
    delay_value INTEGER NOT NULL DEFAULT 0,
    delay_unit TEXT NOT NULL DEFAULT 'days' CHECK (delay_unit IN ('minutes', 'hours', 'days', 'weeks')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Sequence Executions table - tracks sequence progress
CREATE TABLE IF NOT EXISTS campaign_sequence_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES campaign_sequences(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Execution status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Email tracking
    campaign_email_id UUID REFERENCES campaign_emails(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Analytics table - aggregated statistics
CREATE TABLE IF NOT EXISTS campaign_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Daily statistics
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,
    
    -- Calculated metrics
    open_rate DECIMAL(5,2),
    click_rate DECIMAL(5,2),
    bounce_rate DECIMAL(5,2),
    unsubscribe_rate DECIMAL(5,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(campaign_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON campaign_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_contact_id ON campaign_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_status ON campaign_emails(status);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_recipient_email ON campaign_emails(recipient_email);

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign_id ON campaign_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_order ON campaign_sequences(campaign_id, order_index);

CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_campaign_id ON campaign_sequence_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_contact_id ON campaign_sequence_executions(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_scheduled_at ON campaign_sequence_executions(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_date ON campaign_analytics(date DESC);

-- Enable Row Level Security
ALTER TABLE campaign_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequence_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_emails
DROP POLICY IF EXISTS "Users can view their account's campaign emails" ON campaign_emails;
CREATE POLICY "Users can view their account's campaign emails"
    ON campaign_emails FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert campaign emails for their account" ON campaign_emails;
CREATE POLICY "Users can insert campaign emails for their account"
    ON campaign_emails FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update their account's campaign emails" ON campaign_emails;
CREATE POLICY "Users can update their account's campaign emails"
    ON campaign_emails FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete their account's campaign emails" ON campaign_emails;
CREATE POLICY "Users can delete their account's campaign emails"
    ON campaign_emails FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for campaign_sequences
DROP POLICY IF EXISTS "Users can view sequences for their account's campaigns" ON campaign_sequences;
CREATE POLICY "Users can view sequences for their account's campaigns"
    ON campaign_sequences FOR SELECT
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can insert sequences for their account's campaigns" ON campaign_sequences;
CREATE POLICY "Users can insert sequences for their account's campaigns"
    ON campaign_sequences FOR INSERT
    WITH CHECK (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can update sequences for their account's campaigns" ON campaign_sequences;
CREATE POLICY "Users can update sequences for their account's campaigns"
    ON campaign_sequences FOR UPDATE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can delete sequences for their account's campaigns" ON campaign_sequences;
CREATE POLICY "Users can delete sequences for their account's campaigns"
    ON campaign_sequences FOR DELETE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- RLS Policies for campaign_sequence_executions
DROP POLICY IF EXISTS "Users can view executions for their account's campaigns" ON campaign_sequence_executions;
CREATE POLICY "Users can view executions for their account's campaigns"
    ON campaign_sequence_executions FOR SELECT
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can insert executions for their account's campaigns" ON campaign_sequence_executions;
CREATE POLICY "Users can insert executions for their account's campaigns"
    ON campaign_sequence_executions FOR INSERT
    WITH CHECK (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can update executions for their account's campaigns" ON campaign_sequence_executions;
CREATE POLICY "Users can update executions for their account's campaigns"
    ON campaign_sequence_executions FOR UPDATE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

DROP POLICY IF EXISTS "Users can delete executions for their account's campaigns" ON campaign_sequence_executions;
CREATE POLICY "Users can delete executions for their account's campaigns"
    ON campaign_sequence_executions FOR DELETE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- RLS Policies for campaign_analytics
DROP POLICY IF EXISTS "Users can view analytics for their account's campaigns" ON campaign_analytics;
CREATE POLICY "Users can view analytics for their account's campaigns"
    ON campaign_analytics FOR SELECT
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- Add helpful comments
COMMENT ON TABLE campaign_emails IS 'Individual emails sent as part of campaigns';
COMMENT ON TABLE campaign_sequences IS 'Drip campaign sequences with delays';
COMMENT ON TABLE campaign_sequence_executions IS 'Tracks execution of drip sequences';
COMMENT ON TABLE campaign_analytics IS 'Daily aggregated campaign statistics';


-- ============================================================================
-- PHASE 11: AI PREDICTIVE ANALYTICS - ADD FIELDS TO EXISTING TABLES
-- ============================================================================

-- Add AI fields to contacts table (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_conversion_score'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_conversion_score INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_conversion_probability'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_conversion_probability DECIMAL(5,4);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_confidence_score'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_confidence_score DECIMAL(5,4);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_lead_segment'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_lead_segment VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_contributing_factors'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_contributing_factors JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_recommended_actions'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_recommended_actions JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_score_updated_at'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_score_updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'ai_model_version'
    ) THEN
        ALTER TABLE contacts ADD COLUMN ai_model_version VARCHAR(50);
    END IF;
END $$;

-- Create indexes for contacts AI fields
CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON contacts(ai_conversion_score);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_segment ON contacts(ai_lead_segment);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_updated ON contacts(ai_score_updated_at);


-- Add AI fields to deals table (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'ai_win_probability'
    ) THEN
        ALTER TABLE deals ADD COLUMN ai_win_probability DECIMAL(5,4);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'ai_confidence_score'
    ) THEN
        ALTER TABLE deals ADD COLUMN ai_confidence_score DECIMAL(5,4);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'ai_risk_factors'
    ) THEN
        ALTER TABLE deals ADD COLUMN ai_risk_factors JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'ai_recommended_actions'
    ) THEN
        ALTER TABLE deals ADD COLUMN ai_recommended_actions JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'ai_predicted_close_date'
    ) THEN
        ALTER TABLE deals ADD COLUMN ai_predicted_close_date DATE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'ai_score_updated_at'
    ) THEN
        ALTER TABLE deals ADD COLUMN ai_score_updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'ai_model_version'
    ) THEN
        ALTER TABLE deals ADD COLUMN ai_model_version VARCHAR(50);
    END IF;
END $$;

-- Create indexes for deals AI fields
CREATE INDEX IF NOT EXISTS idx_deals_ai_probability ON deals(ai_win_probability);
CREATE INDEX IF NOT EXISTS idx_deals_ai_updated ON deals(ai_score_updated_at);


-- ============================================================================
-- PHASE 11: AI PREDICTIVE ANALYTICS - NEW TABLES
-- ============================================================================

-- AI scoring history table
CREATE TABLE IF NOT EXISTS ai_scoring_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Entity being scored
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('contact', 'deal')),
    entity_id UUID NOT NULL,
    
    -- Score details
    score_type VARCHAR(50) NOT NULL,
    score_value DECIMAL(5,4) NOT NULL,
    confidence_score DECIMAL(5,4),
    
    -- Model information
    model_version VARCHAR(50),
    model_name VARCHAR(100),
    
    -- Factors and recommendations
    contributing_factors JSONB DEFAULT '[]',
    recommended_actions JSONB DEFAULT '[]',
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_scoring_history_account_id ON ai_scoring_history(account_id);
CREATE INDEX IF NOT EXISTS idx_ai_scoring_history_entity ON ai_scoring_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_scoring_history_created_at ON ai_scoring_history(created_at DESC);


-- AI model performance tracking table
CREATE TABLE IF NOT EXISTS ai_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Model information
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    accuracy DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    
    -- Training information
    training_samples INTEGER,
    training_date TIMESTAMP WITH TIME ZONE,
    
    -- Validation metrics
    validation_samples INTEGER,
    validation_date TIMESTAMP WITH TIME ZONE,
    
    -- Additional metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_performance_account_id ON ai_model_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_model ON ai_model_performance(model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_type ON ai_model_performance(model_type);


-- AI insights table
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Insight details
    insight_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Insight data
    data JSONB,
    confidence_score DECIMAL(5,4),
    
    -- Related entities
    entity_type VARCHAR(20),
    entity_id UUID,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'acted_upon')),
    
    -- Action tracking
    action_taken TEXT,
    action_taken_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_account_id ON ai_insights(account_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_status ON ai_insights(status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON ai_insights(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);


-- Enable Row Level Security for AI tables
ALTER TABLE ai_scoring_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_scoring_history
DROP POLICY IF EXISTS "Users can view their account's AI scoring history" ON ai_scoring_history;
CREATE POLICY "Users can view their account's AI scoring history"
    ON ai_scoring_history FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert AI scoring history for their account" ON ai_scoring_history;
CREATE POLICY "Users can insert AI scoring history for their account"
    ON ai_scoring_history FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for ai_model_performance
DROP POLICY IF EXISTS "Users can view their account's AI model performance" ON ai_model_performance;
CREATE POLICY "Users can view their account's AI model performance"
    ON ai_model_performance FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert AI model performance for their account" ON ai_model_performance;
CREATE POLICY "Users can insert AI model performance for their account"
    ON ai_model_performance FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update their account's AI model performance" ON ai_model_performance;
CREATE POLICY "Users can update their account's AI model performance"
    ON ai_model_performance FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for ai_insights
DROP POLICY IF EXISTS "Users can view their account's AI insights" ON ai_insights;
CREATE POLICY "Users can view their account's AI insights"
    ON ai_insights FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert AI insights for their account" ON ai_insights;
CREATE POLICY "Users can insert AI insights for their account"
    ON ai_insights FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update their account's AI insights" ON ai_insights;
CREATE POLICY "Users can update their account's AI insights"
    ON ai_insights FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete their account's AI insights" ON ai_insights;
CREATE POLICY "Users can delete their account's AI insights"
    ON ai_insights FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));


-- ============================================================================
-- Add helpful comments
-- ============================================================================

COMMENT ON TABLE ai_scoring_history IS 'Historical record of all AI scoring events';
COMMENT ON TABLE ai_model_performance IS 'Tracks performance metrics of AI models';
COMMENT ON TABLE ai_insights IS 'AI-generated insights and recommendations';

COMMENT ON COLUMN contacts.ai_conversion_score IS 'AI-predicted conversion score (0-100)';
COMMENT ON COLUMN contacts.ai_conversion_probability IS 'Probability of conversion (0.0-1.0)';
COMMENT ON COLUMN contacts.ai_lead_segment IS 'AI-assigned lead segment (hot/warm/cold)';

COMMENT ON COLUMN deals.ai_win_probability IS 'AI-predicted probability of winning the deal (0.0-1.0)';
COMMENT ON COLUMN deals.ai_predicted_close_date IS 'AI-predicted close date';


-- ============================================================================
-- PERFORMANCE OPTIMIZATION: RLS POLICIES
-- ============================================================================

-- Optimize existing RLS policies by dropping and recreating them
-- This prevents auth.uid() from being called on every row

-- Contacts policies
DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;
CREATE POLICY "Users can view contacts in their account"
    ON contacts FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert contacts in their account" ON contacts;
CREATE POLICY "Users can insert contacts in their account"
    ON contacts FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update contacts in their account" ON contacts;
CREATE POLICY "Users can update contacts in their account"
    ON contacts FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete contacts in their account" ON contacts;
CREATE POLICY "Users can delete contacts in their account"
    ON contacts FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Companies policies
DROP POLICY IF EXISTS "Users can view companies in their account" ON companies;
CREATE POLICY "Users can view companies in their account"
    ON companies FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert companies in their account" ON companies;
CREATE POLICY "Users can insert companies in their account"
    ON companies FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update companies in their account" ON companies;
CREATE POLICY "Users can update companies in their account"
    ON companies FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete companies in their account" ON companies;
CREATE POLICY "Users can delete companies in their account"
    ON companies FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Deals policies
DROP POLICY IF EXISTS "Users can view deals in their account" ON deals;
CREATE POLICY "Users can view deals in their account"
    ON deals FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert deals in their account" ON deals;
CREATE POLICY "Users can insert deals in their account"
    ON deals FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update deals in their account" ON deals;
CREATE POLICY "Users can update deals in their account"
    ON deals FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete deals in their account" ON deals;
CREATE POLICY "Users can delete deals in their account"
    ON deals FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Pipelines policies
DROP POLICY IF EXISTS "Users can view pipelines in their account" ON pipelines;
CREATE POLICY "Users can view pipelines in their account"
    ON pipelines FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert pipelines in their account" ON pipelines;
CREATE POLICY "Users can insert pipelines in their account"
    ON pipelines FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update pipelines in their account" ON pipelines;
CREATE POLICY "Users can update pipelines in their account"
    ON pipelines FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete pipelines in their account" ON pipelines;
CREATE POLICY "Users can delete pipelines in their account"
    ON pipelines FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));


-- ============================================================================
-- END OF CONSOLIDATED MIGRATION - SAFE VERSION
-- ============================================================================