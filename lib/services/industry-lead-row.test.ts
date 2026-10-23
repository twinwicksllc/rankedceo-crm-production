import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LEAD_COLUMNS,
  fromLeadRow,
  toLeadInsertRow,
  toLeadUpdatePatch,
  type LeadRow,
} from "./industry-lead-row";
import { buildQuoteLeadRow } from "./quote-lead";

const input = {
  operator_id: null,
  industry: "hvac" as const,
  customer_name: "Ada Lovelace",
  customer_email: "Ada@Example.com",
  customer_phone: "555-0100",
  service_address: "1 Main St",
  city: "Denver",
  state: "CO",
  zip_code: "80202",
  urgency: "emergency" as const,
  preferred_contact_method: "text" as const,
  preferred_time: "mornings",
  notes: "Gas smell",
  service_details: { service_type: "heating_repair", symptoms: ["no heat"] },
};

const base: LeadRow = {
  id: "lead-1",
  created_at: "2026-10-23T12:00:00Z",
  updated_at: "2026-10-23T12:30:00Z",
  account_id: "acct-1",
  auth_user_id: null,
  industry: "hvac",
};

test("the insert row uses only columns that exist on the table", () => {
  const row = toLeadInsertRow("acct-1", "user-1", input);
  for (const key of Object.keys(row)) {
    assert.ok(
      (LEAD_COLUMNS as readonly string[]).includes(key),
      `${key} is not a live column`,
    );
  }
});

test("insert row: contact fields to lead_*, the rest into problem_description", () => {
  const row = toLeadInsertRow("acct-1", "user-1", input);
  assert.equal(row.lead_name, "Ada Lovelace");
  assert.equal(row.lead_email, "ada@example.com");
  assert.equal(row.lead_phone, "555-0100");
  assert.equal(row.status, "new");
  assert.equal(row.urgency, "emergency");
  assert.equal(row.auth_user_id, "user-1");
  assert.deepEqual(row.problem_description, {
    service_address: "1 Main St",
    city: "Denver",
    state: "CO",
    zip_code: "80202",
    preferred_contact_method: "text",
    preferred_time: "mornings",
    notes: "Gas smell",
    service_details: { service_type: "heating_repair", symptoms: ["no heat"] },
  });
  assert.deepEqual(row.metadata, {});
});

test("what a form writes comes back unchanged through fromLeadRow", () => {
  const written = toLeadInsertRow("acct-1", "user-1", input);
  const lead = fromLeadRow({ ...base, ...written, auth_user_id: "user-1" });
  assert.equal(lead.customer_name, "Ada Lovelace");
  assert.equal(lead.customer_email, "ada@example.com");
  assert.equal(lead.customer_phone, "555-0100");
  assert.equal(lead.city, "Denver");
  assert.equal(lead.state, "CO");
  assert.equal(lead.zip_code, "80202");
  assert.equal(lead.preferred_contact_method, "text");
  assert.equal(lead.notes, "Gas smell");
  assert.deepEqual(lead.service_details, input.service_details);
  assert.equal(lead.submitted_at, base.created_at);
  assert.equal(lead.estimated_value, null);
});

test("a landing quote row is readable and its service_details is an object", () => {
  const quote = buildQuoteLeadRow("acct-1", "smile", {
    firstname: "Ada",
    lastname: "Lovelace",
    email: "ada@example.com",
    phone: "555-0100",
    zipcode: "80202",
  });
  const lead = fromLeadRow({ ...base, ...quote, industry: "smile" });
  assert.equal(lead.customer_name, "Ada Lovelace");
  assert.equal(lead.zip_code, "80202");
  assert.deepEqual(lead.service_details, {});
  assert.doesNotThrow(() => Object.keys(lead.service_details));
});

test("a chat-agent lead (no details, empty phone) maps without throwing", () => {
  const lead = fromLeadRow({
    ...base,
    lead_name: "Valued Lead",
    lead_email: "",
    lead_phone: "",
    problem_description: {},
    metadata: {},
  });
  assert.equal(lead.customer_name, "Valued Lead");
  assert.deepEqual(lead.service_details, {});
  assert.equal(lead.city, null);
  assert.equal(lead.preferred_contact_method, "phone");
});

test("null, string and array jsonb all map to empty details", () => {
  for (const bad of [null, "text", ["a"], 42, undefined]) {
    const lead = fromLeadRow({
      ...base,
      problem_description: bad,
      metadata: bad,
    });
    assert.deepEqual(lead.service_details, {});
    assert.equal(lead.notes, null);
    assert.equal(lead.estimated_value, null);
    assert.equal(lead.assigned_to, null);
  }
});

test("an update patch sets status as a column and merges, not replaces, jsonb", () => {
  const existing = {
    problem_description: { city: "Denver", notes: "old" },
    metadata: { assigned_to: "op-1" },
  };
  const patch = toLeadUpdatePatch(existing, {
    status: "contacted",
    notes: "called back",
    estimated_value: 450,
  });
  assert.equal(patch.status, "contacted");
  assert.deepEqual(patch.problem_description, {
    city: "Denver",
    notes: "called back",
  });
  assert.deepEqual(patch.metadata, {
    assigned_to: "op-1",
    estimated_value: 450,
  });
  assert.ok(!("estimated_value" in patch), "estimated_value is not a column");
  assert.ok(!("notes" in patch), "notes is not a column");
});

test("an update that touches only status leaves both jsonb columns alone", () => {
  const patch = toLeadUpdatePatch(
    { problem_description: { city: "Denver" }, metadata: {} },
    { status: "lost" },
  );
  assert.deepEqual(patch, { status: "lost" });
});

test("clearing estimated_value to null is kept, not dropped", () => {
  const patch = toLeadUpdatePatch(
    { problem_description: {}, metadata: { estimated_value: 100 } },
    { estimated_value: null },
  );
  assert.deepEqual(patch.metadata, { estimated_value: null });
});
