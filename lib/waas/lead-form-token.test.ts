import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { signSiteLeadToken, verifySiteLeadToken } from "./lead-form-token";

const NAMES = [
  "WAAS_LEAD_FORM_SECRET",
  "AUDIT_SHARE_SECRET",
  "WAAS_SUPABASE_SERVICE_ROLE_KEY",
] as const;
const saved = Object.fromEntries(NAMES.map((n) => [n, process.env[n]]));
function setOnly(name: (typeof NAMES)[number] | null, value = "secret-one") {
  for (const n of NAMES) delete process.env[n];
  if (name) process.env[name] = value;
}
afterEach(() => {
  for (const n of NAMES) {
    if (saved[n] === undefined) delete process.env[n];
    else process.env[n] = saved[n];
  }
});

describe("site lead token", () => {
  it("verifies the token it signed, for that tenant only", () => {
    setOnly("WAAS_LEAD_FORM_SECRET");
    const token = signSiteLeadToken("tenant-a");
    assert.ok(token);
    assert.equal(verifySiteLeadToken("tenant-a", token), true);
    assert.equal(verifySiteLeadToken("tenant-b", token), false);
  });

  it("rejects missing, malformed and wrong-secret tokens", () => {
    setOnly("WAAS_LEAD_FORM_SECRET");
    const token = signSiteLeadToken("tenant-a");
    assert.equal(verifySiteLeadToken("tenant-a", null), false);
    assert.equal(verifySiteLeadToken("tenant-a", ""), false);
    assert.equal(verifySiteLeadToken("tenant-a", "short"), false);
    setOnly("WAAS_LEAD_FORM_SECRET", "a-different-secret");
    assert.equal(verifySiteLeadToken("tenant-a", token), false);
  });

  it("falls back through the secret list", () => {
    setOnly("AUDIT_SHARE_SECRET");
    assert.ok(signSiteLeadToken("t"));
    setOnly("WAAS_SUPABASE_SERVICE_ROLE_KEY");
    assert.ok(signSiteLeadToken("t"));
  });

  it("fails closed with no secret", () => {
    setOnly(null);
    assert.equal(signSiteLeadToken("t"), null);
    assert.equal(verifySiteLeadToken("t", "anything"), false);
  });
});
