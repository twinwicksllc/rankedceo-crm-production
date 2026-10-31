import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanText, validateTenantLeadInput } from "./tenant-lead";

const base = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  siteToken: "x".repeat(20),
  name: "Jane Smith",
  email: "Jane@Example.com ",
};

describe("cleanText", () => {
  it("strips tags and control characters and collapses whitespace", () => {
    assert.equal(cleanText("  <b>Hi</b>\u0000   there  "), "Hi there");
    assert.equal(cleanText("a\n\n  b"), "a\nb");
  });
});

describe("validateTenantLeadInput", () => {
  it("accepts a minimal lead and normalises the email", () => {
    const r = validateTenantLeadInput(base);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.data.email, "jane@example.com");
  });

  it("cleans the message and service, and drops empty optionals", () => {
    const r = validateTenantLeadInput({
      ...base,
      message: "<script>alert(1)</script> need a quote",
      service: "   ",
      phone: "(512) 555-0142",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.doesNotMatch(r.data.message ?? "", /[<>]/);
      assert.match(r.data.message ?? "", /need a quote/);
      assert.equal(r.data.service, undefined);
    }
  });

  it("reports field names, not values", () => {
    const r = validateTenantLeadInput({ ...base, email: "not-an-email", name: "J" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.deepEqual(Object.keys(r.fieldErrors).sort(), ["email", "name"]);
      assert.ok(!JSON.stringify(r.fieldErrors).includes("not-an-email"));
    }
  });

  it("rejects a bad phone, a bad tenant id and oversize messages", () => {
    assert.equal(validateTenantLeadInput({ ...base, phone: "abc" }).ok, false);
    assert.equal(validateTenantLeadInput({ ...base, tenantId: "nope" }).ok, false);
    assert.equal(
      validateTenantLeadInput({ ...base, message: "a".repeat(2500) }).ok,
      false,
    );
  });

  it("keeps only the origin and path of the page url", () => {
    const r = validateTenantLeadInput({
      ...base,
      pageUrl: "https://acme.com/services?utm=1#x",
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.data.pageUrl, "https://acme.com/services");
    const bad = validateTenantLeadInput({ ...base, pageUrl: "javascript:alert(1)" });
    assert.equal(bad.ok, true);
    if (bad.ok) assert.equal(bad.data.pageUrl, undefined);
  });

  it("rejects non-objects", () => {
    assert.equal(validateTenantLeadInput(null).ok, false);
    assert.equal(validateTenantLeadInput([]).ok, false);
    assert.equal(validateTenantLeadInput("x").ok, false);
  });
});
