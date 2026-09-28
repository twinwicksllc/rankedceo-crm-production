-- ============================================================================
-- BASELINE: contacts, companies, pipelines, pipeline_stages
-- ============================================================================
-- These four tables have existed in the live rankedceo-crm database for a
-- long time (referenced by deals, activities, form-submissions, and RLS
-- migrations 000017/004) but were never captured by a tracked CREATE TABLE
-- migration. This migration brings them under version control.
--
-- Written to be 100% idempotent/safe to run against:
--   (a) a fresh database that has none of these tables yet, and
--   (b) the current live production database where they already exist
--       with this exact shape (verified via information_schema dump).
--
-- Schema shape confirmed against live schema dump on this date via
-- information_schema.columns / table_constraints / pg_indexes / pg_policies.
-- ============================================================================

-- ============================================================================
-- COMPANIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    owner_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    domain          VARCHAR(255),
    industry        VARCHAR(255),
    size            VARCHAR(50),
    revenue         VARCHAR(50),
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    zip             VARCHAR(20),
    country         VARCHAR(100) DEFAULT 'US',
    tags            TEXT[],
    custom_fields   JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);

-- Guard: add any missing columns if table already existed in a partial shape
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='owner_user_id') THEN
        ALTER TABLE public.companies ADD COLUMN owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='custom_fields') THEN
        ALTER TABLE public.companies ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='tags') THEN
        ALTER TABLE public.companies ADD COLUMN tags TEXT[];
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_account_id ON public.companies USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON public.companies USING btree (account_id, domain);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies USING btree (owner_user_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON public.companies;
CREATE POLICY "Users can view account data" ON public.companies
FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON public.companies;
CREATE POLICY "Users can manage account data" ON public.companies
FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.companies;
CREATE POLICY "view_account_data_non_recursive" ON public.companies
FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.companies;
CREATE POLICY "manage_account_data_non_recursive" ON public.companies
FOR ALL TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())))
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())));

-- ============================================================================
-- CONTACTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id                  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    company_id                  UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    owner_user_id               UUID REFERENCES public.users(id) ON DELETE SET NULL,
    first_name                  VARCHAR(100),
    last_name                   VARCHAR(100),
    email                       VARCHAR(255),
    normalized_email            VARCHAR(255),
    phone                       VARCHAR(50),
    phone_e164                  VARCHAR(20),
    consent_status              VARCHAR(50) DEFAULT 'single_opt_in',
    consent_source              VARCHAR(100),
    consent_timestamp           TIMESTAMP,
    consent_ip                  VARCHAR(50),
    lead_score                  INTEGER DEFAULT 0,
    score_breakdown             JSONB,
    lead_score_updated_at       TIMESTAMP,
    source                      VARCHAR(100),
    source_campaign_id          UUID,
    source_user_id              UUID REFERENCES public.users(id) ON DELETE SET NULL,
    source_date                 TIMESTAMP,
    tags                        TEXT[],
    custom_fields               JSONB DEFAULT '{}'::jsonb,
    last_activity_at            TIMESTAMP,
    last_activity_type          VARCHAR(100),
    created_at                  TIMESTAMP DEFAULT now(),
    updated_at                  TIMESTAMP DEFAULT now(),
    deleted_at                  TIMESTAMP,
    ai_conversion_score         INTEGER DEFAULT 0,
    ai_conversion_probability   NUMERIC,
    ai_confidence_score         NUMERIC,
    ai_lead_segment             VARCHAR(100),
    ai_contributing_factors     JSONB DEFAULT '[]'::jsonb,
    ai_recommended_actions      JSONB DEFAULT '[]'::jsonb,
    ai_score_updated_at         TIMESTAMPTZ,
    ai_model_version            VARCHAR(50)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='account_id') THEN
        ALTER TABLE public.contacts ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='company_id') THEN
        ALTER TABLE public.contacts ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='owner_user_id') THEN
        ALTER TABLE public.contacts ADD COLUMN owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_conversion_score') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_conversion_score INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_conversion_probability') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_conversion_probability NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_confidence_score') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_confidence_score NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_lead_segment') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_lead_segment VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_contributing_factors') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_contributing_factors JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_recommended_actions') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_recommended_actions JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_score_updated_at') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_score_updated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='ai_model_version') THEN
        ALTER TABLE public.contacts ADD COLUMN ai_model_version VARCHAR(50);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON public.contacts USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON public.contacts USING btree (ai_conversion_score);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_segment ON public.contacts USING btree (ai_lead_segment);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_updated ON public.contacts USING btree (ai_score_updated_at);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON public.contacts USING btree (account_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_email ON public.contacts USING btree (account_id, normalized_email) WHERE (normalized_email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_e164 ON public.contacts USING btree (account_id, phone_e164) WHERE (phone_e164 IS NOT NULL);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON public.contacts;
CREATE POLICY "Users can view account data" ON public.contacts
FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON public.contacts;
CREATE POLICY "Users can manage account data" ON public.contacts
FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.contacts;
CREATE POLICY "view_account_data_non_recursive" ON public.contacts
FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.contacts;
CREATE POLICY "manage_account_data_non_recursive" ON public.contacts
FOR ALL TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())))
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())));

-- ============================================================================
-- PIPELINES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pipelines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    is_default  BOOLEAN DEFAULT false,
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT now(),
    updated_at  TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_account_id ON public.pipelines USING btree (account_id);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON public.pipelines;
CREATE POLICY "Users can view account data" ON public.pipelines
FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON public.pipelines;
CREATE POLICY "Users can manage account data" ON public.pipelines
FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.pipelines;
CREATE POLICY "view_account_data_non_recursive" ON public.pipelines
FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.pipelines;
CREATE POLICY "manage_account_data_non_recursive" ON public.pipelines
FOR ALL TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())))
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = (SELECT auth.uid())));

-- ============================================================================
-- PIPELINE_STAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id     UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    position        INTEGER NOT NULL,
    probability     INTEGER DEFAULT 0,
    is_closed_won   BOOLEAN DEFAULT false,
    is_closed_lost  BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT now(),
    CONSTRAINT pipeline_stages_pipeline_id_position_key UNIQUE (pipeline_id, position)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON public.pipeline_stages USING btree (pipeline_id);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Authenticated, account-scoped policies (via parent pipeline's account_id)
DROP POLICY IF EXISTS "Users can view pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can view pipeline stages in their account" ON public.pipeline_stages
FOR SELECT TO authenticated
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

DROP POLICY IF EXISTS "Users can insert pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can insert pipeline stages in their account" ON public.pipeline_stages
FOR INSERT TO authenticated
WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

DROP POLICY IF EXISTS "Users can update pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can update pipeline stages in their account" ON public.pipeline_stages
FOR UPDATE TO authenticated
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()))
WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

DROP POLICY IF EXISTS "Users can delete pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can delete pipeline stages in their account" ON public.pipeline_stages
FOR DELETE TO authenticated
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

-- Legacy/duplicate "public" role policies observed live (kept for parity;
-- these appear to be an older/looser policy set layered on top of the
-- authenticated ones above -- preserved as-is, not something to newly design).
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
FOR SELECT TO public
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

DROP POLICY IF EXISTS "pipeline_stages_insert" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages
FOR INSERT TO public
WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

DROP POLICY IF EXISTS "pipeline_stages_update" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages
FOR UPDATE TO public
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()))
WITH CHECK (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

DROP POLICY IF EXISTS "pipeline_stages_delete" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages
FOR DELETE TO public
USING (pipeline_id IN (SELECT id FROM public.pipelines WHERE account_id = get_current_user_account_id()));

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Baseline migration complete for:';
    RAISE NOTICE '  - companies';
    RAISE NOTICE '  - contacts';
    RAISE NOTICE '  - pipelines';
    RAISE NOTICE '  - pipeline_stages';
    RAISE NOTICE '==============================================';
END $$;
