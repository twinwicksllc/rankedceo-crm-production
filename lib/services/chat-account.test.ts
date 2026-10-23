import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { POOL_ACCOUNTS } from "../data/pool-accounts";
import { resolveChatAccountId } from "./chat-account";

// Every chat widget on the site sends a source but no accountId, so the
// fallback decides where every conversation and chat lead is stored.

const OWN = "11111111-1111-4111-a111-111111111111";
const DEFAULT = "22222222-2222-4222-a222-222222222222";

test("an explicit accountId wins over the pool", () => {
  assert.deepEqual(resolveChatAccountId("hvac", OWN, DEFAULT), {
    accountId: OWN,
  });
});

test("industry chats without an accountId go to that industry's pool", () => {
  for (const source of ["hvac", "plumbing", "electrical", "smile"] as const) {
    assert.deepEqual(resolveChatAccountId(source, undefined, DEFAULT), {
      accountId: POOL_ACCOUNTS[source],
    });
  }
});

test("a crm chat without an accountId uses DEFAULT_ACCOUNT_ID", () => {
  assert.deepEqual(resolveChatAccountId("crm", undefined, DEFAULT), {
    accountId: DEFAULT,
  });
});

test("a crm chat with no accountId and no default is refused", () => {
  const result = resolveChatAccountId("crm", undefined, undefined);
  assert.equal(result.accountId, undefined);
  assert.match(result.error ?? "", /DEFAULT_ACCOUNT_ID/);
});

test("the chat route has no hard-coded fallback account id", () => {
  const route = readFileSync("app/api/agent/chat/route.ts", "utf8");
  assert.doesNotMatch(route, /"00000000-0000-4000-a000-000000000001"/);
  assert.match(route, /resolveChatAccountId/);
});
