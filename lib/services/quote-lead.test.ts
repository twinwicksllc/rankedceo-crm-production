import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildQuoteLeadRow } from "./quote-lead";

// The live CRM industry_leads table has only: id, created_at, updated_at,
// account_id, auth_user_id, industry, lead_name, lead_email, lead_phone,
// urgency, status, problem_description (jsonb) and metadata (jsonb).
// waas/030 defines the same CREATE TABLE. The quote form must write only those.
const LIVE_COLUMNS = new Set([
  "id",
  "created_at",
  "updated_at",
  "account_id",
  "auth_user_id",
  "industry",
  "lead_name",
  "lead_email",
  "lead_phone",
  "urgency",
  "status",
  "problem_description",
  "metadata",
]);

const fields = {
  firstname: "Ada",
  lastname: "Lovelace",
  email: "Ada@Example.com",
  phone: "555-0100",
  zipcode: "80202",
  notes: "Crown on tooth 14",
  urgency: "emergency",
  preferred_contact_method: "text",
};

test("the row uses only columns that exist in the live table", () => {
  const row = buildQuoteLeadRow("account-1", "smile", fields);
  for (const key of Object.keys(row)) {
    assert.ok(LIVE_COLUMNS.has(key), `column ${key} is not in the live table`);
  }
});

test("name, email and phone go to the lead_* columns", () => {
  const row = buildQuoteLeadRow("account-1", "smile", fields);
  assert.equal(row.lead_name, "Ada Lovelace");
  assert.equal(row.lead_email, "ada@example.com");
  assert.equal(row.lead_phone, "555-0100");
  assert.equal(row.account_id, "account-1");
  assert.equal(row.industry, "smile");
  assert.equal(row.status, "new");
});

test("zip, contact method and notes are kept in problem_description", () => {
  const row = buildQuoteLeadRow("account-1", "smile", fields);
  assert.deepEqual(row.problem_description, {
    zip_code: "80202",
    preferred_contact_method: "text",
    notes: "Crown on tooth 14",
  });
});

test("defaults: urgency scheduled, contact method phone, notes null", () => {
  const row = buildQuoteLeadRow("account-1", "hvac", {
    ...fields,
    urgency: "",
    preferred_contact_method: "",
    notes: "",
  });
  assert.equal(row.urgency, "scheduled");
  assert.deepEqual(row.problem_description, {
    zip_code: "80202",
    preferred_contact_method: "phone",
    notes: null,
  });
});

test("the quote route writes the row from buildQuoteLeadRow, with no customer_* columns", () => {
  const route = readFileSync(
    new URL("../../app/api/landing/quote/route.ts", import.meta.url),
    "utf-8",
  );
  assert.match(route, /buildQuoteLeadRow\(/);
  assert.ok(
    !route.includes("customer_"),
    "route still names customer_* columns",
  );
});
