-- =============================================================================
-- WaaS Preflight: Create ENUMs (must run separately before main migration)
-- PostgreSQL requires enum values to be committed before they can be used
-- Run this FIRST in your Supabase SQL Editor, then run 000b_waas_main.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Create all ENUM types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE waas_package_tier AS ENUM (
    'hosting',    -- Basic hosting only, no SEO tools
    'standard',   -- Hosting + SEO audit tool + basic reporting
    'premium'     -- Hosting + full SEO suite + AI insights + white-label
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_tenant_status AS ENUM (
    'onboarding',   -- Tenant created, setup not complete
    'active',       -- Live and serving traffic
    'suspended',    -- Temporarily disabled (e.g., payment lapsed)
    'cancelled'     -- Permanently deactivated
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_audit_status AS ENUM (
    'pending',      -- Audit requested, not yet started
    'running',      -- SEO crawl/analysis in progress
    'completed',    -- Report data populated, ready to view
    'failed',       -- Audit encountered an error
    'expired'       -- Past expires_at, archived
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_audit_type AS ENUM (
    'prospect',     -- Pre-sale audit of a prospect's site (no tenant yet)
    'tenant',       -- Ongoing audit of a tenant's own site
    'competitor'    -- Audit of a competitor's site
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_lead_status AS ENUM (
    'new',          -- Just captured via email form
    'contacted',    -- Darrick/team has reached out
    'qualified',    -- Confirmed interest + budget
    'converted',    -- Became a paying customer
    'lost'          -- No longer interested
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_lead_source AS ENUM (
    'audit_tool',       -- Submitted URL for audit
    'email_capture',    -- Entered email to get report
    'onboarding',       -- Started onboarding flow
    'referral',         -- Referred by existing customer
    'manual'            -- Added manually by admin
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE waas_domain_status AS ENUM (
    'requested',    -- User submitted, pending review
    'searching',    -- Looking for availability
    'available',    -- Domain is available to register
    'unavailable',  -- Domain is taken
    'registered',   -- We registered it successfully
    'failed'        -- Registration failed
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Add pending_review to waas_tenant_status (Phase 3)
-- This MUST be committed before it can be used in table definitions
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TYPE waas_tenant_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'onboarding';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

-- =============================================================================
-- DONE. Now run 000b_waas_main.sql to create tables, indexes, and functions
-- =============================================================================