import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureCrmProfile,
  deriveAccountName,
  type EnsureProfileClient,
} from "./ensure-crm-profile";

interface FakeOptions {
  existingProfile?: { account_id: string } | null;
  lookupError?: string;
  accountInsertError?: string;
  accountId?: string;
  profileInsertError?: string;
  retryProfile?: { account_id: string } | null;
}

function fakeClient(opts: FakeOptions) {
  const calls: string[] = [];
  let profileInsertAttempted = false;

  const client: EnsureProfileClient = {
    from(table) {
      return {
        select(column) {
          return {
            eq(columnName, value) {
              return {
                async maybeSingle() {
                  calls.push(`select ${table} ${columnName}=${value} (${column})`);
                  if (table === "users") {
                    if (profileInsertAttempted) {
                      return { data: opts.retryProfile ?? null, error: null };
                    }
                    if (opts.lookupError) {
                      return { data: null, error: { message: opts.lookupError } };
                    }
                    return { data: opts.existingProfile ?? null, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        insert(values) {
          calls.push(`insert ${table} ${JSON.stringify(values)}`);
          return {
            select() {
              return {
                async maybeSingle() {
                  if (table === "accounts") {
                    if (opts.accountInsertError) {
                      return {
                        data: null,
                        error: { message: opts.accountInsertError },
                      };
                    }
                    return {
                      data: { id: opts.accountId ?? "acct-1" },
                      error: null,
                    };
                  }
                  profileInsertAttempted = true;
                  if (opts.profileInsertError) {
                    return {
                      data: null,
                      error: { message: opts.profileInsertError },
                    };
                  }
                  return {
                    data: { account_id: opts.accountId ?? "acct-1" },
                    error: null,
                  };
                },
              };
            },
          };
        },
        delete() {
          return {
            async eq(columnName, value) {
              calls.push(`delete ${table} ${columnName}=${value}`);
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { client, calls };
}

test("does nothing when the profile already exists", async () => {
  const { client, calls } = fakeClient({
    existingProfile: { account_id: "acct-existing" },
  });
  const result = await ensureCrmProfile(
    { id: "u1", email: "a@b.com" },
    client,
  );
  assert.deepEqual(result, {
    ok: true,
    created: false,
    accountId: "acct-existing",
  });
  assert.equal(calls.filter((c) => c.startsWith("insert")).length, 0);
});

test("creates an account and a profile when missing", async () => {
  const { client, calls } = fakeClient({ accountId: "acct-new" });
  const result = await ensureCrmProfile(
    { id: "u2", email: "New@User.com", user_metadata: { company_name: "Acme" } },
    client,
  );
  assert.deepEqual(result, {
    ok: true,
    created: true,
    accountId: "acct-new",
  });
  const accountInsert = calls.find((c) => c.startsWith("insert accounts"));
  assert.ok(accountInsert && accountInsert.includes("Acme"));
  const profileInsert = calls.find((c) => c.startsWith("insert users"));
  assert.ok(profileInsert);
  assert.ok(profileInsert!.includes('"id":"u2"'));
  assert.ok(profileInsert!.includes('"account_id":"acct-new"'));
  assert.ok(profileInsert!.includes('"email":"new@user.com"')); // lower-cased
  assert.ok(profileInsert!.includes('"role":"member"')); // never an admin role
});

test("returns ok:false when the profile lookup fails", async () => {
  const { client } = fakeClient({ lookupError: "boom" });
  const result = await ensureCrmProfile({ id: "u3", email: "a@b.com" }, client);
  assert.equal(result.ok, false);
  assert.equal(result.created, false);
  assert.match(result.reason ?? "", /profile lookup failed/);
});

test("does not insert a profile when the account insert fails", async () => {
  const { client, calls } = fakeClient({ accountInsertError: "no accounts" });
  const result = await ensureCrmProfile({ id: "u4", email: "a@b.com" }, client);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /account insert failed/);
  assert.equal(calls.filter((c) => c.startsWith("insert users")).length, 0);
});

test("resolves a race: keeps the existing profile and removes the orphan account", async () => {
  const { client, calls } = fakeClient({
    accountId: "acct-orphan",
    profileInsertError: "duplicate key value violates unique constraint",
    retryProfile: { account_id: "acct-winner" },
  });
  const result = await ensureCrmProfile({ id: "u5", email: "a@b.com" }, client);
  assert.deepEqual(result, {
    ok: true,
    created: false,
    accountId: "acct-winner",
    reason: "profile already created by a concurrent request",
  });
  assert.ok(calls.includes("delete accounts id=acct-orphan"));
});

test("cleans up the orphan account when the profile insert fails outright", async () => {
  const { client, calls } = fakeClient({
    accountId: "acct-orphan",
    profileInsertError: "some other error",
    retryProfile: null,
  });
  const result = await ensureCrmProfile({ id: "u6", email: "a@b.com" }, client);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /profile insert failed/);
  assert.ok(calls.includes("delete accounts id=acct-orphan"));
});

test("returns ok:false when there is no user id", async () => {
  const { client } = fakeClient({});
  const result = await ensureCrmProfile({ id: "" }, client);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /missing user id/);
});

test("reports a failure instead of throwing when the admin client is unavailable", async () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const result = await ensureCrmProfile({ id: "u7", email: "a@b.com" });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /admin client unavailable/);
  } finally {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
});

test("deriveAccountName prefers company_name, then email local part", () => {
  assert.equal(
    deriveAccountName({ id: "u", user_metadata: { company_name: "  Acme  " } }),
    "Acme",
  );
  assert.equal(
    deriveAccountName({ id: "u", email: "tommy@example.com" }),
    "tommy",
  );
  assert.equal(deriveAccountName({ id: "u" }), "My Account");
});
