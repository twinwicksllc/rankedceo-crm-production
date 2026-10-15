import test from "node:test";
import assert from "node:assert/strict";

import {
  parseAdminAllowlist,
  hasAdminClaim,
  isAllowlistedAdmin,
  isWaasAdmin,
  isPlatformAdmin,
} from "./admin";

test("parseAdminAllowlist splits, trims and lower-cases", () => {
  assert.deepEqual(
    parseAdminAllowlist(" A@x.com, b@y.com ,,C@Z.com "),
    ["a@x.com", "b@y.com", "c@z.com"],
  );
});

test("parseAdminAllowlist returns [] for empty/undefined input", () => {
  assert.deepEqual(parseAdminAllowlist(""), []);
  assert.deepEqual(parseAdminAllowlist(undefined), []);
  assert.deepEqual(parseAdminAllowlist("   ,  , "), []);
});

test("hasAdminClaim recognises role=waas_admin and waas_admin true/'true'", () => {
  assert.equal(hasAdminClaim({ app_metadata: { role: "waas_admin" } }), true);
  assert.equal(hasAdminClaim({ app_metadata: { waas_admin: true } }), true);
  assert.equal(hasAdminClaim({ app_metadata: { waas_admin: "true" } }), true);
});

test("hasAdminClaim is false for other roles/flags and missing metadata", () => {
  assert.equal(hasAdminClaim({ app_metadata: { role: "admin" } }), false);
  assert.equal(hasAdminClaim({ app_metadata: { waas_admin: false } }), false);
  assert.equal(hasAdminClaim({ app_metadata: {} }), false);
  assert.equal(hasAdminClaim({}), false);
  assert.equal(hasAdminClaim(null), false);
  assert.equal(hasAdminClaim(undefined), false);
});

test("isAllowlistedAdmin matches case-insensitively and ignores blanks", () => {
  const allow = ["darrick@rankedceo.com"];
  assert.equal(isAllowlistedAdmin({ email: "Darrick@RankedCEO.com" }, allow), true);
  assert.equal(isAllowlistedAdmin({ email: "someone@else.com" }, allow), false);
  assert.equal(isAllowlistedAdmin({ email: "" }, allow), false);
  assert.equal(isAllowlistedAdmin({ email: null }, allow), false);
  assert.equal(isAllowlistedAdmin(null, allow), false);
});

test("isWaasAdmin is true when either the allowlist or the claim matches", () => {
  const allow = ["darrick@rankedceo.com"];
  assert.equal(isWaasAdmin({ email: "darrick@rankedceo.com" }, allow), true);
  assert.equal(
    isWaasAdmin({ email: "x@y.com", app_metadata: { waas_admin: true } }, allow),
    true,
  );
  assert.equal(isWaasAdmin({ email: "x@y.com" }, allow), false);
});

// ---------------------------------------------------------------------------
// isPlatformAdmin — DB role fallback
// ---------------------------------------------------------------------------

/** Minimal stand-in for the Supabase client's `from().select().eq().maybeSingle()`. */
function roleClient(role: string | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: role === null ? null : { role } }),
        }),
      }),
    }),
  };
}

test("isPlatformAdmin returns false for a missing user", async () => {
  const client = roleClient("admin");
  assert.equal(await isPlatformAdmin(client as never, null), false);
  assert.equal(await isPlatformAdmin(client as never, undefined), false);
});

test("isPlatformAdmin short-circuits on the allowlist without a DB call", async () => {
  const previous = process.env.WAAS_ADMIN_EMAIL;
  process.env.WAAS_ADMIN_EMAIL = "boss@rankedceo.com";
  try {
    let called = false;
    const client = {
      from: () => {
        called = true;
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
        };
      },
    };
    const allowed = await isPlatformAdmin(client as never, {
      id: "u1",
      email: "boss@rankedceo.com",
    });
    assert.equal(allowed, true);
    assert.equal(called, false, "DB should not be queried for an allowlisted admin");
  } finally {
    if (previous === undefined) delete process.env.WAAS_ADMIN_EMAIL;
    else process.env.WAAS_ADMIN_EMAIL = previous;
  }
});

test("isPlatformAdmin grants access for DB admin roles", async () => {
  for (const role of ["admin", "super_admin", "owner", "ADMIN"]) {
    assert.equal(
      await isPlatformAdmin(roleClient(role) as never, {
        id: "u1",
        email: "nobody@example.com",
      }),
      true,
      `role ${role} should be admin`,
    );
  }
});

test("isPlatformAdmin denies non-admin DB roles and missing rows", async () => {
  for (const role of ["member", "user", "owner_", null]) {
    assert.equal(
      await isPlatformAdmin(roleClient(role) as never, {
        id: "u1",
        email: "nobody@example.com",
      }),
      false,
      `role ${String(role)} should not be admin`,
    );
  }
});

test("isPlatformAdmin returns false when the lookup throws", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            throw new Error("boom");
          },
        }),
      }),
    }),
  };
  assert.equal(
    await isPlatformAdmin(client as never, {
      id: "u1",
      email: "nobody@example.com",
    }),
    false,
  );
});

test("isPlatformAdmin returns false when the user has no id and no allowlist match", async () => {
  assert.equal(
    await isPlatformAdmin(roleClient("admin") as never, {
      email: "nobody@example.com",
    }),
    false,
  );
});
