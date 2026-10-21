-- 030: recreate the CRM-group tables in rankedceo-waas (DEC-0022, DEC-0023).
--
-- Generated from the LIVE shapes read in rankedceo-crm-production (read-only audits
-- B3/B4/B5/B6/B9/B12/B13, 2026-10-19..21), not from the repo migrations (the live
-- shapes have drifted). Additive and idempotent. No handle_new_user() and no
-- auth.users trigger is created here.
--
-- Scope: the 22 CRM tables + pipeline_stages (DEC-0023). The WaaS group
-- (tenant_site_*, client_uploaded_assets, client_domain_change_requests,
-- notification_log) is migration 029.

-- ============================================================================
-- 0. Guard: refuse to run in the CRM project (this migration is for rankedceo-waas).
-- ============================================================================
-- rankedceo-crm-production is identified by tables that belong to the other product
-- and will never exist in rankedceo-waas (organizations, ebay_items). Using those as
-- the marker keeps 030 re-runnable in rankedceo-waas (it is idempotent).
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL OR to_regclass('public.ebay_items') IS NOT NULL THEN
    RAISE EXCEPTION '030 must run in rankedceo-waas; this looks like rankedceo-crm-production.';
  END IF;
END $$;

-- ============================================================================
-- 1. accounts / users: add the CRM columns the merged app needs.
--    Base shape = the existing rankedceo-waas tables. Columns that the live
--    handle_new_user() does NOT set are added NULLABLE (slug, users.email, users.name)
--    so new WaaS sign-ups keep working. See DB_CONSOLIDATION_PLAN.md section 3.
-- ============================================================================
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "slug" varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'active'::varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "plan" varchar DEFAULT 'starter'::varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "test_mode" boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "onboarding_step" integer DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "onboarding_data" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamptz;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "company_size" varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "industry" varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "timezone" varchar DEFAULT 'America/New_York'::varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "website" varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "bcc_email_address" text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "onboarding_skipped" boolean DEFAULT false NOT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "phone" varchar;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "platform_type" text DEFAULT 'CRM'::text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "is_pool_account" boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "crm_stripe_customer_id" text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "crm_plan_tier" text DEFAULT 'free'::text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS "crm_billing_enabled" boolean DEFAULT false;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "email" varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "name" varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "role" varchar DEFAULT 'rep'::varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'active'::varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "base_commission_rate" numeric;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "crm_stripe_customer_id" text;

-- ============================================================================
-- 2. The CRM-group tables (columns + primary key).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_billing_events (
  "id" uuid DEFAULT gen_random_uuid(),
  "stripe_event_id" text,
  "stripe_event_type" text,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "processed" boolean DEFAULT false,
  "processed_at" timestamptz,
  "error_message" text,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT crm_billing_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.pipelines (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "name" varchar,
  "is_default" boolean DEFAULT false,
  "position" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT pipelines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.email_threads (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "subject" text,
  "participants" text[],
  "message_count" integer DEFAULT 0,
  "last_message_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT email_threads_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.calendly_connections (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "account_id" uuid,
  "user_id" uuid,
  "access_token" text,
  "refresh_token" text,
  "token_expires_at" timestamptz,
  "calendly_user_uri" text,
  "calendly_user_name" text,
  "calendly_user_email" text,
  "calendly_organization_uri" text,
  "is_active" boolean DEFAULT true,
  CONSTRAINT calendly_connections_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.commission_rates (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "user_id" uuid,
  "rate" numeric DEFAULT 0.00,
  "effective_from" date DEFAULT CURRENT_DATE,
  "effective_to" date,
  "is_active" boolean DEFAULT true,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT commission_rates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.companies (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "owner_user_id" uuid,
  "name" varchar,
  "domain" varchar,
  "industry" varchar,
  "size" varchar,
  "revenue" varchar,
  "address" text,
  "city" varchar,
  "state" varchar,
  "zip" varchar,
  "country" varchar DEFAULT 'US'::character varying,
  "tags" text[],
  "custom_fields" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.crm_subscriptions (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "account_id" uuid,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "stripe_price_id" text,
  "stripe_product_id" text,
  "plan_name" text,
  "plan_tier" text DEFAULT 'pro'::text,
  "industry" text,
  "billing_interval" text DEFAULT 'monthly'::text,
  "amount_cents" integer DEFAULT 0,
  "currency" text DEFAULT 'usd'::text,
  "status" text DEFAULT 'active'::text,
  "cancel_at_period_end" boolean DEFAULT false,
  "current_period_start" timestamptz,
  "current_period_end" timestamptz,
  "trial_start" timestamptz,
  "trial_end" timestamptz,
  "canceled_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT crm_subscriptions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "created_by_user_id" uuid,
  "name" varchar,
  "subject" varchar,
  "body_html" text,
  "body_text" text,
  "variables" text[],
  "category" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT email_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forms (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "created_by_user_id" uuid,
  "name" varchar,
  "fields" jsonb,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "embed_code" text,
  "submissions_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT forms_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.industry_leads (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "account_id" uuid,
  "auth_user_id" uuid,
  "industry" text,
  "lead_name" text,
  "lead_email" text,
  "lead_phone" text,
  "urgency" text DEFAULT 'scheduled'::text,
  "status" text DEFAULT 'new'::text,
  "problem_description" jsonb DEFAULT '{}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT industry_leads_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  "id" uuid DEFAULT gen_random_uuid(),
  "pipeline_id" uuid,
  "name" varchar,
  "position" integer,
  "probability" integer DEFAULT 0,
  "is_closed_won" boolean DEFAULT false,
  "is_closed_lost" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.smile_assessments (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "account_id" uuid,
  "auth_user_id" uuid,
  "patient_name" text,
  "patient_email" text,
  "patient_phone" text,
  "patient_dob" date,
  "smile_goals" text[] DEFAULT '{}'::text[],
  "medical_conditions" text[] DEFAULT '{}'::text[],
  "current_concerns" text,
  "pain_sensitivity" text,
  "desired_outcome" text,
  "dentist_name" text,
  "last_dental_visit" text,
  "dental_insurance" boolean DEFAULT false,
  "insurance_provider" text,
  "medications" text,
  "allergies" text,
  "status" text DEFAULT 'pending'::text,
  CONSTRAINT smile_assessments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "created_by_user_id" uuid,
  "name" varchar,
  "type" varchar DEFAULT 'sequence'::character varying,
  "status" varchar DEFAULT 'draft'::character varying,
  "segment_filter" jsonb,
  "schedule" jsonb,
  "metrics" jsonb DEFAULT '{"sent": 0, "opened": 0, "bounced": 0, "clicked": 0, "replied": 0}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.contacts (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "company_id" uuid,
  "owner_user_id" uuid,
  "first_name" varchar,
  "last_name" varchar,
  "email" varchar,
  "normalized_email" varchar,
  "phone" varchar,
  "phone_e164" varchar,
  "consent_status" varchar DEFAULT 'single_opt_in'::character varying,
  "consent_source" varchar,
  "consent_timestamp" timestamp,
  "consent_ip" varchar,
  "lead_score" integer DEFAULT 0,
  "score_breakdown" jsonb,
  "lead_score_updated_at" timestamp,
  "source" varchar,
  "source_campaign_id" uuid,
  "source_user_id" uuid,
  "source_date" timestamp,
  "tags" text[],
  "custom_fields" jsonb DEFAULT '{}'::jsonb,
  "last_activity_at" timestamp,
  "last_activity_type" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "deleted_at" timestamp,
  "ai_conversion_score" integer DEFAULT 0,
  "ai_conversion_probability" numeric,
  "ai_confidence_score" numeric,
  "ai_lead_segment" varchar,
  "ai_contributing_factors" jsonb DEFAULT '[]'::jsonb,
  "ai_recommended_actions" jsonb DEFAULT '[]'::jsonb,
  "ai_score_updated_at" timestamptz,
  "ai_model_version" varchar,
  CONSTRAINT contacts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.form_fields (
  "id" uuid DEFAULT gen_random_uuid(),
  "form_id" uuid,
  "label" text,
  "field_type" text,
  "placeholder" text,
  "default_value" text,
  "options" jsonb,
  "required" boolean DEFAULT false,
  "validation_rules" jsonb,
  "order_index" integer DEFAULT 0,
  "width" text DEFAULT 'full'::text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT form_fields_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.deals (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "contact_id" uuid,
  "company_id" uuid,
  "owner_user_id" uuid,
  "title" varchar,
  "amount" numeric,
  "currency" varchar DEFAULT 'USD'::character varying,
  "pipeline_id" uuid,
  "stage_id" uuid,
  "probability" integer DEFAULT 0,
  "close_date" date,
  "closed_at" timestamp,
  "won" boolean,
  "lost_reason" text,
  "commission_eligible" boolean DEFAULT true,
  "commission_split" jsonb,
  "tags" text[],
  "custom_fields" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "ai_win_probability" numeric,
  "ai_confidence_score" numeric,
  "ai_risk_factors" jsonb DEFAULT '[]'::jsonb,
  "ai_recommended_actions" jsonb DEFAULT '[]'::jsonb,
  "ai_predicted_close_date" date,
  "ai_score_updated_at" timestamptz,
  "ai_model_version" varchar,
  "user_id" uuid,
  "value" numeric DEFAULT 0.00,
  "stage" varchar DEFAULT 'Lead'::character varying,
  "win_probability" integer DEFAULT 0,
  "expected_close_date" date,
  "description" text,
  "assigned_to" uuid,
  "created_by" uuid,
  CONSTRAINT deals_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  "id" uuid DEFAULT gen_random_uuid(),
  "form_id" uuid,
  "contact_id" uuid,
  "data" jsonb,
  "ip_address" varchar,
  "user_agent" text,
  "referrer" text,
  "created_at" timestamp DEFAULT now(),
  "account_id" uuid,
  CONSTRAINT form_submissions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.activities (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "contact_id" uuid,
  "company_id" uuid,
  "deal_id" uuid,
  "user_id" uuid,
  "type" varchar,
  "subject" varchar,
  "body" text,
  "direction" varchar,
  "channel" varchar,
  "email_message_id" varchar,
  "email_thread_id" varchar,
  "email_from" varchar,
  "email_to" text[],
  "email_cc" text[],
  "email_bcc" text[],
  "email_headers" jsonb,
  "due_at" timestamp,
  "completed_at" timestamp,
  "assignee_user_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT activities_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.appointments (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "account_id" uuid,
  "contact_id" uuid,
  "company_id" uuid,
  "deal_id" uuid,
  "booked_by_user_id" uuid,
  "invitee_name" text,
  "invitee_email" text,
  "invitee_phone" text,
  "title" text,
  "description" text,
  "status" text DEFAULT 'scheduled'::text,
  "appointment_type" text DEFAULT 'call'::text,
  "start_time" timestamptz,
  "end_time" timestamptz,
  "timezone" text DEFAULT 'UTC'::text,
  "duration_minutes" integer,
  "location" text,
  "meeting_url" text,
  "calendly_event_uri" text,
  "calendly_invitee_uri" text,
  "calendly_event_type_uri" text,
  "calendly_cancel_url" text,
  "calendly_reschedule_url" text,
  "source" text DEFAULT 'manual'::text,
  "source_lead_id" uuid,
  "agent_conversation" jsonb DEFAULT '[]'::jsonb,
  "confirmation_sent_at" timestamptz,
  "reminder_sent_at" timestamptz,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT appointments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.campaign_emails (
  "id" uuid DEFAULT gen_random_uuid(),
  "campaign_id" uuid,
  "account_id" uuid,
  "contact_id" uuid,
  "recipient_email" text,
  "recipient_name" text,
  "subject" text,
  "body_html" text,
  "body_plain" text,
  "variant" text,
  "status" text DEFAULT 'pending'::text,
  "sent_at" timestamptz,
  "delivered_at" timestamptz,
  "opened_at" timestamptz,
  "clicked_at" timestamptz,
  "bounced_at" timestamptz,
  "unsubscribed_at" timestamptz,
  "sendgrid_message_id" text,
  "error_message" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT campaign_emails_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.commissions (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "deal_id" uuid,
  "user_id" uuid,
  "amount" numeric DEFAULT 0.00,
  "rate" numeric DEFAULT 0.00,
  "deal_value" numeric DEFAULT 0.00,
  "status" varchar DEFAULT 'pending'::character varying,
  "paid_at" timestamptz,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT commissions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.email_messages (
  "id" uuid DEFAULT gen_random_uuid(),
  "account_id" uuid,
  "thread_id" uuid,
  "message_id" text,
  "in_reply_to" text,
  "reference_headers" text[],
  "from_address" text,
  "from_name" text,
  "to_addresses" text[],
  "cc_addresses" text[],
  "bcc_addresses" text[],
  "subject" text,
  "body_plain" text,
  "body_html" text,
  "direction" text DEFAULT 'inbound'::text,
  "status" text DEFAULT 'received'::text,
  "error_message" text,
  "opened" boolean DEFAULT false,
  "opened_at" timestamptz,
  "clicks" integer DEFAULT 0,
  "contact_id" uuid,
  "company_id" uuid,
  "deal_id" uuid,
  "headers" jsonb,
  "received_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT email_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "account_id" uuid,
  "session_id" text,
  "source" text DEFAULT 'crm'::text,
  "lead_name" text,
  "lead_email" text,
  "lead_phone" text,
  "messages" jsonb DEFAULT '[]'::jsonb,
  "appointment_id" uuid,
  "status" text DEFAULT 'active'::text,
  CONSTRAINT agent_conversations_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 3. Foreign keys, unique constraints and check constraints (live).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_account_id_fkey' AND conrelid = 'public.companies'::regclass) THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_owner_user_id_fkey' AND conrelid = 'public.companies'::regclass) THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_account_id_fkey' AND conrelid = 'public.contacts'::regclass) THEN
    ALTER TABLE public.contacts ADD CONSTRAINT contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_company_id_fkey' AND conrelid = 'public.contacts'::regclass) THEN
    ALTER TABLE public.contacts ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_owner_user_id_fkey' AND conrelid = 'public.contacts'::regclass) THEN
    ALTER TABLE public.contacts ADD CONSTRAINT contacts_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_source_user_id_fkey' AND conrelid = 'public.contacts'::regclass) THEN
    ALTER TABLE public.contacts ADD CONSTRAINT contacts_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES users(id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipelines_account_id_fkey' AND conrelid = 'public.pipelines'::regclass) THEN
    ALTER TABLE public.pipelines ADD CONSTRAINT pipelines_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_pipeline_id_fkey' AND conrelid = 'public.pipeline_stages'::regclass) THEN
    ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_pipeline_id_position_key' AND conrelid = 'public.pipeline_stages'::regclass) THEN
    ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_pipeline_id_position_key UNIQUE (pipeline_id, "position");
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_account_id_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_assigned_to_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_company_id_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_contact_id_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_created_by_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_owner_user_id_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_pipeline_id_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_stage_check' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_stage_check CHECK (((stage)::text = ANY (ARRAY[('Lead'::character varying)::text, ('Qualified'::character varying)::text, ('Proposal'::character varying)::text, ('Negotiation'::character varying)::text, ('Won'::character varying)::text, ('Lost'::character varying)::text, ('lead'::character varying)::text, ('qualified'::character varying)::text, ('proposal'::character varying)::text, ('negotiation'::character varying)::text, ('won'::character varying)::text, ('lost'::character varying)::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_stage_id_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_user_id_fkey' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_win_probability_check' AND conrelid = 'public.deals'::regclass) THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_win_probability_check CHECK (((win_probability >= 0) AND (win_probability <= 100)));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_account_id_fkey' AND conrelid = 'public.activities'::regclass) THEN
    ALTER TABLE public.activities ADD CONSTRAINT activities_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_assignee_user_id_fkey' AND conrelid = 'public.activities'::regclass) THEN
    ALTER TABLE public.activities ADD CONSTRAINT activities_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES users(id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_company_id_fkey' AND conrelid = 'public.activities'::regclass) THEN
    ALTER TABLE public.activities ADD CONSTRAINT activities_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_contact_id_fkey' AND conrelid = 'public.activities'::regclass) THEN
    ALTER TABLE public.activities ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_deal_id_fkey' AND conrelid = 'public.activities'::regclass) THEN
    ALTER TABLE public.activities ADD CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_user_id_fkey' AND conrelid = 'public.activities'::regclass) THEN
    ALTER TABLE public.activities ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_account_id_fkey' AND conrelid = 'public.email_templates'::regclass) THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_created_by_user_id_fkey' AND conrelid = 'public.email_templates'::regclass) THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_account_id_fkey' AND conrelid = 'public.campaigns'::regclass) THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_created_by_user_id_fkey' AND conrelid = 'public.campaigns'::regclass) THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forms_account_id_fkey' AND conrelid = 'public.forms'::regclass) THEN
    ALTER TABLE public.forms ADD CONSTRAINT forms_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forms_created_by_user_id_fkey' AND conrelid = 'public.forms'::regclass) THEN
    ALTER TABLE public.forms ADD CONSTRAINT forms_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_account_id_fkey' AND conrelid = 'public.form_submissions'::regclass) THEN
    ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_contact_id_fkey' AND conrelid = 'public.form_submissions'::regclass) THEN
    ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_form_id_fkey' AND conrelid = 'public.form_submissions'::regclass) THEN
    ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_threads_account_id_fkey' AND conrelid = 'public.email_threads'::regclass) THEN
    ALTER TABLE public.email_threads ADD CONSTRAINT email_threads_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_account_id_fkey' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_company_id_fkey' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_contact_id_fkey' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_deal_id_fkey' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_direction_check' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_message_id_key' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_message_id_key UNIQUE (message_id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_status_check' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'error'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_thread_id_fkey' AND conrelid = 'public.email_messages'::regclass) THEN
    ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES email_threads(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_fields_field_type_check' AND conrelid = 'public.form_fields'::regclass) THEN
    ALTER TABLE public.form_fields ADD CONSTRAINT form_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'email'::text, 'phone'::text, 'number'::text, 'textarea'::text, 'select'::text, 'radio'::text, 'checkbox'::text, 'date'::text, 'time'::text, 'file'::text, 'url'::text, 'hidden'::text, 'rating'::text, 'slider'::text, 'address'::text, 'name'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_fields_form_id_fkey' AND conrelid = 'public.form_fields'::regclass) THEN
    ALTER TABLE public.form_fields ADD CONSTRAINT form_fields_form_id_fkey FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_fields_width_check' AND conrelid = 'public.form_fields'::regclass) THEN
    ALTER TABLE public.form_fields ADD CONSTRAINT form_fields_width_check CHECK ((width = ANY (ARRAY['full'::text, 'half'::text, 'third'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_emails_account_id_fkey' AND conrelid = 'public.campaign_emails'::regclass) THEN
    ALTER TABLE public.campaign_emails ADD CONSTRAINT campaign_emails_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_emails_campaign_id_fkey' AND conrelid = 'public.campaign_emails'::regclass) THEN
    ALTER TABLE public.campaign_emails ADD CONSTRAINT campaign_emails_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_emails_contact_id_fkey' AND conrelid = 'public.campaign_emails'::regclass) THEN
    ALTER TABLE public.campaign_emails ADD CONSTRAINT campaign_emails_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_emails_status_check' AND conrelid = 'public.campaign_emails'::regclass) THEN
    ALTER TABLE public.campaign_emails ADD CONSTRAINT campaign_emails_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'failed'::text, 'unsubscribed'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rates_account_id_fkey' AND conrelid = 'public.commission_rates'::regclass) THEN
    ALTER TABLE public.commission_rates ADD CONSTRAINT commission_rates_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rates_rate_check' AND conrelid = 'public.commission_rates'::regclass) THEN
    ALTER TABLE public.commission_rates ADD CONSTRAINT commission_rates_rate_check CHECK (((rate >= (0)::numeric) AND (rate <= (100)::numeric)));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rates_user_id_fkey' AND conrelid = 'public.commission_rates'::regclass) THEN
    ALTER TABLE public.commission_rates ADD CONSTRAINT commission_rates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_date_range' AND conrelid = 'public.commission_rates'::regclass) THEN
    ALTER TABLE public.commission_rates ADD CONSTRAINT valid_date_range CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_account_id_fkey' AND conrelid = 'public.commissions'::regclass) THEN
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_deal_id_fkey' AND conrelid = 'public.commissions'::regclass) THEN
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_status_check' AND conrelid = 'public.commissions'::regclass) THEN
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('paid'::character varying)::text, ('cancelled'::character varying)::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_user_id_fkey' AND conrelid = 'public.commissions'::regclass) THEN
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'industry_leads_account_id_fkey' AND conrelid = 'public.industry_leads'::regclass) THEN
    ALTER TABLE public.industry_leads ADD CONSTRAINT industry_leads_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'industry_leads_industry_check' AND conrelid = 'public.industry_leads'::regclass) THEN
    ALTER TABLE public.industry_leads ADD CONSTRAINT industry_leads_industry_check CHECK ((industry = ANY (ARRAY['hvac'::text, 'plumbing'::text, 'electrical'::text, 'smile'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'smile_assessments_account_id_fkey' AND conrelid = 'public.smile_assessments'::regclass) THEN
    ALTER TABLE public.smile_assessments ADD CONSTRAINT smile_assessments_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendly_connections_account_id_fkey' AND conrelid = 'public.calendly_connections'::regclass) THEN
    ALTER TABLE public.calendly_connections ADD CONSTRAINT calendly_connections_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendly_connections_user_id_fkey' AND conrelid = 'public.calendly_connections'::regclass) THEN
    ALTER TABLE public.calendly_connections ADD CONSTRAINT calendly_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendly_connections_user_id_key' AND conrelid = 'public.calendly_connections'::regclass) THEN
    ALTER TABLE public.calendly_connections ADD CONSTRAINT calendly_connections_user_id_key UNIQUE (user_id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_account_id_fkey' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_appointment_type_check' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_appointment_type_check CHECK ((appointment_type = ANY (ARRAY['call'::text, 'meeting'::text, 'video_call'::text, 'in_person'::text, 'other'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_booked_by_user_id_fkey' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_booked_by_user_id_fkey FOREIGN KEY (booked_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_company_id_fkey' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_contact_id_fkey' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_deal_id_fkey' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_source_check' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'ai_agent'::text, 'hvac'::text, 'plumbing'::text, 'electrical'::text, 'smile'::text, 'crm'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_status_check' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'rescheduled'::text, 'no_show'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_conversations_account_id_fkey' AND conrelid = 'public.agent_conversations'::regclass) THEN
    ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_conversations_appointment_id_fkey' AND conrelid = 'public.agent_conversations'::regclass) THEN
    ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_conversations_session_id_key' AND conrelid = 'public.agent_conversations'::regclass) THEN
    ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_session_id_key UNIQUE (session_id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_conversations_source_check' AND conrelid = 'public.agent_conversations'::regclass) THEN
    ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_source_check CHECK ((source = ANY (ARRAY['crm'::text, 'hvac'::text, 'plumbing'::text, 'electrical'::text, 'smile'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_conversations_status_check' AND conrelid = 'public.agent_conversations'::regclass) THEN
    ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'booked'::text, 'abandoned'::text, 'completed'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_subscriptions_account_id_fkey' AND conrelid = 'public.crm_subscriptions'::regclass) THEN
    ALTER TABLE public.crm_subscriptions ADD CONSTRAINT crm_subscriptions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_subscriptions_billing_check' AND conrelid = 'public.crm_subscriptions'::regclass) THEN
    ALTER TABLE public.crm_subscriptions ADD CONSTRAINT crm_subscriptions_billing_check CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_subscriptions_industry_check' AND conrelid = 'public.crm_subscriptions'::regclass) THEN
    ALTER TABLE public.crm_subscriptions ADD CONSTRAINT crm_subscriptions_industry_check CHECK ((industry = ANY (ARRAY['hvac'::text, 'plumbing'::text, 'electrical'::text, 'smile'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_subscriptions_plan_tier_check' AND conrelid = 'public.crm_subscriptions'::regclass) THEN
    ALTER TABLE public.crm_subscriptions ADD CONSTRAINT crm_subscriptions_plan_tier_check CHECK ((plan_tier = ANY (ARRAY['starter'::text, 'pro'::text, 'enterprise'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_subscriptions_status_check' AND conrelid = 'public.crm_subscriptions'::regclass) THEN
    ALTER TABLE public.crm_subscriptions ADD CONSTRAINT crm_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'incomplete'::text, 'trialing'::text, 'unpaid'::text])));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_subscriptions_stripe_subscription_id_key' AND conrelid = 'public.crm_subscriptions'::regclass) THEN
    ALTER TABLE public.crm_subscriptions ADD CONSTRAINT crm_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_billing_events_stripe_event_id_key' AND conrelid = 'public.crm_billing_events'::regclass) THEN
    ALTER TABLE public.crm_billing_events ADD CONSTRAINT crm_billing_events_stripe_event_id_key UNIQUE (stripe_event_id);
  END IF;
END $$;

-- ============================================================================
-- 4. Indexes (live where the audit captured them, else the repo definition).
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_activities_account_id ON public.activities (account_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities (deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_email_message_id ON public.activities (email_message_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities USING btree (account_id, type);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_status ON public.agent_conversations USING btree (status);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_calendly_connections_account_id ON public.calendly_connections (account_id);
CREATE INDEX IF NOT EXISTS idx_calendly_connections_user_id ON public.calendly_connections USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign_id ON public.campaign_emails (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_status ON public.campaign_emails USING btree (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON public.campaigns (account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns USING btree (account_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_rates_user_id ON public.commission_rates USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON public.commissions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_companies_account_id ON public.companies (account_id);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON public.companies (account_id, domain);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON public.contacts (account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON public.contacts (ai_conversion_score);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_segment ON public.contacts (ai_lead_segment);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_updated ON public.contacts (ai_score_updated_at);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON public.contacts (account_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_email ON public.contacts (account_id, normalized_email) WHERE (normalized_email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_e164 ON public.contacts USING btree (account_id, phone_e164) WHERE (phone_e164 IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_crm_billing_events_stripe_subscription_id ON public.crm_billing_events USING btree (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_user_id ON public.crm_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_deals_account_id ON public.deals (account_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON public.deals (assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON public.deals (account_id, close_date);
CREATE INDEX IF NOT EXISTS idx_deals_company ON public.deals (company_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON public.deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON public.deals (expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON public.deals (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON public.deals (pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals (stage);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals (user_id);
CREATE INDEX IF NOT EXISTS idx_deals_value ON public.deals USING btree (value);
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON public.email_messages (account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_subject ON public.email_messages (to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages USING btree (thread_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_account ON public.email_templates USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_account_id ON public.email_templates (account_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_account_id ON public.email_threads (account_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_subject ON public.email_threads USING gin (to_tsvector('english'::regconfig, subject));
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON public.form_fields (form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON public.form_fields USING btree (form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_form_submissions_account_id ON public.form_submissions (account_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON public.form_submissions USING btree (form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON public.form_submissions (form_id);
CREATE INDEX IF NOT EXISTS idx_forms_account_id ON public.forms USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON public.pipeline_stages (pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_account_id ON public.pipelines (account_id);

-- ============================================================================
-- 5. Functions (live bodies). handle_new_user() is deliberately excluded,
--    and so is update_client_domain_change_requests_updated_at (029 owns that table).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_conversation_message(p_conversation_id uuid, p_role text, p_content text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.agent_conversations
  SET messages = messages || jsonb_build_object(
    'role', p_role,
    'content', p_content,
    'timestamp', NOW()::text,
    'metadata', COALESCE(p_metadata, '{}'::jsonb)
  )
  WHERE id = p_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.associate_email_with_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rate DECIMAL(5,2);
    v_amount DECIMAL(12,2);
    v_user_id UUID;
BEGIN
    -- Only create commission when deal is marked as won (case-insensitive)
    IF LOWER(NEW.stage) = 'won' AND (OLD.stage IS NULL OR LOWER(OLD.stage) != 'won') THEN
        -- Get the user who owns the deal (assigned_to or user_id or owner_user_id)
        v_user_id := COALESCE(NEW.assigned_to, NEW.user_id, NEW.owner_user_id);
        
        IF v_user_id IS NOT NULL THEN
            -- Get active commission rate for the user
            v_rate := get_active_commission_rate(v_user_id, CURRENT_DATE);
            
            -- Calculate commission amount using the new value column
            v_amount := calculate_commission_amount(NEW.value, v_rate);
            
            -- Create commission record
            INSERT INTO commissions (
                account_id,
                deal_id,
                user_id,
                amount,
                rate,
                deal_value,
                status
            ) VALUES (
                NEW.account_id,
                NEW.id,
                v_user_id,
                v_amount,
                v_rate,
                NEW.value,
                'pending'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_commission_amount(p_deal_value numeric, p_rate numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN ROUND(p_deal_value * (p_rate / 100), 2);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE accounts
    SET onboarding_completed = true,
        onboarding_completed_at = NOW(),
        onboarding_step = 5
    WHERE id = p_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_commission_rate(p_user_id uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rate DECIMAL(5,2);
BEGIN
    SELECT rate INTO v_rate
    FROM commission_rates
    WHERE user_id = p_user_id
        AND is_active = true
        AND effective_from <= p_date
        AND (effective_to IS NULL OR effective_to >= p_date)
    ORDER BY effective_from DESC
    LIMIT 1;
    
    RETURN COALESCE(v_rate, 0.00);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_account_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_account_id uuid;
BEGIN
    SELECT account_id INTO v_account_id
    FROM public.users
    WHERE id = auth.uid() OR email = auth.jwt() ->> 'email'
    LIMIT 1;
    RETURN v_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE id = auth.uid() OR email = auth.jwt() ->> 'email'
    LIMIT 1;
    RETURN v_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_session_id text, p_source text, p_account_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.agent_conversations
  WHERE session_id = p_session_id
    AND source = p_source
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If not found, create new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.agent_conversations (
      session_id,
      source,
      account_id,
      messages,
      status
    )
    VALUES (
      p_session_id,
      p_source,
      p_account_id,
      '[]'::jsonb,
      'active'
    )
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_smile_account_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    user_account_id UUID;
BEGIN
    SET LOCAL row_security = off;
    SELECT account_id INTO user_account_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    RETURN user_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_smile_pool_account_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN '00000000-0000-4000-a000-000000000004'::UUID;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_industry_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.set_crm_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'public', 'extensions', 'auth'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.skip_onboarding(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE accounts
    SET onboarding_skipped = true,
        onboarding_completed = true,
        onboarding_completed_at = NOW()
    WHERE id = p_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_smile_assessment_with_pool(p_auth_user_id uuid, p_patient_name text, p_patient_email text, p_patient_phone text DEFAULT NULL::text, p_patient_dob date DEFAULT NULL::date, p_dentist_name text DEFAULT NULL::text, p_last_dental_visit text DEFAULT NULL::text, p_dental_insurance boolean DEFAULT false, p_insurance_provider text DEFAULT NULL::text, p_current_concerns text DEFAULT NULL::text, p_pain_sensitivity text DEFAULT NULL::text, p_smile_goals text[] DEFAULT '{}'::text[], p_desired_outcome text DEFAULT NULL::text, p_medical_conditions text[] DEFAULT '{}'::text[], p_medications text DEFAULT NULL::text, p_allergies text DEFAULT NULL::text, p_status text DEFAULT 'pending'::text, p_account_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_account_id UUID;
    v_assessment_id UUID;
BEGIN
    IF p_account_id IS NULL THEN
        v_account_id := get_smile_pool_account_id();
    ELSE
        v_account_id := p_account_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = v_account_id) THEN
        RAISE EXCEPTION 'Account not found';
    END IF;
    
    INSERT INTO public.smile_assessments (
        account_id, auth_user_id, patient_name, patient_email, patient_phone, 
        patient_dob, dentist_name, last_dental_visit, dental_insurance, 
        insurance_provider, current_concerns, pain_sensitivity, smile_goals, 
        desired_outcome, medical_conditions, medications, allergies, status
    ) VALUES (
        v_account_id, p_auth_user_id, p_patient_name, p_patient_email, p_patient_phone, 
        p_patient_dob, p_dentist_name, p_last_dental_visit, p_dental_insurance, 
        p_insurance_provider, p_current_concerns, p_pain_sensitivity, p_smile_goals, 
        p_desired_outcome, p_medical_conditions, p_medications, p_allergies, p_status
    )
    RETURNING id INTO v_assessment_id;
    
    RETURN v_assessment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_agent_conversations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_commission_on_deal_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_commission_id UUID;
    v_new_amount DECIMAL(12,2);
BEGIN
    -- Only update if deal is won and value changed (case-insensitive)
    IF LOWER(NEW.stage) = 'won' AND NEW.value != OLD.value THEN
        -- Find existing commission for this deal
        SELECT id INTO v_commission_id
        FROM commissions
        WHERE deal_id = NEW.id
            AND status = 'pending'
        LIMIT 1;
        
        IF v_commission_id IS NOT NULL THEN
            -- Recalculate commission amount
            SELECT calculate_commission_amount(NEW.value, rate)
            INTO v_new_amount
            FROM commissions
            WHERE id = v_commission_id;
            
            -- Update commission
            UPDATE commissions
            SET amount = v_new_amount,
                deal_value = NEW.value,
                updated_at = NOW()
            WHERE id = v_commission_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_commission_rates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_commissions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_company_info(p_account_id uuid, p_name character varying, p_company_size character varying, p_industry character varying, p_website character varying, p_phone character varying, p_address text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE accounts
    SET name = p_name,
        company_size = p_company_size,
        industry = p_industry,
        website = p_website,
        phone = p_phone,
        address = p_address,
        onboarding_step = 2
    WHERE id = p_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_conversation_status(p_conversation_id uuid, p_status text, p_appointment_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.agent_conversations
  SET 
    status = p_status,
    appointment_id = COALESCE(p_appointment_id, appointment_id)
  WHERE id = p_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_onboarding_step(p_account_id uuid, p_step integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE accounts
    SET onboarding_step = p_step
    WHERE id = p_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_preferences(p_account_id uuid, p_timezone character varying, p_settings jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE accounts
    SET timezone = p_timezone,
        settings = p_settings
    WHERE id = p_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_thread_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- ============================================================================
-- 6. Table triggers (live).
-- ============================================================================
DROP TRIGGER IF EXISTS on_agent_conversation_updated ON public.agent_conversations;
CREATE TRIGGER on_agent_conversation_updated BEFORE UPDATE ON public.agent_conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trigger_update_agent_conversations_updated_at ON public.agent_conversations;
CREATE TRIGGER trigger_update_agent_conversations_updated_at BEFORE UPDATE ON public.agent_conversations FOR EACH ROW EXECUTE FUNCTION public.update_agent_conversations_updated_at();
DROP TRIGGER IF EXISTS on_appointment_updated ON public.appointments;
CREATE TRIGGER on_appointment_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_calendly_connection_updated ON public.calendly_connections;
CREATE TRIGGER on_calendly_connection_updated BEFORE UPDATE ON public.calendly_connections FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trigger_update_commission_rates_updated_at ON public.commission_rates;
CREATE TRIGGER trigger_update_commission_rates_updated_at BEFORE UPDATE ON public.commission_rates FOR EACH ROW EXECUTE FUNCTION public.update_commission_rates_updated_at();
DROP TRIGGER IF EXISTS trigger_update_commissions_updated_at ON public.commissions;
CREATE TRIGGER trigger_update_commissions_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_commissions_updated_at();
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_crm_subscriptions_updated_at ON public.crm_subscriptions;
CREATE TRIGGER trg_crm_subscriptions_updated_at BEFORE UPDATE ON public.crm_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_crm_subscriptions_updated_at();
DROP TRIGGER IF EXISTS trigger_auto_create_commission ON public.deals;
CREATE TRIGGER trigger_auto_create_commission AFTER INSERT OR UPDATE OF stage ON public.deals FOR EACH ROW EXECUTE FUNCTION public.auto_create_commission();
DROP TRIGGER IF EXISTS trigger_update_commission_on_deal_change ON public.deals;
CREATE TRIGGER trigger_update_commission_on_deal_change AFTER UPDATE OF value ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_commission_on_deal_change();
DROP TRIGGER IF EXISTS update_deals_updated_at ON public.deals;
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trigger_associate_email_with_contact ON public.email_messages;
CREATE TRIGGER trigger_associate_email_with_contact BEFORE INSERT ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.associate_email_with_contact();
DROP TRIGGER IF EXISTS trigger_update_thread_stats ON public.email_messages;
CREATE TRIGGER trigger_update_thread_stats AFTER INSERT OR DELETE ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.update_thread_stats();
DROP TRIGGER IF EXISTS update_email_messages_updated_at ON public.email_messages;
CREATE TRIGGER update_email_messages_updated_at BEFORE UPDATE ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_email_threads_updated_at ON public.email_threads;
CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON public.email_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_forms_updated_at ON public.forms;
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS on_industry_leads_updated ON public.industry_leads;
CREATE TRIGGER on_industry_leads_updated BEFORE UPDATE ON public.industry_leads FOR EACH ROW EXECUTE FUNCTION public.handle_industry_updated_at();
DROP TRIGGER IF EXISTS update_pipelines_updated_at ON public.pipelines;
CREATE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON public.pipelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS on_smile_assessment_updated ON public.smile_assessments;
CREATE TRIGGER on_smile_assessment_updated BEFORE UPDATE ON public.smile_assessments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 7. Row level security and policies (live).
--    rankedceo-waas also auto-enables RLS on new public tables (event trigger),
--    so every table needs its policies in the same change.
-- ============================================================================
ALTER TABLE public.crm_billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendly_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smile_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own activities" ON public.activities;
CREATE POLICY "Users manage own activities" ON public.activities FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own agent history" ON public.agent_conversations;
CREATE POLICY "Users can view own agent history" ON public.agent_conversations FOR SELECT TO public USING (((auth.uid())::text = (account_id)::text));
DROP POLICY IF EXISTS "Users manage own appointments" ON public.appointments;
CREATE POLICY "Users manage own appointments" ON public.appointments FOR ALL TO public USING ((auth.uid() = booked_by_user_id));
DROP POLICY IF EXISTS "Users can manage their own Calendly connection" ON public.calendly_connections;
CREATE POLICY "Users can manage their own Calendly connection" ON public.calendly_connections FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.campaign_emails;
CREATE POLICY "manage_account_data_non_recursive" ON public.campaign_emails FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.campaign_emails;
CREATE POLICY "view_account_data_non_recursive" ON public.campaign_emails FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.campaigns;
CREATE POLICY "manage_account_data_non_recursive" ON public.campaigns FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.campaigns;
CREATE POLICY "view_account_data_non_recursive" ON public.campaigns FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can manage account commission rates" ON public.commission_rates;
CREATE POLICY "Users can manage account commission rates" ON public.commission_rates FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can view account commission rates" ON public.commission_rates;
CREATE POLICY "Users can view account commission rates" ON public.commission_rates FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can manage account commissions" ON public.commissions;
CREATE POLICY "Users can manage account commissions" ON public.commissions FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can view account commissions" ON public.commissions;
CREATE POLICY "Users can view account commissions" ON public.commissions FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can manage account data" ON public.companies;
CREATE POLICY "Users can manage account data" ON public.companies FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can view account data" ON public.companies;
CREATE POLICY "Users can view account data" ON public.companies FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.companies;
CREATE POLICY "manage_account_data_non_recursive" ON public.companies FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.companies;
CREATE POLICY "view_account_data_non_recursive" ON public.companies FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can manage account data" ON public.contacts;
CREATE POLICY "Users can manage account data" ON public.contacts FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can view account data" ON public.contacts;
CREATE POLICY "Users can view account data" ON public.contacts FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.contacts;
CREATE POLICY "manage_account_data_non_recursive" ON public.contacts FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.contacts;
CREATE POLICY "view_account_data_non_recursive" ON public.contacts FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Service role manages crm_billing_events" ON public.crm_billing_events;
CREATE POLICY "Service role manages crm_billing_events" ON public.crm_billing_events FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "CRM users can manage own subscriptions" ON public.crm_subscriptions;
CREATE POLICY "CRM users can manage own subscriptions" ON public.crm_subscriptions FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "CRM users can view own subscriptions" ON public.crm_subscriptions;
CREATE POLICY "CRM users can view own subscriptions" ON public.crm_subscriptions FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role manages crm_subscriptions" ON public.crm_subscriptions;
CREATE POLICY "Service role manages crm_subscriptions" ON public.crm_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can manage account data" ON public.deals;
CREATE POLICY "Users can manage account data" ON public.deals FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can view account data" ON public.deals;
CREATE POLICY "Users can view account data" ON public.deals FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.deals;
CREATE POLICY "manage_account_data_non_recursive" ON public.deals FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.deals;
CREATE POLICY "view_account_data_non_recursive" ON public.deals FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.email_messages;
CREATE POLICY "manage_account_data_non_recursive" ON public.email_messages FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.email_messages;
CREATE POLICY "view_account_data_non_recursive" ON public.email_messages FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.email_templates;
CREATE POLICY "manage_account_data_non_recursive" ON public.email_templates FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.email_templates;
CREATE POLICY "view_account_data_non_recursive" ON public.email_templates FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.email_threads;
CREATE POLICY "manage_account_data_non_recursive" ON public.email_threads FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.email_threads;
CREATE POLICY "view_account_data_non_recursive" ON public.email_threads FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can delete fields for their account's forms" ON public.form_fields;
CREATE POLICY "Users can delete fields for their account's forms" ON public.form_fields FOR DELETE TO public USING ((form_id IN (SELECT forms.id FROM forms WHERE forms.account_id IN (SELECT users.account_id FROM users WHERE users.email = (SELECT email FROM auth.users WHERE id = auth.uid())))));
DROP POLICY IF EXISTS "Users can insert fields for their account's forms" ON public.form_fields;
CREATE POLICY "Users can insert fields for their account's forms" ON public.form_fields FOR INSERT TO public WITH CHECK ((form_id IN (SELECT forms.id FROM forms WHERE forms.account_id IN (SELECT users.account_id FROM users WHERE users.email = (SELECT email FROM auth.users WHERE id = auth.uid())))));
DROP POLICY IF EXISTS "Users can update fields for their account's forms" ON public.form_fields;
CREATE POLICY "Users can update fields for their account's forms" ON public.form_fields FOR UPDATE TO public USING ((form_id IN (SELECT forms.id FROM forms WHERE forms.account_id IN (SELECT users.account_id FROM users WHERE users.email = (SELECT email FROM auth.users WHERE id = auth.uid())))));
DROP POLICY IF EXISTS "Users can view fields for their account's forms" ON public.form_fields;
CREATE POLICY "Users can view fields for their account's forms" ON public.form_fields FOR SELECT TO public USING ((form_id IN (SELECT forms.id FROM forms WHERE forms.account_id IN (SELECT users.account_id FROM users WHERE users.email = (SELECT email FROM auth.users WHERE id = auth.uid())))));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.form_submissions;
CREATE POLICY "manage_account_data_non_recursive" ON public.form_submissions FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.form_submissions;
CREATE POLICY "view_account_data_non_recursive" ON public.form_submissions FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.forms;
CREATE POLICY "manage_account_data_non_recursive" ON public.forms FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.forms;
CREATE POLICY "view_account_data_non_recursive" ON public.forms FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users see own leads" ON public.industry_leads;
CREATE POLICY "Users see own leads" ON public.industry_leads FOR ALL TO public USING ((auth.uid() = auth_user_id));
DROP POLICY IF EXISTS "Users can delete pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can delete pipeline stages in their account" ON public.pipeline_stages FOR DELETE TO authenticated USING ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "Users can insert pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can insert pipeline stages in their account" ON public.pipeline_stages FOR INSERT TO authenticated WITH CHECK ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "Users can update pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can update pipeline stages in their account" ON public.pipeline_stages FOR UPDATE TO authenticated USING ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid())))) WITH CHECK ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "Users can view pipeline stages in their account" ON public.pipeline_stages;
CREATE POLICY "Users can view pipeline stages in their account" ON public.pipeline_stages FOR SELECT TO authenticated USING ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "pipeline_stages_delete" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages FOR DELETE TO public USING ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "pipeline_stages_insert" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages FOR INSERT TO public WITH CHECK ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages FOR SELECT TO public USING ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "pipeline_stages_update" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages FOR UPDATE TO public USING ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid())))) WITH CHECK ((pipeline_id IN (SELECT pipelines.id FROM pipelines WHERE pipelines.account_id IN (SELECT users.account_id FROM users WHERE users.id = auth.uid()))));
DROP POLICY IF EXISTS "Users can manage account data" ON public.pipelines;
CREATE POLICY "Users can manage account data" ON public.pipelines FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Users can view account data" ON public.pipelines;
CREATE POLICY "Users can view account data" ON public.pipelines FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "manage_account_data_non_recursive" ON public.pipelines;
CREATE POLICY "manage_account_data_non_recursive" ON public.pipelines FOR ALL TO authenticated USING ((account_id = get_current_user_account_id())) WITH CHECK ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "view_account_data_non_recursive" ON public.pipelines;
CREATE POLICY "view_account_data_non_recursive" ON public.pipelines FOR SELECT TO authenticated USING ((account_id = get_current_user_account_id()));
DROP POLICY IF EXISTS "Public intake blind insert" ON public.smile_assessments;
CREATE POLICY "Public intake blind insert" ON public.smile_assessments FOR INSERT TO anon WITH CHECK ((account_id = '00000000-0000-4000-a000-000000000004'::uuid));
DROP POLICY IF EXISTS "Staff account isolation" ON public.smile_assessments;
CREATE POLICY "Staff account isolation" ON public.smile_assessments FOR ALL TO authenticated USING ((account_id = (SELECT users.account_id FROM users WHERE smile_assessments.auth_user_id = auth.uid() LIMIT 1)));

-- ============================================================================
-- ROLLBACK (run only if needed; commented out on purpose).
-- Reverse order of creation: dropping a table takes its triggers, policies,
-- indexes and FKs with it, so drop the tables first, then the functions.
-- The accounts/users columns added in section 1 are left in place on purpose:
-- dropping them could destroy data the app has written since.
-- update_updated_at_column() is NOT dropped: it pre-exists in
-- 027_baseline_accounts_users.sql and backs the accounts/users triggers; 030
-- only replaced it (same body, adds SET search_path). Re-run 027's CREATE OR
-- REPLACE FUNCTION to restore the 027 version.
--
--   DROP TABLE IF EXISTS public.agent_conversations;
--   DROP TABLE IF EXISTS public.email_messages;
--   DROP TABLE IF EXISTS public.commissions;
--   DROP TABLE IF EXISTS public.campaign_emails;
--   DROP TABLE IF EXISTS public.appointments;
--   DROP TABLE IF EXISTS public.activities;
--   DROP TABLE IF EXISTS public.form_submissions;
--   DROP TABLE IF EXISTS public.deals;
--   DROP TABLE IF EXISTS public.form_fields;
--   DROP TABLE IF EXISTS public.contacts;
--   DROP TABLE IF EXISTS public.campaigns;
--   DROP TABLE IF EXISTS public.smile_assessments;
--   DROP TABLE IF EXISTS public.pipeline_stages;
--   DROP TABLE IF EXISTS public.industry_leads;
--   DROP TABLE IF EXISTS public.forms;
--   DROP TABLE IF EXISTS public.email_templates;
--   DROP TABLE IF EXISTS public.crm_subscriptions;
--   DROP TABLE IF EXISTS public.companies;
--   DROP TABLE IF EXISTS public.commission_rates;
--   DROP TABLE IF EXISTS public.calendly_connections;
--   DROP TABLE IF EXISTS public.email_threads;
--   DROP TABLE IF EXISTS public.pipelines;
--   DROP TABLE IF EXISTS public.crm_billing_events;
--
--   DROP TABLE IF EXISTS public.agent_conversations;
--   DROP TABLE IF EXISTS public.email_messages;
--   DROP TABLE IF EXISTS public.commissions;
--   DROP TABLE IF EXISTS public.campaign_emails;
--   DROP TABLE IF EXISTS public.appointments;
--   DROP TABLE IF EXISTS public.activities;
--   DROP TABLE IF EXISTS public.form_submissions;
--   DROP TABLE IF EXISTS public.deals;
--   DROP TABLE IF EXISTS public.form_fields;
--   DROP TABLE IF EXISTS public.contacts;
--   DROP TABLE IF EXISTS public.campaigns;
--   DROP TABLE IF EXISTS public.smile_assessments;
--   DROP TABLE IF EXISTS public.pipeline_stages;
--   DROP TABLE IF EXISTS public.industry_leads;
--   DROP TABLE IF EXISTS public.forms;
--   DROP TABLE IF EXISTS public.email_templates;
--   DROP TABLE IF EXISTS public.crm_subscriptions;
--   DROP TABLE IF EXISTS public.companies;
--   DROP TABLE IF EXISTS public.commission_rates;
--   DROP TABLE IF EXISTS public.calendly_connections;
--   DROP TABLE IF EXISTS public.email_threads;
--   DROP TABLE IF EXISTS public.pipelines;
--   DROP TABLE IF EXISTS public.crm_billing_events;
--
--   -- Functions: drop by name (a bare name() misses any that take args).
--   DO $$
--   DECLARE r record;
--   BEGIN
--     FOR r IN
--       SELECT p.oid::regprocedure::text AS sig
--       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname IN (
--         'add_conversation_message', 'associate_email_with_contact', 'auto_create_commission', 'calculate_commission_amount',
--         'complete_onboarding', 'get_active_commission_rate', 'get_current_user_account_id', 'get_current_user_id',
--         'get_or_create_conversation', 'get_smile_account_id', 'get_smile_pool_account_id', 'handle_industry_updated_at',
--         'handle_updated_at', 'set_crm_subscriptions_updated_at', 'set_updated_at', 'skip_onboarding',
--         'submit_smile_assessment_with_pool', 'update_agent_conversations_updated_at', 'update_commission_on_deal_change', 'update_commission_rates_updated_at',
--         'update_commissions_updated_at', 'update_company_info', 'update_conversation_status', 'update_onboarding_step',
--         'update_preferences', 'update_thread_stats'
--       )
--     LOOP
--       EXECUTE 'DROP FUNCTION ' || r.sig;
--     END LOOP;
--   END $$;
-- ============================================================================
