import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateLeadInput } from "./lead-submit-validation";

// The action now writes with the admin client, which bypasses RLS, so the input
// is validated on the server before anything is written.

const hvac = {
  operator_id: null,
  industry: "hvac",
  customer_name: "Ada Lovelace",
  customer_email: "ada@example.com",
  customer_phone: "555-010-0100",
  urgency: "scheduled",
  preferred_contact_method: "phone",
  service_details: {
    service_type: "ac_repair",
    symptoms: [],
    property_type: "residential",
  },
};

test("a valid HVAC submission passes and keeps its fields", () => {
  const result = validateLeadInput(hvac);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.industry, "hvac");
    assert.equal(result.data.customer_email, "ada@example.com");
  }
});

test("an invalid email, a short phone and a short name are rejected", () => {
  for (const bad of [
    { ...hvac, customer_email: "not-an-email" },
    { ...hvac, customer_phone: "123" },
    { ...hvac, customer_name: "A" },
  ]) {
    assert.equal(validateLeadInput(bad).ok, false);
  }
});

test("an industry that is not one of the three is rejected", () => {
  assert.equal(validateLeadInput({ ...hvac, industry: "smile" }).ok, false);
  assert.equal(validateLeadInput({ ...hvac, industry: "x" }).ok, false);
});

test("service_details is checked against that industry's schema", () => {
  assert.equal(
    validateLeadInput({
      ...hvac,
      service_details: { service_type: "leak_repair" },
    }).ok,
    false,
    "a plumbing service type is not valid for hvac",
  );
});

test("an operator_id that is not a uuid is rejected", () => {
  assert.equal(validateLeadInput({ ...hvac, operator_id: "abc" }).ok, false);
  assert.equal(
    validateLeadInput({
      ...hvac,
      operator_id: "11111111-1111-4111-a111-111111111111",
    }).ok,
    true,
  );
});

test("an oversized notes field is rejected", () => {
  assert.equal(
    validateLeadInput({ ...hvac, notes: "x".repeat(1001) }).ok,
    false,
  );
});

test("a missing or non-object body is rejected without throwing", () => {
  for (const bad of [null, undefined, "text", 42, []]) {
    assert.doesNotThrow(() => validateLeadInput(bad));
    assert.equal(validateLeadInput(bad).ok, false);
  }
});

test("the failure message names no field value (no customer data in logs)", () => {
  const result = validateLeadInput({ ...hvac, customer_email: "secret@x" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(!result.error.includes("secret@x"));
});

// ---------------------------------------------------------------------------
// The action
// ---------------------------------------------------------------------------

const action = readFileSync(
  new URL("../actions/industry-lead.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

const submit = action.slice(
  action.indexOf("export async function submitIndustryLead"),
  action.indexOf("export async function getIndustryLeads"),
);

test("the submit action validates before it writes", () => {
  assert.match(submit, /validateLeadInput\(/);
  assert.ok(
    submit.indexOf("validateLeadInput(") < submit.indexOf(".insert("),
    "validation must come before the insert",
  );
});

test("the submit action writes with the admin client, not the anon client", () => {
  assert.match(submit, /createAdminClient\(\)/);
  assert.ok(!/createAnonClient/.test(submit), "anon has no insert policy");
});

test("the lead id is still generated here, with no returning select", () => {
  assert.match(submit, /crypto\.randomUUID\(\)/);
  assert.ok(!/\.insert\([^)]*\)\s*\.select/.test(submit));
});
