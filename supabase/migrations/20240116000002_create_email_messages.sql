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
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert email threads for their account"
    ON email_threads FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their account's email threads"
    ON email_threads FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their account's email threads"
    ON email_threads FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

-- RLS Policies for email_messages
CREATE POLICY "Users can view their account's email messages"
    ON email_messages FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert email messages for their account"
    ON email_messages FOR INSERT
    WITH CHECK (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their account's email messages"
    ON email_messages FOR UPDATE
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their account's email messages"
    ON email_messages FOR DELETE
    USING (account_id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    ));

-- Add helpful comments
COMMENT ON TABLE email_threads IS 'Groups related emails into conversations';
COMMENT ON TABLE email_messages IS 'Stores individual email messages captured via BCC';
COMMENT ON COLUMN accounts.bcc_email_address IS 'Unique BCC address for this account to capture emails';