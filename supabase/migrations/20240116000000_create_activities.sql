-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create activities table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Relationships
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    
    -- Activity details
    type TEXT NOT NULL CHECK (type IN ('call', 'meeting', 'email', 'note', 'task')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Additional fields
    duration_minutes INTEGER,
    location TEXT,
    attendees TEXT[], -- Array of attendee names or emails
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common queries (this was previously a stray bare column list
-- left inside the CREATE TABLE body above, which is a SQL syntax error and
-- fails on a fresh sequential replay even though CREATE TABLE IF NOT EXISTS
-- would otherwise be a no-op against the pre-existing production table)
CREATE INDEX IF NOT EXISTS idx_activities_account_id ON public.activities(account_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON public.activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at);

-- NOTE: The live production `activities` table (created out-of-band, not by
-- this migration) has no `status`, `due_date`, `updated_at`, `title`,
-- `description`, `duration_minutes`, `location`, or `attendees` columns, so
-- CREATE TABLE IF NOT EXISTS above is a no-op there and any statement below
-- referencing those columns must be guarded to remain safe on both a fresh
-- database (where this CREATE TABLE actually runs and creates those columns)
-- and the real production shape (where it doesn't).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activities' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(status);
    END IF;
END $$;

-- Create updated_at trigger (only meaningful if `updated_at` actually
-- exists on this table; on live production it does not, since the CREATE
-- TABLE above is a no-op there)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activities' AND column_name = 'updated_at') THEN
        DROP TRIGGER IF EXISTS set_activities_updated_at ON public.activities;
        CREATE TRIGGER set_activities_updated_at
            BEFORE UPDATE ON public.activities
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- Row Level Security (RLS)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies. NOTE: this table's `accounts` FK-based auth.uid() lookup
-- pattern below (`account_id IN (SELECT id FROM accounts WHERE user_id =
-- auth.uid())`) does not match the live production schema (accounts has no
-- user_id column; users are joined via public.users instead). These
-- policies still get created safely (they simply reference an
-- always-false/empty subquery against a fresh database's schema-correct
-- `accounts` table which has no such column either), but are superseded by
-- 000009/000013's "Users can view/manage activities" policies using
-- get_current_user_account_id(). Left as-is to preserve migration history;
-- guarded with DROP POLICY IF EXISTS for idempotency.
DROP POLICY IF EXISTS "Users can view activities in their account" ON public.activities;
DROP POLICY IF EXISTS "Users can insert activities for their account" ON public.activities;
DROP POLICY IF EXISTS "Users can update activities in their account" ON public.activities;
DROP POLICY IF EXISTS "Users can delete activities in their account" ON public.activities;

CREATE POLICY "Users can view activities in their account"
    ON public.activities FOR SELECT
    USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert activities for their account"
    ON public.activities FOR INSERT
    WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update activities in their account"
    ON public.activities FOR UPDATE
    USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete activities in their account"
    ON public.activities FOR DELETE
    USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Create index on due_date for pending tasks (guarded: live production
-- table has no `due_date`/`status` columns, only `due_at`)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activities' AND column_name = 'due_date')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activities' AND column_name = 'status') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_activities_due_date ON public.activities(due_date) WHERE status = ''pending''';
    END IF;
END $$;

-- Create index on created_at for timeline queries
CREATE INDEX IF NOT EXISTS idx_activities_created_at 
    ON public.activities(created_at DESC);

-- Grant permissions
GRANT ALL ON public.activities TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;