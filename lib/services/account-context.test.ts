import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveAccountId,
  resolveUserProfile,
  type AccountLookupClient,
} from "@/lib/services/account-context";

type Row = { id?: string | null; account_id?: string | null } | null;

/**
 * Minimal stand-in for the Supabase builder: records the filters used and
 * answers from a table keyed by column name.
 */
function stubClient(rows: Record<string, Row>, failOn: string[] = []) {
  const calls: Array<{ column: string; value: string }> = [];
  const client: AccountLookupClient = {
    from() {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              calls.push({ column, value });
              return {
                async maybeSingle() {
                  if (failOn.includes(column)) {
                    return { data: null, error: { message: "boom" } };
                  }
                  return { data: rows[column] ?? null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test("resolves the account by id, the auth uid", async () => {
  const { client, calls } = stubClient({ id: { account_id: "acct-1" } });
  const accountId = await resolveAccountId(client, {
    id: "auth-uid",
    email: "a@b.com",
  });
  assert.equal(accountId, "acct-1");
  assert.deepEqual(calls, [{ column: "id", value: "auth-uid" }]);
});

test("falls back to email for a legacy profile whose id is not the auth uid", async () => {
  const { client, calls } = stubClient({
    id: null,
    email: { account_id: "acct-legacy" },
  });
  const accountId = await resolveAccountId(client, {
    id: "auth-uid",
    email: "legacy@b.com",
  });
  assert.equal(accountId, "acct-legacy");
  assert.deepEqual(calls, [
    { column: "id", value: "auth-uid" },
    { column: "email", value: "legacy@b.com" },
  ]);
});

test("does not fall back to email when the id lookup errors", async () => {
  // An RLS/network failure must not be papered over by a second query.
  const { client, calls } = stubClient(
    { email: { account_id: "acct-other" } },
    ["id"],
  );
  await assert.rejects(
    resolveAccountId(client, { id: "auth-uid", email: "a@b.com" }),
    /Account lookup failed: boom/,
  );
  assert.deepEqual(calls, [{ column: "id", value: "auth-uid" }]);
});

test("throws Account not found when nothing matches", async () => {
  const { client } = stubClient({ id: null, email: null });
  await assert.rejects(
    resolveAccountId(client, { id: "auth-uid", email: "a@b.com" }),
    /Account not found/,
  );
});

test("skips the email fallback when the user has no email (WaaS signups)", async () => {
  const { client, calls } = stubClient({ id: null });
  await assert.rejects(
    resolveAccountId(client, { id: "auth-uid", email: null }),
    /Account not found/,
  );
  assert.deepEqual(calls, [{ column: "id", value: "auth-uid" }]);
});

test("resolveUserProfile returns the matched profile id, not the auth uid", async () => {
  const { client } = stubClient({
    id: { id: "auth-uid", account_id: "acct-1" },
  });
  const resolved = await resolveUserProfile(client, {
    id: "auth-uid",
    email: "a@b.com",
  });
  assert.deepEqual(resolved, { account_id: "acct-1", user_id: "auth-uid" });
});

test("resolveUserProfile returns the legacy row id so the users row can be addressed", async () => {
  // Regression: the email fallback matches a profile whose id is NOT the auth
  // uid. Callers that filter `users` by `user.id` would then get zero rows.
  const { client, calls } = stubClient({
    id: null,
    email: { id: "legacy-profile-id", account_id: "acct-legacy" },
  });
  const resolved = await resolveUserProfile(client, {
    id: "auth-uid",
    email: "legacy@b.com",
  });
  assert.deepEqual(resolved, {
    account_id: "acct-legacy",
    user_id: "legacy-profile-id",
  });
  assert.deepEqual(calls, [
    { column: "id", value: "auth-uid" },
    { column: "email", value: "legacy@b.com" },
  ]);
});

test("resolveAccountId still returns only the account id", async () => {
  const { client } = stubClient({ id: { id: "auth-uid", account_id: "acct-1" } });
  assert.equal(
    await resolveAccountId(client, { id: "auth-uid", email: "a@b.com" }),
    "acct-1",
  );
});
