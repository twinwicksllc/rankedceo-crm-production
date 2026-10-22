-- 032_revoke_smile_pool_rpc.sql
-- Project: rankedceo-waas (klgvdvryewykzlumbkei). Apply by hand, like 030 and 031.
-- Idempotent: safe to run twice.
--
-- Why (E3 decision D5, option B): submit_smile_assessment_with_pool() is
-- SECURITY DEFINER, accepts p_account_id, and checks only that the account
-- exists. 030 granted it to anon, so anyone holding the public anon key could
-- write a patient record (contact details, medical conditions, medications)
-- into any account, bypassing the smile_assessments anon policy, which only
-- allows the smile pool account. No code calls it: not this repo or its
-- history, and no other twinwicksllc repo. This repo writes assessments through
-- the table and its RLS policies instead (lib/actions/smile-assessment.ts).
--
-- This migration:
--   1. submit_smile_assessment_with_pool: removes EXECUTE from PUBLIC, anon and
--      authenticated; keeps it for service_role only.
--   2. get_smile_account_id: removes EXECUTE from PUBLIC and anon; keeps it for
--      authenticated and service_role, which is what 030 granted. Supabase's
--      default ACL also gave anon a direct grant, and 031 left the smile
--      functions alone. For anon it returns NULL (auth.uid() is NULL), and no
--      policy or code calls it, so this only removes noise.
-- Function bodies are not changed. Matched by name, so a missing function or a
-- different signature cannot abort it.
--
-- Not touched: handle_new_user(), any auth.users trigger,
-- get_smile_pool_account_id (stays anon-callable; it returns the fixed pool id),
-- and the smile_assessments RLS policies.

BEGIN;

DO $do$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'submit_smile_assessment_with_pool'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END LOOP;

    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_smile_account_id'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END LOOP;
END
$do$;

COMMIT;

-- ============================================================================
-- ROLLBACK (run only if needed; commented out on purpose). Restores the grants
-- as they were before 032, including the anon exposure this migration closes.
-- ============================================================================
-- BEGIN;
-- DO $do$
-- DECLARE r record;
-- BEGIN
--     FOR r IN
--         SELECT p.oid::regprocedure AS sig
--         FROM pg_proc p
--         JOIN pg_namespace n ON n.oid = p.pronamespace
--         WHERE n.nspname = 'public' AND p.proname = 'submit_smile_assessment_with_pool'
--     LOOP
--         EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);
--     END LOOP;
--     FOR r IN
--         SELECT p.oid::regprocedure AS sig
--         FROM pg_proc p
--         JOIN pg_namespace n ON n.oid = p.pronamespace
--         WHERE n.nspname = 'public' AND p.proname = 'get_smile_account_id'
--     LOOP
--         EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
--     END LOOP;
-- END
-- $do$;
-- COMMIT;
