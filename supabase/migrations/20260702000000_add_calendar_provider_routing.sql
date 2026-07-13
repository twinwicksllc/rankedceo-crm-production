-- ============================================================
-- Calendar Provider Routing + Double-Booking Guard
-- ============================================================

-- 1) Provider-agnostic connections for Google/Outlook
CREATE TABLE IF NOT EXISTS public.calendar_provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
    external_calendar_id TEXT NOT NULL,
    external_user_id TEXT,

    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    timezone TEXT DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,

    UNIQUE(account_id, provider, external_calendar_id)
);

ALTER TABLE public.calendar_provider_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account calendar provider connections"
ON public.calendar_provider_connections FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

CREATE POLICY "Users can manage account calendar provider connections"
ON public.calendar_provider_connections FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

CREATE INDEX IF NOT EXISTS idx_calendar_provider_connections_account
    ON public.calendar_provider_connections(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_provider_connections_provider
    ON public.calendar_provider_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_provider_connections_active
    ON public.calendar_provider_connections(account_id, provider, is_active);

DROP TRIGGER IF EXISTS on_calendar_provider_connection_updated ON public.calendar_provider_connections;
CREATE TRIGGER on_calendar_provider_connection_updated
    BEFORE UPDATE ON public.calendar_provider_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 2) Hard guard against local double-bookings
CREATE OR REPLACE FUNCTION public.prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Cancelled/completed/no-show appointments do not reserve time.
    IF NEW.status NOT IN ('scheduled', 'rescheduled') THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.account_id = NEW.account_id
          AND a.status IN ('scheduled', 'rescheduled')
          AND (NEW.id IS NULL OR a.id <> NEW.id)
          AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
    ) THEN
        RAISE EXCEPTION 'Appointment overlaps an existing booking for this account'
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_appointment_overlap_trg ON public.appointments;
CREATE TRIGGER prevent_appointment_overlap_trg
    BEFORE INSERT OR UPDATE OF account_id, start_time, end_time, status
    ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_appointment_overlap();
