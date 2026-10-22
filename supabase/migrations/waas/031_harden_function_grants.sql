-- 031_harden_function_grants.sql
-- Project: rankedceo-waas (klgvdvryewykzlumbkei). Apply by hand, like 030.
-- Idempotent: safe to run twice.
--
-- Why: 030 section 7b only revoked from PUBLIC. Supabase grants EXECUTE on new
-- functions in public to anon, authenticated and service_role by default, so
-- every SECURITY DEFINER function stayed callable by anon. Verified live on
-- 2026-10-21: anon_exec = true on all 25 SECURITY DEFINER functions.
--
-- This migration:
--   1. stops future functions in public from being anon-callable by default
--   2. revokes EXECUTE from anon on everything that does not need it
--   3. gives the four onboarding RPCs the same ownership check complete_onboarding has
--   4. removes TRUNCATE / REFERENCES / TRIGGER from anon and authenticated
--      (RLS cannot gate TRUNCATE)
--
-- Functions are matched by name, not by signature, so a function that exists
-- in the live project but not in 030 (handle_user_delete) is handled too, and a
-- missing one cannot abort the migration.
--
-- Not touched: handle_new_user() body (belongs to the other product), and the
-- public smile-assessment functions (no caller in this repo; changing them
-- blind could break the other product).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Default privileges for functions created later by postgres in public
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Ownership helper + the four onboarding RPCs
--    Same rule complete_onboarding already uses: derive the account from the
--    caller's JWT, never trust p_account_id on its own.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_own_account(p_account_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_role text;
    v_account_id uuid;
BEGIN
    -- Service-role callers (server-side jobs) are trusted.
    v_role := COALESCE(
        current_setting('request.jwt.claim.role', true),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role'
    );

    IF v_role = 'service_role' THEN
        IF p_account_id IS NULL THEN
            RAISE EXCEPTION 'p_account_id is required';
        END IF;
        RETURN p_account_id;
    END IF;

    v_account_id := public.get_current_user_account_id();

    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_account_id IS NOT NULL AND p_account_id <> v_account_id THEN
        RAISE EXCEPTION 'Cannot modify another account';
    END IF;

    RETURN v_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_company_info(p_account_id uuid, p_name character varying, p_company_size character varying, p_industry character varying, p_website character varying, p_phone character varying, p_address text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_account_id uuid;
BEGIN
    v_account_id := public.assert_own_account(p_account_id);

    UPDATE accounts
    SET name = p_name,
        company_size = p_company_size,
        industry = p_industry,
        website = p_website,
        phone = p_phone,
        address = p_address,
        onboarding_step = 2
    WHERE id = v_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_onboarding_step(p_account_id uuid, p_step integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_account_id uuid;
BEGIN
    v_account_id := public.assert_own_account(p_account_id);

    UPDATE accounts
    SET onboarding_step = p_step
    WHERE id = v_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.skip_onboarding(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_account_id uuid;
BEGIN
    v_account_id := public.assert_own_account(p_account_id);

    UPDATE accounts
    SET onboarding_skipped = true,
        onboarding_completed = true,
        onboarding_completed_at = NOW()
    WHERE id = v_account_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_preferences(p_account_id uuid, p_timezone character varying, p_settings jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_account_id uuid;
BEGIN
    v_account_id := public.assert_own_account(p_account_id);

    UPDATE accounts
    SET timezone = p_timezone,
        settings = p_settings
    WHERE id = v_account_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Revoke EXECUTE from anon (and PUBLIC) on everything that should not be
--    reachable without a session. authenticated keeps its grant where needed
--    (section 4); service_role bypasses privileges anyway but is granted
--    explicitly for clarity.
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
    v_names text[] := ARRAY[
        -- trigger functions: never callable through the API
        'handle_new_user', 'handle_updated_at', 'handle_user_delete',
        'auto_create_commission', 'update_commission_on_deal_change',
        'expire_old_audits', 'rls_auto_enable',
        -- audit funnel: called with the service-role key only
        'capture_audit_lead', 'create_prospect_audit', 'get_audit_status',
        -- account-scoped helpers and RPCs
        'get_current_user_id', 'get_current_user_account_id',
        'get_active_commission_rate',
        'add_conversation_message', 'get_or_create_conversation',
        'update_conversation_status',
        'complete_onboarding', 'update_company_info', 'update_onboarding_step',
        'skip_onboarding', 'update_preferences', 'assert_own_account'
    ];
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY (v_names)
    LOOP
        -- authenticated is revoked too: the earlier waas migrations granted it
        -- directly, and section 4 grants it back only for the v_authed list.
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 4. Grant back to the roles that actually call each function
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
    v_authed text[] := ARRAY[
        'get_current_user_id', 'get_current_user_account_id',
        'get_active_commission_rate',
        'add_conversation_message', 'get_or_create_conversation',
        'update_conversation_status',
        'complete_onboarding', 'update_company_info', 'update_onboarding_step',
        'skip_onboarding', 'update_preferences', 'assert_own_account'
    ];
    v_service text[] := ARRAY[
        'capture_audit_lead', 'create_prospect_audit', 'get_audit_status',
        'get_current_user_id', 'get_current_user_account_id',
        'get_active_commission_rate',
        'add_conversation_message', 'get_or_create_conversation',
        'update_conversation_status',
        'complete_onboarding', 'update_company_info', 'update_onboarding_step',
        'skip_onboarding', 'update_preferences', 'assert_own_account'
    ];
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY (v_authed)
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END LOOP;

    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY (v_service)
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END LOOP;
END
$do$;

-- Tenant resolution keeps anon: resolveTenantByHostname falls back to the anon
-- key when the service key is absent. Read-only lookup by hostname.
DO $do$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'resolve_tenant_by_hostname'
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);
    END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 5. TRUNCATE / REFERENCES / TRIGGER are in the default table grant and RLS
--    cannot gate TRUNCATE. PostgREST never uses any of the three.
-- ---------------------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

COMMIT;
