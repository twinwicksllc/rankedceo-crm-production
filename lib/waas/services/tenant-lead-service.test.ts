import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { signSiteLeadToken } from "../lead-form-token";
import {
  checkSpamSignals,
  clientIpFromHeaders,
  hashIp,
  isRateLimited,
  MIN_FILL_MS,
  RATE_LIMITS,
  RATE_WINDOW_MS,
} from "./tenant-lead-guard";
import {
  processTenantLead,
  type SubmitLimitedResult,
  type TenantLeadDeps,
  type TenantLeadRow,
} from "./tenant-lead-service";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = 1_800_000_000_000;

const SECRET_VARS = [
  "WAAS_LEAD_FORM_SECRET",
  "AUDIT_SHARE_SECRET",
  "WAAS_SUPABASE_SERVICE_ROLE_KEY",
] as const;
const savedSecrets: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const name of SECRET_VARS) savedSecrets[name] = process.env[name];
  process.env.WAAS_LEAD_FORM_SECRET = "test-secret";
});
afterEach(() => {
  for (const name of SECRET_VARS) {
    if (savedSecrets[name] === undefined) delete process.env[name];
    else process.env[name] = savedSecrets[name];
  }
});

function makeDeps(
  over: Partial<TenantLeadDeps> & {
    submitResult?: SubmitLimitedResult;
  } = {},
) {
  const calls = {
    inserted: [] as TenantLeadRow[],
    notified: 0,
    loaded: [] as string[],
    submitArgs: [] as Array<{ limits: { perIp: number; perEmail: number }; windowStartIso: string }>,
  };
  const { submitResult, ...rest } = over;
  const deps: TenantLeadDeps = {
    now: () => NOW,
    loadTenant: async (id) => {
      calls.loaded.push(id);
      return { id, status: "active", businessName: "Acme Plumbing" };
    },
    submitLimited: async (args) => {
      calls.submitArgs.push({ limits: args.limits, windowStartIso: args.windowStartIso });
      if (submitResult) {
        if (submitResult.status === "ok") calls.inserted.push(args.row);
        return submitResult;
      }
      calls.inserted.push(args.row);
      return { status: "ok", id: "lead-1", tenantCount: 0 };
    },
    notify: async () => {
      calls.notified += 1;
    },
    ...rest,
  };
  return { deps, calls };
}

const goodInput = (over: Record<string, unknown> = {}) => ({
  tenantId: TENANT,
  siteToken: signSiteLeadToken(TENANT)!,
  name: "Jane Smith",
  email: "jane@example.com",
  phone: "(512) 555-0142",
  message: "Need a quote",
  shownAt: NOW - 10_000,
  website: "",
  ...over,
});

describe("guard helpers", () => {
  it("flags the honeypot, instant submits and missing or future times", () => {
    assert.equal(checkSpamSignals({ website: "http://spam", shownAt: NOW - 9000, now: NOW }), "bot");
    assert.equal(checkSpamSignals({ shownAt: NOW - (MIN_FILL_MS - 1), now: NOW }), "bot");
    assert.equal(checkSpamSignals({ now: NOW }), "bot");
    assert.equal(checkSpamSignals({ shownAt: NOW + 3_600_000, now: NOW }), "bot");
    assert.equal(checkSpamSignals({ website: "", shownAt: NOW - MIN_FILL_MS, now: NOW }), "ok");
  });
  it("rate limit trips at 5 per IP or 3 per email", () => {
    assert.equal(isRateLimited({ ip: 4, email: 2 }), false);
    assert.equal(isRateLimited({ ip: 5, email: 0 }), true);
    assert.equal(isRateLimited({ ip: 0, email: 3 }), true);
  });
  it("hashes the ip per tenant and never returns the raw address", () => {
    const a = hashIp("203.0.113.9", TENANT);
    assert.ok(a && !a.includes("203.0.113.9"));
    assert.equal(a, hashIp("203.0.113.9", TENANT));
    assert.notEqual(a, hashIp("203.0.113.9", OTHER));
    assert.equal(hashIp(null, TENANT), null);
  });
  it("reads the first forwarded address", () => {
    const headers: Record<string, string> = { "x-forwarded-for": "203.0.113.9, 10.0.0.1" };
    assert.equal(clientIpFromHeaders((n) => headers[n] ?? null), "203.0.113.9");
    assert.equal(clientIpFromHeaders(() => null), null);
  });
});

describe("processTenantLead", () => {
  it("stores a valid lead against the verified tenant and notifies", async () => {
    const { deps, calls } = makeDeps();
    const result = await processTenantLead(goodInput(), { ip: "203.0.113.9" }, deps);
    assert.deepEqual(result, { ok: true });
    assert.equal(calls.inserted.length, 1);
    const row = calls.inserted[0];
    assert.equal(row.tenant_id, TENANT);
    assert.equal(row.source, "tenant_site");
    assert.equal(row.status, "new");
    assert.equal(row.email, "jane@example.com");
    assert.equal(row.service_requested, null);
    assert.ok(row.ip_hash && !row.ip_hash.includes("203.0.113.9"));
    assert.equal(calls.notified, 1);
  });

  it("rejects invalid input with field names and stores nothing", async () => {
    const { deps, calls } = makeDeps();
    const result = await processTenantLead(goodInput({ email: "nope" }), { ip: null }, deps);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid");
      assert.ok(result.fieldErrors?.email);
    }
    assert.equal(calls.inserted.length, 0);
  });

  it("returns a fake success for a tripped honeypot and stores nothing", async () => {
    const { deps, calls } = makeDeps();
    const result = await processTenantLead(goodInput({ website: "http://spam.test" }), { ip: null }, deps);
    assert.deepEqual(result, { ok: true });
    assert.equal(calls.inserted.length, 0);
    assert.equal(calls.loaded.length, 0);
  });

  it("returns a fake success for an instant submit", async () => {
    const { deps, calls } = makeDeps();
    const result = await processTenantLead(goodInput({ shownAt: NOW - 200 }), { ip: null }, deps);
    assert.deepEqual(result, { ok: true });
    assert.equal(calls.inserted.length, 0);
  });

  it("refuses a token signed for a different tenant (the tenant id cannot be swapped)", async () => {
    const { deps, calls } = makeDeps();
    const result = await processTenantLead(
      goodInput({ tenantId: OTHER, siteToken: signSiteLeadToken(TENANT)! }),
      { ip: null },
      deps,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unavailable");
    assert.equal(calls.inserted.length, 0);
    assert.equal(calls.loaded.length, 0, "no tenant lookup before the token checks out");
  });

  it("refuses when the tenant is missing or not live", async () => {
    for (const tenant of [null, { id: TENANT, status: "onboarding", businessName: "A" }]) {
      const { deps, calls } = makeDeps({ loadTenant: async () => tenant });
      const result = await processTenantLead(goodInput(), { ip: null }, deps);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "unavailable");
      assert.equal(calls.inserted.length, 0);
    }
  });

  it("passes the configured per-IP and per-email limits and a one-hour window to the database step", async () => {
    const { deps, calls } = makeDeps();
    await processTenantLead(goodInput(), { ip: "203.0.113.9" }, deps);
    assert.deepEqual(calls.submitArgs[0].limits, {
      perIp: RATE_LIMITS.perIp,
      perEmail: RATE_LIMITS.perEmail,
    });
    assert.equal(
      calls.submitArgs[0].windowStartIso,
      new Date(NOW - RATE_WINDOW_MS).toISOString(),
    );
    assert.equal(isRateLimited({ ip: 5, email: 0 }), true, "the helper agrees with the limit");
  });

  it("reports rate_limited when the database refuses, and stores nothing", async () => {
    const { deps, calls } = makeDeps({ submitResult: { status: "rate_limited" } });
    const result = await processTenantLead(goodInput(), { ip: "203.0.113.9" }, deps);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "rate_limited");
    assert.equal(calls.inserted.length, 0);
    assert.equal(calls.notified, 0);
  });

  it("reports a safe error when the database step fails", async () => {
    const { deps, calls } = makeDeps({ submitResult: { status: "error" } });
    const result = await processTenantLead(goodInput(), { ip: null }, deps);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "error");
      assert.match(result.error, /call us/i);
    }
    assert.equal(calls.notified, 0);
  });

  it("a failing notification does not fail the submission", async () => {
    const { deps } = makeDeps({
      notify: async () => {
        throw new Error("smtp down");
      },
    });
    const result = await processTenantLead(goodInput(), { ip: null }, deps);
    assert.deepEqual(result, { ok: true });
  });

  it("saves but does not email during a flood", async () => {
    const { deps, calls } = makeDeps({
      submitResult: { status: "ok", id: "lead-9", tenantCount: 25 },
    });
    const result = await processTenantLead(goodInput(), { ip: null }, deps);
    assert.deepEqual(result, { ok: true });
    assert.equal(calls.inserted.length, 1);
    assert.equal(calls.notified, 0);
  });

  it("fails closed when no signing secret is configured", async () => {
    const input = goodInput();
    delete process.env.WAAS_LEAD_FORM_SECRET;
    delete process.env.AUDIT_SHARE_SECRET;
    delete process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
    const { deps, calls } = makeDeps();
    const result = await processTenantLead(input, { ip: null }, deps);
    assert.equal(result.ok, false);
    assert.equal(calls.inserted.length, 0);
  });
});
