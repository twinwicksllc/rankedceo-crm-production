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
    submit_button_text TEXT DEFAULT 'Submit',
    submit_button_color TEXT DEFAULT '#3b82f6',
    background_color TEXT DEFAULT '#ffffff',
    
    -- Submission settings
    allow_multiple_submissions BOOLEAN DEFAULT FALSE,
    collect_email BOOLEAN DEFAULT FALSE,
    send_notification_email BOOLEAN DEFAULT FALSE,
    notification_emails TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Form Fields table - Stores individual form fields
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    
    -- Field definition
    field_type TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_key TEXT NOT NULL,
    placeholder TEXT,
    default_value TEXT,
    required BOOLEAN DEFAULT FALSE,
    
    -- Field options (for select, radio, checkbox)
    options JSONB,
    
    -- Validation rules
    validation_rules JSONB,
    
    -- Layout
    order_index INTEGER DEFAULT 0,
    width TEXT DEFAULT 'full' CHECK (width IN ('full', 'half', 'third', 'quarter')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for field_key per form
    UNIQUE(form_id, field_key)
);

-- Form Submissions table - Stores form submission data
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    
    -- Submission data
    submission_data JSONB NOT NULL,
    
    -- Submission metadata
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    
    -- Related contact (if email was collected and matched)
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_forms_account_id ON forms(account_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_public_url ON forms(public_url);
CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_field_type ON form_fields(field_type);
CREATE INDEX IF NOT EXISTS idx_form_fields_order_index ON form_fields(form_id, order_index);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_contact_id ON form_submissions(contact_id);

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at BEFORE UPDATE ON form_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique public URL for form
CREATE OR REPLACE FUNCTION generate_form_public_url()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.public_url IS NULL AND NEW.status = 'published' THEN
        -- Generate a URL-friendly slug from the form name
        NEW.public_url := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'));
        NEW.public_url := regexp_replace(NEW.public_url, '\s+', '-', 'g');
        NEW.public_url := NEW.public_url || '-' || substr(NEW.id::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply public URL generation trigger
CREATE TRIGGER trigger_generate_form_public_url
    BEFORE INSERT OR UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION generate_form_public_url();

-- Enable Row Level Security
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forms
CREATE POLICY "Users can view their account's forms"
    ON forms FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert forms for their account"
    ON forms FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their account's forms"
    ON forms FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their account's forms"
    ON forms FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

-- RLS Policies for form_fields
CREATE POLICY "Users can view their account's form fields"
    ON form_fields FOR SELECT
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert form fields for their forms"
    ON form_fields FOR INSERT
    WITH CHECK (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can update their account's form fields"
    ON form_fields FOR UPDATE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can delete their account's form fields"
    ON form_fields FOR DELETE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

-- RLS Policies for form_submissions
CREATE POLICY "Users can view their account's form submissions"
    ON form_submissions FOR SELECT
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert form submissions for their forms"
    ON form_submissions FOR INSERT
    WITH CHECK (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can update their account's form submissions"
    ON form_submissions FOR UPDATE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can delete their account's form submissions"
    ON form_submissions FOR DELETE
    USING (form_id IN (
        SELECT id FROM forms WHERE account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    ));

-- Allow public submission for published forms
CREATE POLICY "Anyone can submit to published forms"
    ON form_submissions FOR INSERT
    WITH CHECK (form_id IN (
        SELECT id FROM forms WHERE status = 'published'
    ));

-- Add helpful comments
COMMENT ON TABLE forms IS 'Form definitions and settings';
COMMENT ON TABLE form_fields IS 'Individual form fields with validation';
COMMENT ON TABLE form_submissions IS 'Form submission data';
COMMENT ON COLUMN forms.public_url IS 'Public URL for accessing the form';
COMMENT ON COLUMN forms.notification_emails IS 'List of email addresses to receive submission notifications';
COMMENT ON COLUMN form_fields.options IS 'Field options for select, radio, checkbox fields';
COMMENT ON COLUMN form_fields.validation_rules IS 'Validation rules for the field';
COMMENT ON COLUMN form_submissions.submission_data IS 'Submitted form data as JSON';
