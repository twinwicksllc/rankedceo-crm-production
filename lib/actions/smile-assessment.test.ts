import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { POOL_ACCOUNTS } from "../data/pool-accounts";
import type { AccountLookupClient } from "../services/account-context";
import {
  SMILE_POOL_ACCOUNT_ID,
  pickInsertClient,
  publicDentistId,
  resolveSmileTarget,
} from "./smile-assessment-target";

type Row = { id?: string | null; account_id?: string | null } | null;

/**
 * Minimal stand-in for the Supabase builder: answers `users` lookups from a
 * table keyed by column name and records every filter used.
 */
function stubClient(rows: Record<string, Row>) {
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

test("public link: pool account, dentist kept in auth_user_id, no lookup", async () => {
  const { client, calls } = stubClient({ id: { account_id: "acct-dentist" } });
  const target = await resolveSmileTarget(client, {
    dentistId: "dentist-uid",
    user: null,
  });
  assert.deepEqual(target, {
    accountId: SMILE_POOL_ACCOUNT_ID,
    authUserId: "dentist-uid",
  });
  assert.deepEqual(calls, []);
});

test("signed-in dentist with a profile: their own account, by users.id", async () => {
  const { client, calls } = stubClient({ id: { account_id: "acct-own" } });
  const target = await resolveSmileTarget(client, {
    user: { id: "dentist-uid", email: null },
  });
  assert.deepEqual(target, {
    accountId: "acct-own",
    authUserId: "dentist-uid",
  });
  assert.deepEqual(calls[0], { column: "id", value: "dentist-uid" });
});

test("signed-in dentist without a profile: error, not the pool", async () => {
  const { client } = stubClient({});
  const target = await resolveSmileTarget(client, {
    user: { id: "dentist-uid", email: null },
  });
  assert.ok("error" in target, "expected an error result");
  assert.match(target.error, /profile was not found/);
});

test("signed-in dentist when the lookup query fails: a retry error, not 'no profile'", async () => {
  const client: AccountLookupClient = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: { message: "connection reset" } };
                },
              };
            },
          };
        },
      };
    },
  };
  const target = await resolveSmileTarget(client, {
    user: { id: "dentist-uid", email: null },
  });
  assert.ok("error" in target, "expected an error result");
  assert.match(target.error, /try again/);
  assert.doesNotMatch(target.error, /profile/);
});

test("anonymous with no dentist id: pool account, auth_user_id null", async () => {
  const { client } = stubClient({});
  const target = await resolveSmileTarget(client, { user: null });
  assert.deepEqual(target, {
    accountId: SMILE_POOL_ACCOUNT_ID,
    authUserId: null,
  });
});

test("old links carrying the pool ACCOUNT id as dentistId: pool, auth_user_id null", async () => {
  const { client, calls } = stubClient({});
  const target = await resolveSmileTarget(client, {
    dentistId: SMILE_POOL_ACCOUNT_ID,
    user: null,
  });
  assert.deepEqual(target, {
    accountId: SMILE_POOL_ACCOUNT_ID,
    authUserId: null,
  });
  assert.deepEqual(calls, []);
  assert.equal(publicDentistId(SMILE_POOL_ACCOUNT_ID), null);
  assert.equal(publicDentistId("dentist-uid"), "dentist-uid");
  assert.equal(publicDentistId(undefined), null);
});

test("the assessment page passes the URL dentistId, not the pool account id", () => {
  const page = readFileSync(
    new URL("../../app/smile/assessment/page.tsx", import.meta.url),
    "utf-8",
  );
  assert.ok(
    !page.includes(SMILE_POOL_ACCOUNT_ID),
    "page.tsx must not substitute the pool account id for a missing dentistId",
  );
});

test("SMILE_POOL_ACCOUNT_ID is the shared smile pool id", () => {
  // lib/data/pool-accounts.test.ts checks that this id is seeded by waas/030.
  assert.equal(SMILE_POOL_ACCOUNT_ID, POOL_ACCOUNTS.smile);
});

test("the action no longer looks up users by auth_user_id", () => {
  // users has no auth_user_id column in either project, so that lookup can
  // only fail. smile_assessments.auth_user_id is a real column and may stay.
  const source = readFileSync(
    new URL("./smile-assessment.ts", import.meta.url),
    "utf-8",
  ).replace(/\r\n/g, "\n");
  const usersQueries = source.split('.from("users")').slice(1);
  for (const query of usersQueries) {
    const chain = query.split(";")[0];
    assert.ok(
      !chain.includes('"auth_user_id"'),
      `users query still filters on auth_user_id: ${chain.slice(0, 120)}`,
    );
  }
});

// Copilot #331: the "pool" insert policy is TO anon. A signed-in browser's
// cookie-bound client runs as authenticated, whose policy only allows its own
// account, so a pool insert must go through a session-less client.
test("a pool-bound insert uses the anon client, never the cookie session", () => {
  const cookie = { name: "cookie" };
  const anon = { name: "anon" };
  const chosen = pickInsertClient(
    { accountId: SMILE_POOL_ACCOUNT_ID, authUserId: "dentist-uid" },
    cookie,
    () => anon,
  );
  assert.equal(chosen, anon);
});

test("an insert into the signed-in dentist's own account keeps the cookie session", () => {
  const cookie = { name: "cookie" };
  const chosen = pickInsertClient(
    { accountId: "acct-own", authUserId: "dentist-uid" },
    cookie,
    () => {
      throw new Error(
        "anon client must not be built for an own-account insert",
      );
    },
  );
  assert.equal(chosen, cookie);
});

test("the action inserts through pickInsertClient", () => {
  const source = readFileSync(
    new URL("./smile-assessment.ts", import.meta.url),
    "utf-8",
  ).replace(/\r\n/g, "\n");
  assert.match(source, /pickInsertClient\(/);
  assert.match(source, /createAnonClient/);
  assert.match(
    source,
    /insertClient\s*\.from\("smile_assessments"\)/,
    "the insert must run on the picked client, not the cookie client",
  );
});
