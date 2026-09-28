-- ============================================================================
-- BASELINE: accounts, users (WaaS project)
-- ============================================================================
-- These two tables exist live in rankedceo-waas but were never captured by
-- any tracked migration in this directory. Forensic evidence (identical
-- constraint names: accounts_name_not_empty, users_account_id_not_null, and
-- the same handle_new_user()-style bootstrap trigger pattern) confirms they
-- were created by running the CRM project's
-- supabase/migrations/000001_create_users_and_accounts.sql directly against
-- the WaaS database, outside of this migration history.
--
-- NOTE: No WaaS application code (lib/waas/**, app/waas/**, app/api/waas/**)
-- references these tables directly. WaaS's actual multi-tenant model is
-- built around `tenants` (see 001_waas_tenants.sql), with only a soft/nullable
-- `tenants.crm_account_id` pointer back to the *CRM* project's accounts
-- table (a different Supabase project). These accounts/users tables appear to
-- be vestigial from an early bootstrap step and are not wired into any
-- current WaaS feature.
--
-- This migration exists purely to bring the live schema under version
-- control (idempotent, matches live shape exactly) — it intentionally does
-- NOT wire these tables into any WaaS feature or RLS-gate any tenant data
-- with them. If/when these tables are confirmed fully unused, a future
-- migration can drop them; that decision is deferred, not made here.
-- ============================================================================

-- ============================================================================
-- 1. ACCOUNTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL DEFAULT 'My Account',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT accounts_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON public.accounts(created_at);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    full_name   VARCHAR(255),
    avatar_url  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT users_account_id_not_null CHECK (account_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_users_account_id ON public.users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(id); -- references auth.users.email, kept for parity with live index (naming is historical/mislabeled)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Bootstrap trigger: auto-create account+user row on new auth signup
-- ============================================================================
-- Preserved from the CRM's original migration for parity with the live
-- database. Harmless no-op for WaaS's actual signup flow (which does not
-- rely on this trigger/tables), but kept since it already exists live and
-- removing it is a behavior change outside the scope of this baseline pass.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_account_id UUID;
BEGIN
    INSERT INTO public.accounts (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Account'))
    RETURNING id INTO new_account_id;

    INSERT INTO public.users (id, account_id, full_name, avatar_url)
    VALUES (
        NEW.id,
        new_account_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. updated_at maintenance trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================
-- Live dump showed duplicated singular/plural policy names on accounts
-- ("their own account" appearing both singular and plural) — recreating
-- both variants here so this migration is a true no-op against production
-- and a complete baseline on a fresh database.

DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
CREATE POLICY "Users can view their own accounts"
    ON public.accounts FOR SELECT
    USING (id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
CREATE POLICY "Users can view their own account"
    ON public.accounts FOR SELECT
    USING (id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;
CREATE POLICY "Users can insert their own accounts"
    ON public.accounts FOR INSERT
    WITH CHECK (id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
CREATE POLICY "Users can update their own accounts"
    ON public.accounts FOR UPDATE
    USING (id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own account" ON public.accounts;
CREATE POLICY "Users can update their own account"
    ON public.accounts FOR UPDATE
    USING (id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
CREATE POLICY "Users can view their own user record"
    ON public.users FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own user record" ON public.users;
CREATE POLICY "Users can insert their own user record"
    ON public.users FOR INSERT
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own user record" ON public.users;
CREATE POLICY "Users can update their own user record"
    ON public.users FOR UPDATE
    USING (id = auth.uid());

-- ============================================================================
-- 6. Backfill: create accounts/users rows for any existing auth.users
--    that don't already have one (safe to run multiple times)
-- ============================================================================
DO $$
DECLARE
    user_record RECORD;
    new_account_id UUID;
BEGIN
    FOR user_record IN
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN public.users u ON u.id = au.id
        WHERE u.id IS NULL
    LOOP
        INSERT INTO public.accounts (name)
        VALUES (COALESCE(user_record.raw_user_meta_data->>'full_name', 'My Account'))
        RETURNING id INTO new_account_id;

        INSERT INTO public.users (id, account_id, full_name, avatar_url)
        VALUES (
            user_record.id,
            new_account_id,
            COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)),
            user_record.raw_user_meta_data->>'avatar_url'
        );

        RAISE NOTICE 'Created account and user record for: %', user_record.email;
    END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'WaaS baseline migration complete for:';
    RAISE NOTICE '  - accounts';
    RAISE NOTICE '  - users';
    RAISE NOTICE '(Note: these tables are not currently referenced';
    RAISE NOTICE ' by any WaaS application code — see comment header)';
    RAISE NOTICE '==============================================';
END $$;
