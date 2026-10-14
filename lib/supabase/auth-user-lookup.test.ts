import test from "node:test";
import assert from "node:assert/strict";

import {
  authUserExistsByEmail,
  type AuthAdminListClient,
  type AuthUserListPage,
} from "./auth-user-lookup";

function stubClient(pages: AuthUserListPage[]): {
  client: AuthAdminListClient;
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    client: {
      auth: {
        admin: {
          async listUsers(params) {
            const page = params?.page ?? 1;
            calls.push(page);
            return pages[page - 1] ?? { data: { users: [] }, error: null };
          },
        },
      },
    },
  };
}

const users = (n: number, prefix = "u") =>
  Array.from({ length: n }, (_, i) => ({ email: `${prefix}${i}@x.com` }));

test("finds a user case-insensitively", async () => {
  const { client } = stubClient([
    { data: { users: [{ email: "Tommy@Example.com" }] }, error: null },
  ]);
  assert.equal(await authUserExistsByEmail(client, " tommy@example.COM "), true);
});

test("returns false when absent on a short page", async () => {
  const { client, calls } = stubClient([
    { data: { users: users(3) }, error: null },
  ]);
  assert.equal(await authUserExistsByEmail(client, "nobody@x.com"), false);
  assert.deepEqual(calls, [1]);
});

test("pages through full pages to find a user on page 2", async () => {
  const { client, calls } = stubClient([
    { data: { users: users(1000) }, error: null },
    { data: { users: [{ email: "late@x.com" }] }, error: null },
  ]);
  assert.equal(await authUserExistsByEmail(client, "late@x.com"), true);
  assert.deepEqual(calls, [1, 2]);
});

test("returns null (unknown), not false, when the API errors", async () => {
  const { client } = stubClient([
    { data: { users: [] }, error: { message: "not_admin" } },
  ]);
  assert.equal(await authUserExistsByEmail(client, "a@x.com"), null);
});

test("returns false for an empty email without calling the API", async () => {
  const { client, calls } = stubClient([]);
  assert.equal(await authUserExistsByEmail(client, "  "), false);
  assert.deepEqual(calls, []);
});
