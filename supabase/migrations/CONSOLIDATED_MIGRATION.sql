-- ============================================================================
-- CONSOLIDATED MIGRATION FOR RANKEDCEO CRM
-- ============================================================================
-- This file consolidates all remaining migrations needed for the CRM system
-- Run this in Supabase SQL Editor after running 000007_correct_link_auth_users.sql
--
-- Includes:
-- - Phase 9: Email Messages & Threads (Smart BCC)
-- - Phase 10: Forms System (Form Builder)
-- - Phase 7: Activities System
-- - Phase 8: Campaigns System
-- - Phase 11: AI Predictive Analytics
-- - Performance Optimization: RLS Policies
--
-- Total: ~1,838 lines
-- ============================================================================

-- ============================================================================
-- PHASE 9: EMAIL MESSAGES & THREADS (SMART BCC)
-- ============================================================================

-- Email Messages and Threads for Smart BCC System

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Add BCC email address to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bcc_email_address TEXT UNIQUE;

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
CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
CREATE TRIGGER trigger_associate_email_with_contact
    BEFORE INSERT ON email_messages
    FOR EACH ROW EXECUTE FUNCTION associate_email_with_contact();

-- Enable Row Level Security
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_threads
CREATE POLICY "Users can view their account's email threads"
    ON email_threads FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert email threads for their account"
    ON email_threads FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's email threads"
    ON email_threads FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's email threads"
    ON email_threads FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for email_messages
CREATE POLICY "Users can view their account's email messages"
    ON email_messages FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert email messages for their account"
    ON email_messages FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's email messages"
    ON email_messages FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's email messages"
    ON email_messages FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Add helpful comments
COMMENT ON TABLE email_threads IS 'Groups related emails into conversations';
COMMENT ON TABLE email_messages IS 'Stores individual email messages captured via BCC';
COMMENT ON COLUMN accounts.bcc_email_address IS 'Unique BCC address for this account to capture emails';


-- ============================================================================
-- PHASE 10: FORMS SYSTEM
-- ============================================================================

-- Forms, Form Fields, and Form Submissions for Form Builder System

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Forms table - Stores form definitions and settings
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Basic form info
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    
    -- Public URL
    public_url TEXT UNIQUE,
    
    -- Form settings
    thank_you_message TEXT DEFAULT 'Thank you for your submission!',
    redirect_url TEXT,
    notification_emails TEXT[],
    
    -- Submission settings
    allow_multiple_submissions BOOLEAN DEFAULT TRUE,
    require_email BOOLEAN DEFAULT TRUE,
    
    -- Tracking
    submission_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Form Submissions table - Stores form submission data
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Submission data
    data JSONB NOT NULL,
    
    -- Contact association
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Submission metadata
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    
    -- Status
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'processed', 'spam')),
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_forms_account_id ON forms(account_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_public_url ON forms(public_url);

CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields(form_id, order_index);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_account_id ON form_submissions(account_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_contact_id ON form_submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at DESC);

-- Function to generate unique public URL
CREATE OR REPLACE FUNCTION generate_form_public_url()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from form name
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    final_slug := base_slug;
    
    -- Check for uniqueness and append counter if needed
    WHILE EXISTS (SELECT 1 FROM forms WHERE public_url = final_slug AND id != NEW.id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.public_url := final_slug;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply public URL generation trigger
CREATE TRIGGER trigger_generate_form_public_url
    BEFORE INSERT OR UPDATE OF name ON forms
    FOR EACH ROW 
    WHEN (NEW.public_url IS NULL OR OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION generate_form_public_url();

-- Function to update form submission count
CREATE OR REPLACE FUNCTION update_form_submission_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE forms 
        SET submission_count = submission_count + 1,
            updated_at = NOW()
        WHERE id = NEW.form_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE forms 
        SET submission_count = submission_count - 1,
            updated_at = NOW()
        WHERE id = OLD.form_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Apply submission count trigger
CREATE TRIGGER trigger_update_form_submission_count
    AFTER INSERT OR DELETE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION update_form_submission_count();

-- Function to auto-link submission to contact
CREATE OR REPLACE FUNCTION link_submission_to_contact()
RETURNS TRIGGER AS $$
DECLARE
    submission_email TEXT;
BEGIN
    -- Extract email from submission data
    submission_email := NEW.data->>'email';
    
    IF submission_email IS NOT NULL THEN
        -- Try to find existing contact
        SELECT id INTO NEW.contact_id
        FROM contacts
        WHERE account_id = NEW.account_id
        AND email = submission_email
        LIMIT 1;
        
        -- If no contact found, create one
        IF NEW.contact_id IS NULL THEN
            INSERT INTO contacts (
                account_id,
                email,
                first_name,
                last_name,
                source
            ) VALUES (
                NEW.account_id,
                submission_email,
                COALESCE(NEW.data->>'first_name', NEW.data->>'name', ''),
                COALESCE(NEW.data->>'last_name', ''),
                'form'
            )
            RETURNING id INTO NEW.contact_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply contact linking trigger
CREATE TRIGGER trigger_link_submission_to_contact
    BEFORE INSERT ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION link_submission_to_contact();

-- Enable Row Level Security
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forms
CREATE POLICY "Users can view their account's forms"
    ON forms FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert forms for their account"
    ON forms FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's forms"
    ON forms FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's forms"
    ON forms FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for form_fields
CREATE POLICY "Users can view fields for their account's forms"
    ON form_fields FOR SELECT
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can insert fields for their account's forms"
    ON form_fields FOR INSERT
    WITH CHECK (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can update fields for their account's forms"
    ON form_fields FOR UPDATE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can delete fields for their account's forms"
    ON form_fields FOR DELETE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- RLS Policies for form_submissions
CREATE POLICY "Users can view their account's form submissions"
    ON form_submissions FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Anyone can insert form submissions"
    ON form_submissions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their account's form submissions"
    ON form_submissions FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's form submissions"
    ON form_submissions FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Add helpful comments
COMMENT ON TABLE forms IS 'Stores form definitions and settings for the form builder';
COMMENT ON TABLE form_fields IS 'Stores individual fields for each form';
COMMENT ON TABLE form_submissions IS 'Stores form submission data and links to contacts';


-- ============================================================================
-- PHASE 7: ACTIVITIES SYSTEM
-- ============================================================================

-- Activities table for tracking interactions with contacts, companies, and deals

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Activity type and details
    type TEXT NOT NULL CHECK (type IN ('call', 'meeting', 'email', 'note', 'task')),
    title TEXT NOT NULL,
    description TEXT,
    
    -- Activity status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    
    -- Scheduling
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in minutes
    
    -- Location (for meetings)
    location TEXT,
    
    -- Participants
    attendees TEXT[],
    
    -- Related entities (at least one must be set)
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    
    -- Created by
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Additional metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: at least one entity must be linked
    CONSTRAINT activities_entity_check CHECK (
        contact_id IS NOT NULL OR 
        company_id IS NOT NULL OR 
        deal_id IS NOT NULL
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_activities_updated_at();

-- Enable Row Level Security
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view activities in their account"
    ON activities FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert activities in their account"
    ON activities FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update activities in their account"
    ON activities FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete activities in their account"
    ON activities FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Add helpful comment
COMMENT ON TABLE activities IS 'Tracks all interactions and tasks related to contacts, companies, and deals';


-- ============================================================================
-- PHASE 8: CAMPAIGNS SYSTEM
-- ============================================================================

-- Email Templates, Campaigns, Campaign Emails, and Campaign Sequences

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Email Templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Template details
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_plain TEXT,
    
    -- Template variables (e.g., {{first_name}}, {{company_name}})
    variables TEXT[],
    
    -- Template metadata
    category TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Campaign details
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('one-time', 'drip', 'automation', 'ab_test')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
    
    -- Email template
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    
    -- Targeting
    target_type TEXT CHECK (target_type IN ('contacts', 'companies', 'deals', 'custom')),
    target_filters JSONB,
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- A/B Testing
    ab_test_enabled BOOLEAN DEFAULT FALSE,
    ab_test_variants JSONB,
    
    -- Campaign settings
    send_from_name TEXT,
    send_from_email TEXT,
    reply_to_email TEXT,
    
    -- Statistics
    total_recipients INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
CREATE INDEX IF NOT EXISTS idx_email_templates_account_id ON email_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);

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

-- Function to update campaign statistics
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE campaigns 
        SET total_recipients = total_recipients + 1,
            updated_at = NOW()
        WHERE id = NEW.campaign_id;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        -- Update sent count
        IF OLD.status != 'sent' AND NEW.status = 'sent' THEN
            UPDATE campaigns 
            SET emails_sent = emails_sent + 1,
                updated_at = NOW()
            WHERE id = NEW.campaign_id;
        END IF;
        
        -- Update delivered count
        IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
            UPDATE campaigns 
            SET emails_delivered = emails_delivered + 1,
                updated_at = NOW()
            WHERE id = NEW.campaign_id;
        END IF;
        
        -- Update opened count
        IF OLD.status != 'opened' AND NEW.status = 'opened' THEN
            UPDATE campaigns 
            SET emails_opened = emails_opened + 1,
                updated_at = NOW()
            WHERE id = NEW.campaign_id;
        END IF;
        
        -- Update clicked count
        IF OLD.status != 'clicked' AND NEW.status = 'clicked' THEN
            UPDATE campaigns 
            SET emails_clicked = emails_clicked + 1,
                updated_at = NOW()
            WHERE id = NEW.campaign_id;
        END IF;
        
        -- Update bounced count
        IF OLD.status != 'bounced' AND NEW.status = 'bounced' THEN
            UPDATE campaigns 
            SET emails_bounced = emails_bounced + 1,
                updated_at = NOW()
            WHERE id = NEW.campaign_id;
        END IF;
        
        -- Update unsubscribed count
        IF OLD.status != 'unsubscribed' AND NEW.status = 'unsubscribed' THEN
            UPDATE campaigns 
            SET emails_unsubscribed = emails_unsubscribed + 1,
                updated_at = NOW()
            WHERE id = NEW.campaign_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply campaign stats trigger
CREATE TRIGGER trigger_update_campaign_stats
    AFTER INSERT OR UPDATE ON campaign_emails
    FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

-- Function to calculate daily analytics
CREATE OR REPLACE FUNCTION calculate_campaign_analytics()
RETURNS TRIGGER AS $$
DECLARE
    analytics_date DATE;
BEGIN
    analytics_date := CURRENT_DATE;
    
    -- Insert or update analytics for today
    INSERT INTO campaign_analytics (
        campaign_id,
        date,
        emails_sent,
        emails_delivered,
        emails_opened,
        emails_clicked,
        emails_bounced,
        emails_unsubscribed
    )
    SELECT 
        campaign_id,
        analytics_date,
        COUNT(*) FILTER (WHERE status = 'sent'),
        COUNT(*) FILTER (WHERE status = 'delivered'),
        COUNT(*) FILTER (WHERE status = 'opened'),
        COUNT(*) FILTER (WHERE status = 'clicked'),
        COUNT(*) FILTER (WHERE status = 'bounced'),
        COUNT(*) FILTER (WHERE status = 'unsubscribed')
    FROM campaign_emails
    WHERE campaign_id = NEW.campaign_id
    AND DATE(created_at) = analytics_date
    GROUP BY campaign_id
    ON CONFLICT (campaign_id, date) DO UPDATE
    SET 
        emails_sent = EXCLUDED.emails_sent,
        emails_delivered = EXCLUDED.emails_delivered,
        emails_opened = EXCLUDED.emails_opened,
        emails_clicked = EXCLUDED.emails_clicked,
        emails_bounced = EXCLUDED.emails_bounced,
        emails_unsubscribed = EXCLUDED.emails_unsubscribed,
        open_rate = CASE 
            WHEN EXCLUDED.emails_delivered > 0 
            THEN (EXCLUDED.emails_opened::DECIMAL / EXCLUDED.emails_delivered * 100)
            ELSE 0 
        END,
        click_rate = CASE 
            WHEN EXCLUDED.emails_delivered > 0 
            THEN (EXCLUDED.emails_clicked::DECIMAL / EXCLUDED.emails_delivered * 100)
            ELSE 0 
        END,
        bounce_rate = CASE 
            WHEN EXCLUDED.emails_sent > 0 
            THEN (EXCLUDED.emails_bounced::DECIMAL / EXCLUDED.emails_sent * 100)
            ELSE 0 
        END,
        unsubscribe_rate = CASE 
            WHEN EXCLUDED.emails_delivered > 0 
            THEN (EXCLUDED.emails_unsubscribed::DECIMAL / EXCLUDED.emails_delivered * 100)
            ELSE 0 
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply analytics calculation trigger
CREATE TRIGGER trigger_calculate_campaign_analytics
    AFTER INSERT OR UPDATE ON campaign_emails
    FOR EACH ROW EXECUTE FUNCTION calculate_campaign_analytics();

-- Enable Row Level Security
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequence_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Users can view their account's email templates"
    ON email_templates FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert email templates for their account"
    ON email_templates FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's email templates"
    ON email_templates FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's email templates"
    ON email_templates FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for campaigns
CREATE POLICY "Users can view their account's campaigns"
    ON campaigns FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert campaigns for their account"
    ON campaigns FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's campaigns"
    ON campaigns FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's campaigns"
    ON campaigns FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for campaign_emails
CREATE POLICY "Users can view their account's campaign emails"
    ON campaign_emails FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert campaign emails for their account"
    ON campaign_emails FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's campaign emails"
    ON campaign_emails FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's campaign emails"
    ON campaign_emails FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for campaign_sequences
CREATE POLICY "Users can view sequences for their account's campaigns"
    ON campaign_sequences FOR SELECT
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can insert sequences for their account's campaigns"
    ON campaign_sequences FOR INSERT
    WITH CHECK (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can update sequences for their account's campaigns"
    ON campaign_sequences FOR UPDATE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can delete sequences for their account's campaigns"
    ON campaign_sequences FOR DELETE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- RLS Policies for campaign_sequence_executions
CREATE POLICY "Users can view executions for their account's campaigns"
    ON campaign_sequence_executions FOR SELECT
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can insert executions for their account's campaigns"
    ON campaign_sequence_executions FOR INSERT
    WITH CHECK (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can update executions for their account's campaigns"
    ON campaign_sequence_executions FOR UPDATE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

CREATE POLICY "Users can delete executions for their account's campaigns"
    ON campaign_sequence_executions FOR DELETE
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- RLS Policies for campaign_analytics
CREATE POLICY "Users can view analytics for their account's campaigns"
    ON campaign_analytics FOR SELECT
    USING (campaign_id IN (
        SELECT id FROM campaigns WHERE account_id IN (
            SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    ));

-- Add helpful comments
COMMENT ON TABLE email_templates IS 'Reusable email templates for campaigns';
COMMENT ON TABLE campaigns IS 'Email campaigns with targeting and scheduling';
COMMENT ON TABLE campaign_emails IS 'Individual emails sent as part of campaigns';
COMMENT ON TABLE campaign_sequences IS 'Drip campaign sequences with delays';
COMMENT ON TABLE campaign_sequence_executions IS 'Tracks execution of drip sequences';
COMMENT ON TABLE campaign_analytics IS 'Daily aggregated campaign statistics';


-- ============================================================================
-- PHASE 11: AI PREDICTIVE ANALYTICS
-- ============================================================================

-- Migration: AI Predictive Lead Conversion System
-- Description: Add tables and fields for AI-powered lead scoring and conversion prediction

-- ============================================================================
-- 1. Add AI fields to contacts table
-- ============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_conversion_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_conversion_probability DECIMAL(5,4);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(5,4);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_lead_segment VARCHAR(20); -- 'hot', 'warm', 'cold'
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_contributing_factors JSONB DEFAULT '[]';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_recommended_actions JSONB DEFAULT '[]';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_score_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON contacts(ai_conversion_score);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_segment ON contacts(ai_lead_segment);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_updated ON contacts(ai_score_updated_at);


-- ============================================================================
-- 2. Add AI fields to deals table
-- ============================================================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_win_probability DECIMAL(5,4);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(5,4);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_risk_factors JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_recommended_actions JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_predicted_close_date DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_score_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_deals_ai_probability ON deals(ai_win_probability);
CREATE INDEX IF NOT EXISTS idx_deals_ai_updated ON deals(ai_score_updated_at);


-- ============================================================================
-- 3. Create AI scoring history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_scoring_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Entity being scored
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('contact', 'deal')),
    entity_id UUID NOT NULL,
    
    -- Score details
    score_type VARCHAR(50) NOT NULL, -- 'conversion', 'win_probability', etc.
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


-- ============================================================================
-- 4. Create AI model performance tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Model information
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'conversion', 'win_probability', etc.
    
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


-- ============================================================================
-- 5. Create AI insights table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Insight details
    insight_type VARCHAR(50) NOT NULL, -- 'trend', 'anomaly', 'recommendation', 'prediction'
    title TEXT NOT NULL,
    description TEXT,
    
    -- Insight data
    data JSONB,
    confidence_score DECIMAL(5,4),
    
    -- Related entities
    entity_type VARCHAR(20), -- 'contact', 'deal', 'company', 'campaign'
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


-- ============================================================================
-- 6. Enable Row Level Security
-- ============================================================================

ALTER TABLE ai_scoring_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_scoring_history
CREATE POLICY "Users can view their account's AI scoring history"
    ON ai_scoring_history FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert AI scoring history for their account"
    ON ai_scoring_history FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for ai_model_performance
CREATE POLICY "Users can view their account's AI model performance"
    ON ai_model_performance FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert AI model performance for their account"
    ON ai_model_performance FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's AI model performance"
    ON ai_model_performance FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- RLS Policies for ai_insights
CREATE POLICY "Users can view their account's AI insights"
    ON ai_insights FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert AI insights for their account"
    ON ai_insights FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their account's AI insights"
    ON ai_insights FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete their account's AI insights"
    ON ai_insights FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));


-- ============================================================================
-- 7. Add helpful comments
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

-- Migration: Optimize RLS Performance
-- Description: Wrap auth.uid() in SELECT statements to enable initPlan optimization
-- This prevents auth.uid() from being called on every row, dramatically improving performance

-- ============================================================================
-- Drop existing policies to recreate them with optimizations
-- ============================================================================

-- Accounts policies
DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON accounts;

-- Users policies  
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;

-- Contacts policies
DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their account" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their account" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their account" ON contacts;

-- Companies policies
DROP POLICY IF EXISTS "Users can view companies in their account" ON companies;
DROP POLICY IF EXISTS "Users can insert companies in their account" ON companies;
DROP POLICY IF EXISTS "Users can update companies in their account" ON companies;
DROP POLICY IF EXISTS "Users can delete companies in their account" ON companies;

-- Deals policies
DROP POLICY IF EXISTS "Users can view deals in their account" ON deals;
DROP POLICY IF EXISTS "Users can insert deals in their account" ON deals;
DROP POLICY IF EXISTS "Users can update deals in their account" ON deals;
DROP POLICY IF EXISTS "Users can delete deals in their account" ON deals;

-- Pipelines policies
DROP POLICY IF EXISTS "Users can view pipelines in their account" ON pipelines;
DROP POLICY IF EXISTS "Users can insert pipelines in their account" ON pipelines;
DROP POLICY IF EXISTS "Users can update pipelines in their account" ON pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines in their account" ON pipelines;


-- ============================================================================
-- Recreate policies with optimized auth.uid() usage
-- ============================================================================

-- Accounts policies
CREATE POLICY "Users can view their own account"
    ON accounts FOR SELECT
    USING (id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update their own account"
    ON accounts FOR UPDATE
    USING (id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Users policies
CREATE POLICY "Users can view their own user record"
    ON users FOR SELECT
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Contacts policies
CREATE POLICY "Users can view contacts in their account"
    ON contacts FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert contacts in their account"
    ON contacts FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update contacts in their account"
    ON contacts FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete contacts in their account"
    ON contacts FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Companies policies
CREATE POLICY "Users can view companies in their account"
    ON companies FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert companies in their account"
    ON companies FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update companies in their account"
    ON companies FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete companies in their account"
    ON companies FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Deals policies
CREATE POLICY "Users can view deals in their account"
    ON deals FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert deals in their account"
    ON deals FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update deals in their account"
    ON deals FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete deals in their account"
    ON deals FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

-- Pipelines policies
CREATE POLICY "Users can view pipelines in their account"
    ON pipelines FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can insert pipelines in their account"
    ON pipelines FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can update pipelines in their account"
    ON pipelines FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can delete pipelines in their account"
    ON pipelines FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));


-- ============================================================================
-- Performance notes
-- ============================================================================

-- By wrapping auth.uid() in a SELECT statement, PostgreSQL can use initPlan
-- optimization, which evaluates the auth.uid() once per query instead of
-- once per row. This can improve query performance by 10-100x for large tables.

-- Example of the optimization:
-- BEFORE: auth.uid() is called for every row
-- AFTER: auth.uid() is called once, result is cached and reused

-- You can verify the optimization by running EXPLAIN ANALYZE on queries
-- and looking for "InitPlan" in the query plan.


-- ============================================================================
-- END OF CONSOLIDATED MIGRATION
-- ============================================================================