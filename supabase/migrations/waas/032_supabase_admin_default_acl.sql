-- 032: close the second default-ACL row for functions in public.
--
-- WHY THIS EXISTS
-- 031 revoked EXECUTE on future public functions from anon/authenticated/PUBLIC,
-- but ALTER DEFAULT PRIVILEGES is scoped to the role that will own the object.
-- 031 only did this FOR ROLE postgres. The live pg_default_acl read-back after
-- applying 031 showed two rows for schema public, object type f:
--
--   postgres,public,f,"{postgres=X/postgres,service_role=X/postgres}"          <- fixed by 031
--   supabase_admin,public,f,"{postgres=X/supabase_admin,anon=X/supabase_admin,
--                             authenticated=X/supabase_admin,service_role=X/supabase_admin}"  <- still open
--
-- So any function created in public BY supabase_admin would again be callable
-- by anon and authenticated. That is post-check row 9's FAIL.
--
-- Note what the ACLs above do and do not say. Neither row contains a bare
-- "=X/owner" entry, so PUBLIC already has no EXECUTE on either; only the direct
-- anon/authenticated grants remain. This migration nevertheless revokes from
-- PUBLIC as well: PostgreSQL grants EXECUTE to PUBLIC implicitly on every new
-- function unless the default ACL says otherwise, and anon/authenticated both
-- inherit PUBLIC. Revoking all three makes 032 correct regardless of what the
-- ACL looked like beforehand, and keeps it idempotent.
--
-- SCOPE
-- Functions in public only. The storage, graphql, graphql_public, realtime,
-- extensions and auth default ACLs are left alone: they belong to Supabase's
-- own schemas, and 031/032 do not change them.
--
-- PERMISSIONS
-- ALTER DEFAULT PRIVILEGES FOR ROLE <other role> requires membership in that
-- role (or superuser). If the executing role is not a member of supabase_admin,
-- this migration raises instead of silently doing nothing, so a no-op cannot be
-- mistaken for a fix. Run it as postgres in the SQL Editor; if it raises, the
-- fix has to be run by a role that is a member of supabase_admin.
--
-- Idempotent: re-running it is a no-op once the ACL is clean.

BEGIN;

DO $do$
DECLARE
  v_role_exists boolean;
  v_is_member   boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin')
    INTO v_role_exists;

  IF NOT v_role_exists THEN
    RAISE EXCEPTION
      '032: role supabase_admin does not exist; nothing to fix. Re-check pg_default_acl.';
  END IF;

  SELECT pg_has_role(current_user, 'supabase_admin', 'MEMBER') INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION
      '032: current role % is not a member of supabase_admin, so it cannot change supabase_admin''s default privileges. Run this migration as a role that is (or as superuser).',
      current_user;
  END IF;

  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public '
       || 'REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';

  RAISE NOTICE '032: revoked PUBLIC/anon/authenticated EXECUTE on future public functions owned by supabase_admin.';
END
$do$;

COMMIT;
