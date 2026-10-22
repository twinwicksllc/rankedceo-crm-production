"""Proves migration 032 on a throwaway Postgres.

Scope note: this pgserver build (PG 16.2) does NOT apply schema-scoped default
ACLs to newly created objects -- verified with tables as well as functions, so
it is the environment, not 032. What IS proven here is the stored ACL row that
032 writes, its idempotency, and the membership guard. The "a new function is
not anon-executable" claim is verified live by post-check row 9 instead.
"""

import subprocess
import sys
import tempfile

import pgserver

SETUP = r"""
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role supabase_admin nologin;
grant usage, create on schema public to supabase_admin;

-- mimic the live rankedceo-waas state after 031:
--   postgres,public,f       -> already fixed by 031
--   supabase_admin,public,f -> still grants anon/authenticated (row 9 FAIL)
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

alter default privileges for role supabase_admin in schema public
  revoke execute on functions from public;
alter default privileges for role supabase_admin in schema public
  grant execute on functions to anon, authenticated, service_role;

-- a schema 032 must NOT touch
create schema other;
alter default privileges for role supabase_admin in schema other
  grant execute on functions to anon;
"""

MIG = open("supabase/migrations/waas/032_supabase_admin_default_acl.sql").read()


def psql(uri, sql):
    return subprocess.run(
        ["psql", uri, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True,
        text=True,
    )


def main():
    d = tempfile.mkdtemp()
    srv = pgserver.get_server(d, cleanup_mode=None)
    uri = srv.get_uri()

    r = psql(uri, SETUP)
    if r.returncode:
        print("SETUP FAILED:", r.stderr)
        return 1

    checks = []

    def check(name, sql, expect):
        r = psql(uri, sql)
        got = r.stdout.strip()
        ok = got == expect
        checks.append((name, ok, got, expect))
        if not ok and r.stderr:
            print("   stderr:", r.stderr.strip()[:300])

    def acl_count(pattern):
        return (
            "select count(*) from pg_default_acl where defaclobjtype='f' "
            "and defaclrole='supabase_admin'::regrole and defaclnamespace='public'::regnamespace "
            f"and defaclacl::text like '%{pattern}%'"
        )

    # 1. baseline matches the live FAIL
    check(
        "1. baseline: supabase_admin/public/f grants anon (live row 9 FAIL)",
        "select count(*) from pg_default_acl where defaclnamespace='public'::regnamespace "
        "and defaclobjtype='f' and defaclrole='supabase_admin'::regrole "
        "and defaclacl::text like '%anon=X%'",
        "1",
    )

    # 2. applies cleanly
    r = psql(uri, MIG)
    ok = r.returncode == 0
    checks.append(("2. 032 applies cleanly", ok, r.returncode, 0))
    if not ok:
        print("   stderr:", r.stderr.strip()[:800])

    # 3-6. resulting ACL row
    check("3. supabase_admin/public/f: no anon", acl_count("anon=X"), "0")
    check("4. supabase_admin/public/f: no authenticated", acl_count("authenticated=X"), "0")
    check("5. supabase_admin/public/f: no PUBLIC entry", acl_count("{=X"), "0")
    check("6. supabase_admin/public/f: keeps service_role", acl_count("service_role=X"), "1")

    # 7. postgres row (031's work) untouched
    check(
        "7. postgres/public/f untouched by 032",
        "select coalesce(defaclacl::text,'NULL') from pg_default_acl where defaclnamespace='public'::regnamespace "
        "and defaclobjtype='f' and defaclrole='postgres'::regrole",
        "{service_role=X/postgres}",
    )

    # 8. other schemas untouched
    check(
        "8. other schema untouched (032 is public-only)",
        "select count(*) from pg_default_acl where defaclnamespace='other'::regnamespace "
        "and defaclobjtype='f' and defaclacl::text like '%anon=X%'",
        "1",
    )

    # 9. idempotent
    r = psql(uri, MIG)
    ok = r.returncode == 0
    checks.append(("9. 032 re-runs cleanly (idempotent)", ok, r.returncode, 0))
    if not ok:
        print("   stderr:", r.stderr.strip()[:500])

    # 10. non-member raises instead of silently no-op'ing
    psql(uri, "create role not_a_member nologin;")
    body = MIG.replace("BEGIN;", "").replace("COMMIT;", "")
    r = psql(uri, "set role not_a_member; " + body)
    raised = r.returncode != 0 and "not a member of supabase_admin" in r.stderr
    checks.append(("10. non-member role raises a clear error", raised, r.returncode, "nonzero"))

    # 11. missing role raises rather than crashing obscurely
    psql(uri, "drop owned by supabase_admin;")
    psql(uri, "drop role supabase_admin;")
    r = psql(uri, MIG)
    raised = r.returncode != 0 and "does not exist" in r.stderr
    checks.append(("11. missing supabase_admin raises a clear error", raised, r.returncode, "nonzero"))

    print()
    passed = 0
    for name, ok, got, exp in checks:
        print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else f"  (got {got!r}, want {exp!r})"))
        passed += ok
    print(f"\n{passed}/{len(checks)} passed")
    return 0 if passed == len(checks) else 1


sys.exit(main())
