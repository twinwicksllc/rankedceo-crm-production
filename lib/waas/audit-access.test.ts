import test from "node:test";
import assert from "node:assert/strict";

import { canViewAudit } from "./audit-access";

const noAccess = { isAdmin: false, ownsTenant: false, hasValidToken: false };

test("prospect audit with no email is denied without a token", () => {
  const audit = { tenant_id: null, requestor_email: null };
  assert.equal(canViewAudit(audit, { email: "anyone@example.com" }, noAccess), false);
  assert.equal(canViewAudit(audit, null, noAccess), false);
});

test("prospect audit is allowed to the holder of a valid token", () => {
  const audit = { tenant_id: null, requestor_email: null };
  assert.equal(
    canViewAudit(audit, null, { isAdmin: false, ownsTenant: false, hasValidToken: true }),
    true,
  );
  assert.equal(
    canViewAudit(audit, { email: "someone@example.com" }, {
      isAdmin: false,
      ownsTenant: false,
      hasValidToken: true,
    }),
    true,
  );
});

test("prospect audit with a captured email is allowed to that email", () => {
  const audit = { tenant_id: null, requestor_email: "prospect@example.com" };
  assert.equal(canViewAudit(audit, { email: "prospect@example.com" }, noAccess), true);
  assert.equal(canViewAudit(audit, { email: "PROSPECT@example.com " }, noAccess), true);
});

test("prospect audit with a captured email is denied to a different email", () => {
  const audit = { tenant_id: null, requestor_email: "prospect@example.com" };
  assert.equal(canViewAudit(audit, { email: "other@example.com" }, noAccess), false);
  assert.equal(canViewAudit(audit, null, noAccess), false);
});

test("tenant-linked audit is denied to an unrelated user", () => {
  const audit = { tenant_id: "t1", requestor_email: "owner@example.com" };
  assert.equal(canViewAudit(audit, { email: "stranger@example.com" }, noAccess), false);
  assert.equal(canViewAudit(audit, { email: null }, noAccess), false);
  assert.equal(canViewAudit(audit, null, noAccess), false);
});

test("tenant-linked audit is allowed to the report addressee (case-insensitive)", () => {
  const audit = { tenant_id: "t1", requestor_email: "Owner@Example.com" };
  assert.equal(canViewAudit(audit, { email: "owner@example.com" }, noAccess), true);
  assert.equal(canViewAudit(audit, { email: "  OWNER@example.com " }, noAccess), true);
});

test("tenant-linked audit with no requestor email is denied to non-owners", () => {
  const audit = { tenant_id: "t1", requestor_email: null };
  assert.equal(canViewAudit(audit, { email: "stranger@example.com" }, noAccess), false);
});

test("tenant owner can view regardless of requestor email", () => {
  const audit = { tenant_id: "t1", requestor_email: "someone@example.com" };
  assert.equal(
    canViewAudit(audit, { email: "stranger@example.com" }, {
      isAdmin: false,
      ownsTenant: true,
      hasValidToken: false,
    }),
    true,
  );
});

test("admin can view any audit, including tenant-linked ones", () => {
  const audit = { tenant_id: "t1", requestor_email: "someone@example.com" };
  assert.equal(
    canViewAudit(audit, { email: "stranger@example.com" }, {
      isAdmin: true,
      ownsTenant: false,
      hasValidToken: false,
    }),
    true,
  );
});
