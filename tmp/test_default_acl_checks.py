"""Proves the corrected default-ACL checks.

Covers the four Copilot findings on the withdrawn 032_postcheck.sql:
  1. a missing default-ACL row must not read as PASS
  2. PUBLIC detection must be order-independent inside the aclitem[]
  3. service_role must be counted per required owner, not globally
  4. the owner's own grant must not be treated as a finding

Also proves 031_postcheck.sql row 9 only judges owners of actual functions.
"""

import subprocess
import sys
import tempfile

import pgserver

AUDIT = open("docs/engineering/checks/default_acl_audit.sql").read()
POSTCHECK = open("docs/engineering/checks/031_postcheck.sql").read()

BASE = r"""
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role supabase_admin nologin;
create role other_owner nologin;
grant usage, create on schema public to supabase_admin;
grant usage, create on schema public to other_owner;
-- a real function owned by postgres, so postgres is an owner
create function public.real_fn() returns int language sql as 'select 1';
"""


def psql(uri, sql):
    return subprocess.run(
        ["psql", uri, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True,
        text=True,
    )


def verdicts(uri, sql):
    """Run a check script and return {ord: verdict}."""
    r = psql(uri, sql)
    out = {}
    for line in r.stdout.strip().splitlines():
        parts = line.split("|")
        if len(parts) >= 4 and parts[0].strip().isdigit():
            out[int(parts[0])] = parts[-1].strip()
    if r.returncode:
        print("   SQL ERROR:", r.stderr.strip()[:400])
    return out


def scenario(name, setup, audit_expect, row9_expect):
    d = tempfile.mkdtemp()
    srv = pgserver.get_server(d, cleanup_mode=None)
    uri = srv.get_uri()
    r = psql(uri, BASE + setup)
    if r.returncode:
        print(f"SETUP FAILED for {name}:", r.stderr.strip()[:400])
        return False
    a = verdicts(uri, AUDIT)
    p = verdicts(uri, POSTCHECK)
    ok = True
    for k, v in audit_expect.items():
        got = a.get(k)
        if got != v:
            print(f"  FAIL {name}: audit row {k} = {got!r}, want {v!r}")
            ok = False
    got9 = p.get(9)
    if got9 != row9_expect:
        print(f"  FAIL {name}: postcheck row 9 = {got9!r}, want {row9_expect!r}")
        ok = False
    print(("PASS  " if ok else "FAIL  ") + name)
    return ok


results = []

# A. clean postgres row, dormant permissive supabase_admin row -> all good
results.append(
    scenario(
        "A. clean postgres row + dormant supabase_admin row",
        """
        alter default privileges for role postgres in schema public
          revoke execute on functions from public, anon, authenticated;
        alter default privileges for role postgres in schema public
          grant execute on functions to service_role;
        alter default privileges for role supabase_admin in schema public
          grant execute on functions to anon, authenticated, service_role;
        """,
        {1: "PASS", 2: "PASS", 3: "PASS", 4: "INFO"},
        "PASS",
    )
)

# B. PUBLIC entry sitting SECOND in the aclitem[] -> must be caught
results.append(
    scenario(
        "B. PUBLIC entry not first in the ACL array is still detected",
        """
        alter default privileges for role postgres in schema public
          revoke execute on functions from public, anon, authenticated;
        alter default privileges for role postgres in schema public
          grant execute on functions to service_role;
        alter default privileges for role postgres in schema public
          grant execute on functions to public;
        """,
        {1: "FAIL", 3: "FAIL"},
        "FAIL",
    )
)

# C. postgres default-ACL row missing entirely -> must not read as PASS
results.append(
    scenario(
        "C. missing postgres default-ACL row is a FAIL, not a PASS",
        "",
        {1: "FAIL", 2: "FAIL", 3: "FAIL"},
        "FAIL",
    )
)

# D. service_role missing from postgres row -> check 2 must fail
results.append(
    scenario(
        "D. service_role missing from the postgres row fails check 2",
        """
        alter default privileges for role postgres in schema public
          revoke execute on functions from public, anon, authenticated, service_role;
        alter default privileges for role postgres in schema public
          grant execute on functions to postgres;
        """,
        {1: "PASS", 2: "FAIL"},
        "PASS",
    )
)

# E. a role that owns a function and has a permissive row -> check 3 fails
results.append(
    scenario(
        "E. permissive row for a role that owns a function fails check 3",
        """
        alter default privileges for role postgres in schema public
          revoke execute on functions from public, anon, authenticated;
        alter default privileges for role postgres in schema public
          grant execute on functions to service_role;
        alter default privileges for role other_owner in schema public
          grant execute on functions to anon;
        set role other_owner;
        create function public.other_fn() returns int language sql as 'select 1';
        reset role;
        """,
        {1: "PASS", 2: "PASS", 3: "FAIL"},
        "FAIL",
    )
)

# F. revoking every grant deletes the row entirely -> must FAIL, because a
#    missing row means PostgreSQL falls back to the built-in PUBLIC EXECUTE.
results.append(
    scenario(
        "F. revoking all grants deletes the row and is a FAIL, not a PASS",
        """
        alter default privileges for role postgres in schema public
          revoke execute on functions from public, anon, authenticated, service_role;
        """,
        {1: "FAIL", 2: "FAIL", 3: "FAIL"},
        "FAIL",
    )
)

print(f"\n{sum(results)}/{len(results)} scenarios passed")
sys.exit(0 if all(results) else 1)
