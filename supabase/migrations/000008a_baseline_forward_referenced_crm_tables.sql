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
--
-- NOTE ON FUNCTIONS: The RLS policies below call get_current_user_email()
-- and get_current_user_account_id(). Those functions are not formally
-- defined until migration 000009_fix_users_policies_v2.sql, but this
-- migration runs immediately after 000001 (before 000009), so we must
-- define them here too. This is safe/idempotent: 000009 later runs
-- CREATE OR REPLACE FUNCTION with the exact same body, which is a no-op
-- functionally. Defining them here (right after users/accounts/auth.users
-- exist) unblocks every later migration that references contacts,
-- companies, pipelines, pipeline_stages, or these functions.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_current_user_account_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) LIMIT 1;
$$;

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
-- DEALS
-- ============================================================================
-- Same situation as companies/contacts/pipelines/pipeline_stages above:
-- `deals` has existed in the live database for a long time (its only
-- tracked CREATE TABLE previously lived in scripts/sql/FIX_DEALS_TABLE_COMPLETE.sql,
-- which is NOT part of supabase/migrations/ and is therefore never applied
-- during a Supabase preview-branch replay), and it is referenced by
-- migration 000009 (and others) before it would otherwise exist.
CREATE TABLE IF NOT EXISTS public.deals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    contact_id              UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id              UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    owner_user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title                   VARCHAR(255) NOT NULL DEFAULT 'Untitled Deal',
    amount                  NUMERIC,
    currency                VARCHAR(10) DEFAULT 'USD',
    pipeline_id             UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
    stage_id                UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
    probability             INTEGER DEFAULT 0,
    close_date              DATE,
    closed_at               TIMESTAMP,
    won                     BOOLEAN,
    lost_reason             TEXT,
    commission_eligible     BOOLEAN DEFAULT true,
    commission_split        JSONB,
    tags                    TEXT[],
    custom_fields           JSONB DEFAULT '{}'::jsonb,
    created_at              TIMESTAMP DEFAULT now(),
    updated_at              TIMESTAMP DEFAULT now(),
    ai_win_probability      NUMERIC,
    ai_confidence_score     NUMERIC,
    ai_risk_factors         JSONB DEFAULT '[]'::jsonb,
    ai_recommended_actions  JSONB DEFAULT '[]'::jsonb,
    ai_predicted_close_date DATE,
    ai_score_updated_at     TIMESTAMPTZ,
    ai_model_version        VARCHAR(50),
    user_id                 UUID REFERENCES public.users(id) ON DELETE SET NULL,
    value                   NUMERIC DEFAULT 0.00,
    stage                   VARCHAR(50) DEFAULT 'Lead',
    win_probability         INTEGER DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100),
    expected_close_date     DATE,
    description             TEXT,
    assigned_to             UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by              UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Guard: add any missing columns if table already existed in a partial shape
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='stage_id') THEN
        ALTER TABLE public.deals ADD COLUMN stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='owner_user_id') THEN
        ALTER TABLE public.deals ADD COLUMN owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='custom_fields') THEN
        ALTER TABLE public.deals ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='tags') THEN
        ALTER TABLE public.deals ADD COLUMN tags TEXT[];
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_stage_check') THEN
        ALTER TABLE public.deals ADD CONSTRAINT deals_stage_check
        CHECK (stage IN ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost',
                         'lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deals_account_id ON public.deals USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON public.deals USING btree (pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON public.deals USING btree (contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company ON public.deals USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON public.deals USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON public.deals USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals USING btree (stage);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_deals_value ON public.deals USING btree (value);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON public.deals USING btree (account_id, close_date);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON public.deals USING btree (expected_close_date);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON public.deals;
CREATE POLICY "Users can view account data" ON public.deals
FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON public.deals;
CREATE POLICY "Users can manage account data" ON public.deals
FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.deals;
CREATE POLICY "view_account_data_non_recursive" ON public.deals
FOR SELECT TO authenticated
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.deals;
CREATE POLICY "manage_account_data_non_recursive" ON public.deals
FOR ALL TO authenticated
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_deals_updated_at ON public.deals;
CREATE TRIGGER trigger_update_deals_updated_at
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION update_deals_updated_at();

-- ============================================================================
-- ACTIVITIES (bare table only)
-- ============================================================================
-- `activities` is referenced (via DROP/CREATE POLICY) by 000009 before its
-- real CREATE TABLE (20240116000000_create_activities.sql, which sorts much
-- later). We only create the bare table + indexes here, matching the live
-- production shape; RLS enable + policy creation is intentionally left to
-- 20240116000000_create_activities.sql (which runs later in sequence and
-- will find the table already present, per its own idempotent
-- CREATE TABLE IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS public.activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    contact_id          UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id          UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id             UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    user_id             UUID REFERENCES public.users(id) ON DELETE SET NULL,
    type                VARCHAR(50) NOT NULL,
    subject             VARCHAR(255),
    body                TEXT,
    direction           VARCHAR(20),
    channel             VARCHAR(50),
    email_message_id    VARCHAR(255),
    email_thread_id     VARCHAR(255),
    email_from          VARCHAR(255),
    email_to            TEXT[],
    email_cc            TEXT[],
    email_bcc           TEXT[],
    email_headers       JSONB,
    due_at              TIMESTAMP,
    completed_at        TIMESTAMP,
    assignee_user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_account_id ON public.activities USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities USING btree (contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities USING btree (deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_email_message_id ON public.activities USING btree (email_message_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities USING btree (account_id, type);

-- ============================================================================
-- CAMPAIGNS, EMAIL_TEMPLATES, FORMS, FORM_SUBMISSIONS (bare tables only)
-- ============================================================================
-- Same situation: referenced by 000009's DROP/CREATE POLICY statements
-- before their real CREATE TABLE (20240116000001_create_campaigns.sql /
-- 20240116000003_create_forms.sql, which sort later). We only create the
-- bare tables + indexes here, matching the live production shape; those
-- later migrations' own CREATE TABLE IF NOT EXISTS will simply no-op and
-- their RLS/policy work proceeds normally against the now-existing tables.
CREATE TABLE IF NOT EXISTS public.campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    created_by_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    type                VARCHAR(50) DEFAULT 'sequence',
    status              VARCHAR(50) DEFAULT 'draft',
    segment_filter      JSONB,
    schedule            JSONB,
    metrics             JSONB DEFAULT '{"sent": 0, "opened": 0, "bounced": 0, "clicked": 0, "replied": 0}'::jsonb,
    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    created_by_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    subject             VARCHAR(255) NOT NULL,
    body_html           TEXT NOT NULL,
    body_text           TEXT,
    variables           TEXT[],
    category            VARCHAR(100),
    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    created_by_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    fields              JSONB NOT NULL,
    settings            JSONB DEFAULT '{}'::jsonb,
    embed_code          TEXT,
    submissions_count   INTEGER DEFAULT 0,
    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id             UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    contact_id          UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    data                JSONB NOT NULL,
    ip_address          VARCHAR(64),
    user_agent          TEXT,
    referrer            TEXT,
    created_at          TIMESTAMP DEFAULT now(),
    account_id          UUID REFERENCES public.accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON public.campaigns USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_account_id ON public.email_templates USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_forms_account_id ON public.forms USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON public.form_submissions USING btree (form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_account_id ON public.form_submissions USING btree (account_id);

-- ============================================================================
-- EMAIL_THREADS, EMAIL_MESSAGES, CAMPAIGN_EMAILS, CAMPAIGN_SEQUENCES,
-- CAMPAIGN_SEQUENCE_EXECUTIONS, CAMPAIGN_ANALYTICS, FORM_FIELDS (bare tables)
-- ============================================================================
-- Same situation again: referenced by 000013/000014's DROP/CREATE POLICY
-- statements before their real CREATE TABLE (20240116000001_create_campaigns.sql
-- / 20240116000002_create_email_messages.sql / 20240116000003_create_forms.sql,
-- all of which sort later). Bare tables + indexes only; RLS/policy work is
-- left to those later migrations which will find the tables already present.
CREATE TABLE IF NOT EXISTS public.email_threads (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    subject text NOT NULL,
    participants TEXT[],
    message_count integer DEFAULT 0,
    last_message_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    thread_id uuid REFERENCES public.email_threads(id) ON DELETE SET NULL,
    message_id text NOT NULL,
    in_reply_to text,
    reference_headers TEXT[],
    from_address text NOT NULL,
    from_name text,
    to_addresses TEXT[] NOT NULL,
    cc_addresses TEXT[],
    bcc_addresses TEXT[],
    subject text NOT NULL,
    body_plain text,
    body_html text,
    direction text DEFAULT 'inbound'::text,
    status text DEFAULT 'received'::text,
    error_message text,
    opened boolean DEFAULT false,
    opened_at timestamp with time zone,
    clicks integer DEFAULT 0,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
    headers jsonb,
    received_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_emails (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    recipient_email text NOT NULL,
    recipient_name text,
    subject text NOT NULL,
    body_html text NOT NULL,
    body_plain text,
    variant text,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    bounced_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    sendgrid_message_id text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_sequences (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
    subject text NOT NULL,
    body_html text NOT NULL,
    body_plain text,
    delay_value integer DEFAULT 0 NOT NULL,
    delay_unit text DEFAULT 'days'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_sequence_executions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    sequence_id uuid REFERENCES public.campaign_sequences(id) ON DELETE CASCADE NOT NULL,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    executed_at timestamp with time zone,
    campaign_email_id uuid REFERENCES public.campaign_emails(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_analytics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL,
    emails_sent integer DEFAULT 0,
    emails_delivered integer DEFAULT 0,
    emails_opened integer DEFAULT 0,
    emails_clicked integer DEFAULT 0,
    emails_bounced integer DEFAULT 0,
    emails_unsubscribed integer DEFAULT 0,
    open_rate numeric,
    click_rate numeric,
    bounce_rate numeric,
    unsubscribe_rate numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_fields (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id uuid REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    placeholder text,
    default_value text,
    options jsonb,
    required boolean DEFAULT false,
    validation_rules jsonb,
    order_index integer DEFAULT 0 NOT NULL,
    width text DEFAULT 'full'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_email_threads_account_id ON public.email_threads USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON public.email_messages USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages USING btree (thread_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON public.campaign_emails USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign_id ON public.campaign_sequences USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequence_executions_campaign_id ON public.campaign_sequence_executions USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id ON public.campaign_analytics USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON public.form_fields USING btree (form_id);

-- AI tables (bare tables only; forward-referenced by 000013_complete_rls_fix.sql's
-- policy statements before their real CREATE TABLE in CONSOLIDATED_MIGRATION.sql /
-- 003_ai_predictive_analytics.sql). Columns match live production schema exactly.
CREATE TABLE IF NOT EXISTS public.ai_scoring_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    entity_type character varying(20) NOT NULL CHECK (entity_type IN ('contact', 'deal')),
    entity_id uuid NOT NULL,
    score_type character varying(50) NOT NULL,
    score_value numeric(5,4) NOT NULL,
    confidence_score numeric(5,4),
    model_version character varying(50),
    model_name character varying(100),
    contributing_factors jsonb DEFAULT '[]',
    recommended_actions jsonb DEFAULT '[]',
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_model_performance (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    model_name character varying(100) NOT NULL,
    model_version character varying(50) NOT NULL,
    model_type character varying(50) NOT NULL,
    accuracy numeric(5,4),
    precision_score numeric(5,4),
    recall numeric(5,4),
    f1_score numeric(5,4),
    training_samples integer,
    training_date timestamp with time zone,
    validation_samples integer,
    validation_date timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_insights (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    insight_type character varying(50) NOT NULL,
    title text NOT NULL,
    description text,
    data jsonb,
    confidence_score numeric(5,4),
    entity_type character varying(20),
    entity_id uuid,
    status character varying(20) DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'acted_upon')),
    action_taken text,
    action_taken_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_ai_scoring_history_account_id ON public.ai_scoring_history USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_ai_scoring_history_entity ON public.ai_scoring_history USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_scoring_history_created_at ON public.ai_scoring_history USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_account_id ON public.ai_model_performance USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_model ON public.ai_model_performance USING btree (model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_type ON public.ai_model_performance USING btree (model_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_account_id ON public.ai_insights USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON public.ai_insights USING btree (insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_status ON public.ai_insights USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON public.ai_insights USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON public.ai_insights USING btree (created_at DESC);

-- Additional forward-referenced tables (bare tables only; matches live production
-- schema). These are referenced by 000016/000017/000019/000020's RLS/seed
-- statements before their real definitions appear later in the migration
-- sequence (or, in some cases, were never formally created in
-- supabase/migrations/ at all and only exist in production).
CREATE TABLE IF NOT EXISTS public.lead_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    type character varying NOT NULL,
    license_terms text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    account_id uuid REFERENCES public.accounts(id)
);

CREATE TABLE IF NOT EXISTS public.qualified_leads_global (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES public.lead_sources(id),
    vertical character varying NOT NULL,
    first_name character varying,
    last_name character varying,
    email character varying,
    normalized_email character varying,
    phone character varying,
    phone_e164 character varying,
    geography jsonb,
    firmographics jsonb,
    quality_score integer,
    contactability_flags jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    account_id uuid REFERENCES public.accounts(id)
);

CREATE TABLE IF NOT EXISTS public.lead_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    qualified_lead_id uuid NOT NULL REFERENCES public.qualified_leads_global(id),
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    contact_id uuid REFERENCES public.contacts(id),
    exclusivity character varying DEFAULT 'shared'::character varying,
    price numeric,
    expires_at timestamp without time zone,
    status character varying DEFAULT 'active'::character varying,
    assigned_at timestamp without time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.category_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coin_type text NOT NULL,
    ebay_category_id text NOT NULL,
    category_name text,
    verified_at timestamp with time zone DEFAULT now(),
    verification_source text DEFAULT 'ai_search'::text,
    confidence smallint DEFAULT 100,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    item_type text,
    breadcrumb text,
    status text DEFAULT 'quarantine'::text NOT NULL,
    item_type_normalized text,
    effective_score numeric DEFAULT 0,
    last_publish_success timestamp with time zone,
    publish_success_count integer DEFAULT 0,
    publish_failure_count integer DEFAULT 0,
    CONSTRAINT category_mappings_coin_type_key UNIQUE (coin_type)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    campaign_id uuid REFERENCES public.campaigns(id),
    contact_id uuid NOT NULL REFERENCES public.contacts(id),
    activity_id uuid REFERENCES public.activities(id),
    user_id uuid,
    direction character varying DEFAULT 'outbound'::character varying,
    channel character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying,
    provider character varying,
    provider_message_id character varying,
    provider_thread_id character varying,
    rfc822_message_id character varying,
    in_reply_to character varying,
    "references" jsonb,
    to_addresses jsonb,
    cc_addresses jsonb,
    bcc_addresses jsonb,
    subject character varying,
    body text,
    headers jsonb,
    sent_at timestamp without time zone,
    delivered_at timestamp without time zone,
    opened_at timestamp without time zone,
    clicked_at timestamp without time zone,
    bounced_at timestamp without time zone,
    complained_at timestamp without time zone,
    unsubscribed_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.calendly_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    user_id uuid NOT NULL UNIQUE,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp with time zone,
    calendly_user_uri text NOT NULL,
    calendly_user_name text,
    calendly_user_email text,
    calendly_organization_uri text,
    is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_lead_sources_account_id ON public.lead_sources USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_qualified_leads_global_account_id ON public.qualified_leads_global USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_qualified_leads_global_source_id ON public.qualified_leads_global USING btree (source_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_account_id ON public.lead_assignments USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_qualified_lead_id ON public.lead_assignments USING btree (qualified_lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_account_id ON public.messages USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON public.messages USING btree (contact_id);
CREATE INDEX IF NOT EXISTS idx_calendly_connections_account_id ON public.calendly_connections USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_calendly_connections_user_id ON public.calendly_connections USING btree (user_id);

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
    RAISE NOTICE '  - deals';
    RAISE NOTICE '  - activities (bare table)';
    RAISE NOTICE '  - campaigns, email_templates, forms, form_submissions (bare tables)';
    RAISE NOTICE '==============================================';
END $$;
