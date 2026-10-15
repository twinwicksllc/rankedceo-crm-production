import test from "node:test";
import assert from "node:assert/strict";

import { auditStatusCacheControl } from "./audit-http";

// ── Finding 5: the authorized status response must never be publicly cached ──

test("status response is always private, no-store", () => {
  const value = auditStatusCacheControl();
  assert.equal(value, "private, no-store");
  assert.ok(!value.includes("public"));
  assert.ok(!value.includes("max-age"));
});
