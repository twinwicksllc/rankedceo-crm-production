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
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Indexes for common queries
    account_id,
    user_id,
    contact_id,
    company_id,
    deal_id,
    type,
    status,
    created_at
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_activities_updated_at
    BEFORE UPDATE ON public.activities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view activities in their account"
    ON public.activities FOR SELECT
    USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert activities for their account"
    ON public.activities FOR INSERT
    WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can update activities in their account"
    ON public.activities FOR UPDATE
    USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete activities in their account"
    ON public.activities FOR DELETE
    USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Create index on due_date for pending tasks
CREATE INDEX IF NOT EXISTS idx_activities_due_date 
    ON public.activities(due_date) 
    WHERE status = 'pending';

-- Create index on created_at for timeline queries
CREATE INDEX IF NOT EXISTS idx_activities_created_at 
    ON public.activities(created_at DESC);

-- Grant permissions
GRANT ALL ON public.activities TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;