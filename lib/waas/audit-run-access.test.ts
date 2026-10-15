import test from "node:test";
import assert from "node:assert/strict";

import { canReuseCachedAudit } from "./audit-run-access";

// ── Finding 3: a cached audit must not be reused across different requesters ──

test("cached audit is reused only for the same requestor email", () => {
  assert.equal(canReuseCachedAudit("prospect@example.com", "prospect@example.com"), true);
});

test("cached audit reuse is case- and whitespace-insensitive", () => {
  assert.equal(canReuseCachedAudit("Prospect@Example.com ", " prospect@example.com"), true);
});

test("cached audit is NOT reused for a different email", () => {
  assert.equal(canReuseCachedAudit("prospect@example.com", "stranger@example.com"), false);
});

test("cached audit is NOT reused when either side has no email (fail-closed)", () => {
  assert.equal(canReuseCachedAudit(null, "prospect@example.com"), false);
  assert.equal(canReuseCachedAudit("prospect@example.com", null), false);
  assert.equal(canReuseCachedAudit(null, null), false);
  assert.equal(canReuseCachedAudit("", ""), false);
  assert.equal(canReuseCachedAudit(undefined, undefined), false);
});
