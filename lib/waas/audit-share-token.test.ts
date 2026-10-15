import test from "node:test";
import assert from "node:assert/strict";

import {
  isAuditShareTokenConfigured,
  signAuditToken,
  verifyAuditToken,
} from "./audit-share-token";

const AUDIT_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_ID = "99999999-8888-7777-6666-555555555555";

function withSecret<T>(secret: string | undefined, fn: () => T): T {
  const prevDedicated = process.env.AUDIT_SHARE_SECRET;
  const prevFallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    if (secret === undefined) {
      delete process.env.AUDIT_SHARE_SECRET;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.AUDIT_SHARE_SECRET = secret;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    return fn();
  } finally {
    if (prevDedicated === undefined) delete process.env.AUDIT_SHARE_SECRET;
    else process.env.AUDIT_SHARE_SECRET = prevDedicated;
    if (prevFallback === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevFallback;
  }
}

test("signs a deterministic token for an audit id", () => {
  withSecret("s3cret", () => {
    const a = signAuditToken(AUDIT_ID);
    const b = signAuditToken(AUDIT_ID);
    assert.equal(typeof a, "string");
    assert.equal(a, b);
    assert.notEqual(a, signAuditToken(OTHER_ID));
  });
});

test("verifies a token it produced", () => {
  withSecret("s3cret", () => {
    const token = signAuditToken(AUDIT_ID);
    assert.equal(verifyAuditToken(AUDIT_ID, token), true);
  });
});

test("rejects a token for a different audit id", () => {
  withSecret("s3cret", () => {
    const token = signAuditToken(OTHER_ID);
    assert.equal(verifyAuditToken(AUDIT_ID, token), false);
  });
});

test("rejects a token signed with a different secret", () => {
  const token = withSecret("secret-a", () => signAuditToken(AUDIT_ID));
  withSecret("secret-b", () => {
    assert.equal(verifyAuditToken(AUDIT_ID, token), false);
  });
});

test("rejects empty, null and undefined tokens", () => {
  withSecret("s3cret", () => {
    assert.equal(verifyAuditToken(AUDIT_ID, ""), false);
    assert.equal(verifyAuditToken(AUDIT_ID, null), false);
    assert.equal(verifyAuditToken(AUDIT_ID, undefined), false);
  });
});

test("returns null and fails verification when no secret is configured", () => {
  withSecret(undefined, () => {
    assert.equal(isAuditShareTokenConfigured(), false);
    assert.equal(signAuditToken(AUDIT_ID), null);
    assert.equal(verifyAuditToken(AUDIT_ID, "anything"), false);
  });
});

test("falls back to SUPABASE_SERVICE_ROLE_KEY when no dedicated secret", () => {
  const prevDedicated = process.env.AUDIT_SHARE_SECRET;
  const prevFallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.AUDIT_SHARE_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    assert.equal(isAuditShareTokenConfigured(), true);
    const token = signAuditToken(AUDIT_ID);
    assert.equal(verifyAuditToken(AUDIT_ID, token), true);
  } finally {
    if (prevDedicated === undefined) delete process.env.AUDIT_SHARE_SECRET;
    else process.env.AUDIT_SHARE_SECRET = prevDedicated;
    if (prevFallback === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevFallback;
  }
});
