import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLeadTarget } from "./lead-operator";
import { POOL_ACCOUNTS } from "../data/pool-accounts";

// The public lead insert uses the admin client, which bypasses row-level
// security, so the operatorId from the share link is checked here before it is
// allowed to choose the account. An id that is not a real operator files the
// lead under the industry pool.

const OP = "11111111-1111-4111-a111-111111111111";
const ACCT = "22222222-2222-4222-a222-222222222222";

/** Fake admin client: users -> account_id, accounts -> is_pool_account. */
function fake(
  users: Record<string, { account_id: string | null } | null>,
  accounts: Record<string, { is_pool_account: boolean | null } | null>,
  failOn?: "users" | "accounts",
) {
  const asked: string[] = [];
  const client = {
    from(table: "users" | "accounts") {
      return {
        select() {
          return {
            eq(_c: string, id: string) {
              asked.push(`${table}:${id}`);
              return {
                async maybeSingle() {
                  if (failOn === table) {
                    return { data: null, error: { message: "boom" } };
                  }
                  const row =
                    table === "users"
                      ? (users[id] ?? null)
                      : (accounts[id] ?? null);
                  return { data: row, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, asked };
}

test("no operator id: the industry pool, unattributed", async () => {
  const { client, asked } = fake({}, {});
  const target = await resolveLeadTarget(client, "hvac", null);
  assert.deepEqual(target, {
    accountId: POOL_ACCOUNTS.hvac,
    authUserId: null,
  });
  assert.deepEqual(asked, [], "no lookup without an id");
});

test("a real operator in a real account: their account, attributed", async () => {
  const { client } = fake(
    { [OP]: { account_id: ACCT } },
    { [ACCT]: { is_pool_account: false } },
  );
  assert.deepEqual(await resolveLeadTarget(client, "hvac", OP), {
    accountId: ACCT,
    authUserId: OP,
  });
});

test("an id that is not a user falls back to the pool", async () => {
  const { client } = fake({}, {});
  assert.deepEqual(await resolveLeadTarget(client, "plumbing", OP), {
    accountId: POOL_ACCOUNTS.plumbing,
    authUserId: null,
  });
});

test("a user with no account falls back to the pool", async () => {
  const { client } = fake({ [OP]: { account_id: null } }, {});
  assert.deepEqual(await resolveLeadTarget(client, "electrical", OP), {
    accountId: POOL_ACCOUNTS.electrical,
    authUserId: null,
  });
});

test("a user whose account is a pool account is not treated as an operator", async () => {
  const { client } = fake(
    { [OP]: { account_id: ACCT } },
    { [ACCT]: { is_pool_account: true } },
  );
  assert.deepEqual(await resolveLeadTarget(client, "hvac", OP), {
    accountId: POOL_ACCOUNTS.hvac,
    authUserId: null,
  });
});

test("an account that cannot be found falls back to the pool", async () => {
  const { client } = fake({ [OP]: { account_id: ACCT } }, {});
  assert.deepEqual(await resolveLeadTarget(client, "hvac", OP), {
    accountId: POOL_ACCOUNTS.hvac,
    authUserId: null,
  });
});

test("a lookup error falls back to the pool and never to the supplied id", async () => {
  for (const failOn of ["users", "accounts"] as const) {
    const { client } = fake(
      { [OP]: { account_id: ACCT } },
      { [ACCT]: { is_pool_account: false } },
      failOn,
    );
    assert.deepEqual(await resolveLeadTarget(client, "hvac", OP), {
      accountId: POOL_ACCOUNTS.hvac,
      authUserId: null,
    });
  }
});

test("the lookups ask for exactly the supplied user and that user's account", async () => {
  const { client, asked } = fake(
    { [OP]: { account_id: ACCT } },
    { [ACCT]: { is_pool_account: false } },
  );
  await resolveLeadTarget(client, "hvac", OP);
  assert.deepEqual(asked, [`users:${OP}`, `accounts:${ACCT}`]);
});

test("the submit action resolves the target with the admin client", () => {
  const source = readFileSync(
    new URL("../actions/industry-lead.ts", import.meta.url),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const submit = source.slice(
    source.indexOf("export async function submitIndustryLead"),
    source.indexOf("export async function getIndustryLeads"),
  );
  assert.match(submit, /resolveLeadTarget\(/);
  assert.match(submit, /createAdminClient\(\)/);
  // The old inline lookup ran on the cookie client, as the signed-out visitor.
  assert.ok(
    !/\.from\("users"\)/.test(submit),
    "the users lookup must live in resolveLeadTarget",
  );
  assert.ok(
    !/createClient\(\)/.test(submit),
    "the submit action no longer needs the cookie client",
  );
});

test("a response that carries both data and an error is not trusted", async () => {
  // A client can hand back partial data alongside an error. The error wins.
  for (const failOn of ["users", "accounts"] as const) {
    const client = {
      from(table: "users" | "accounts") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    const data =
                      table === "users"
                        ? { account_id: ACCT }
                        : { is_pool_account: false };
                    return failOn === table
                      ? { data, error: { message: "partial" } }
                      : { data, error: null };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    assert.deepEqual(await resolveLeadTarget(client, "hvac", OP), {
      accountId: POOL_ACCOUNTS.hvac,
      authUserId: null,
    });
  }
});
