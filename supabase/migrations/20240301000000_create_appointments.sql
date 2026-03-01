-- ============================================================
-- AI Agent: Calendly OAuth Connections & Appointments
-- ============================================================

-- 1. CALENDLY CONNECTIONS (per CRM user OAuth tokens)
CREATE TABLE IF NOT EXISTS public.calendly_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Linked to CRM user
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Calendly OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Calendly user info
    calendly_user_uri TEXT NOT NULL,
    calendly_user_name TEXT,
    calendly_user_email TEXT,
    calendly_organization_uri TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,

    UNIQUE(user_id)
);

ALTER TABLE public.calendly_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Calendly connection"
ON public.calendly_connections FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

CREATE INDEX idx_calendly_connections_account_id ON public.calendly_connections(account_id);
CREATE INDEX idx_calendly_connections_user_id ON public.calendly_connections(user_id);

-- Trigger for updated_at
CREATE TRIGGER on_calendly_connection_updated
    BEFORE UPDATE ON public.calendly_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 2. APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Multi-tenant
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

    -- CRM relationships (optional - can be linked after booking)
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,

    -- Booked by (CRM user who owns the Calendly slot)
    booked_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Invitee (the lead/patient)
    invitee_name TEXT NOT NULL,
    invitee_email TEXT NOT NULL,
    invitee_phone TEXT,

    -- Appointment details
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show')),
    appointment_type TEXT NOT NULL DEFAULT 'call'
        CHECK (appointment_type IN ('call', 'meeting', 'video_call', 'in_person', 'other')),

    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    duration_minutes INTEGER,

    -- Location / meeting link
    location TEXT,
    meeting_url TEXT,

    -- Calendly specific
    calendly_event_uri TEXT,          -- Calendly event URI
    calendly_invitee_uri TEXT,        -- Calendly invitee URI
    calendly_event_type_uri TEXT,     -- Calendly event type URI
    calendly_cancel_url TEXT,         -- URL for invitee to cancel
    calendly_reschedule_url TEXT,     -- URL for invitee to reschedule

    -- Source tracking
    source TEXT DEFAULT 'manual'
        CHECK (source IN ('manual', 'ai_agent', 'hvac', 'plumbing', 'electrical', 'smile', 'crm')),
    source_lead_id UUID,              -- ID from industry_leads table if applicable

    -- AI agent conversation context
    agent_conversation JSONB DEFAULT '[]',

    -- Notifications
    confirmation_sent_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,
    metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account appointments"
ON public.appointments FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

CREATE POLICY "Users can manage account appointments"
ON public.appointments FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- Allow anon inserts for public booking widget
CREATE POLICY "Public can create appointments"
ON public.appointments FOR INSERT TO anon
WITH CHECK (true);

-- Indexes
CREATE INDEX idx_appointments_account_id ON public.appointments(account_id);
CREATE INDEX idx_appointments_contact_id ON public.appointments(contact_id);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_calendly_event_uri ON public.appointments(calendly_event_uri);
CREATE INDEX idx_appointments_source ON public.appointments(source);

-- Trigger for updated_at
CREATE TRIGGER on_appointment_updated
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 3. AGENT CONVERSATIONS TABLE (persist chat history)
CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Optional account link (null for anonymous public users)
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,

    -- Session identifier (for anonymous users)
    session_id TEXT NOT NULL,

    -- Source context
    source TEXT NOT NULL DEFAULT 'crm'
        CHECK (source IN ('crm', 'hvac', 'plumbing', 'electrical', 'smile')),

    -- Lead info collected during conversation
    lead_name TEXT,
    lead_email TEXT,
    lead_phone TEXT,

    -- Conversation messages
    messages JSONB NOT NULL DEFAULT '[]',

    -- Outcome
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'booked', 'abandoned', 'completed')),

    UNIQUE(session_id)
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view account conversations"
ON public.agent_conversations FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

CREATE POLICY "Anyone can create/update conversations"
ON public.agent_conversations FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage account conversations"
ON public.agent_conversations FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Indexes
CREATE INDEX idx_agent_conversations_session_id ON public.agent_conversations(session_id);
CREATE INDEX idx_agent_conversations_account_id ON public.agent_conversations(account_id);
CREATE INDEX idx_agent_conversations_status ON public.agent_conversations(status);

-- Trigger for updated_at
CREATE TRIGGER on_agent_conversation_updated
    BEFORE UPDATE ON public.agent_conversations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 4. PERMISSIONS for anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON public.appointments TO anon;
GRANT INSERT, UPDATE, SELECT ON public.agent_conversations TO anon;
GRANT SELECT ON public.accounts TO anon;