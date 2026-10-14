import test from "node:test";
import assert from "node:assert/strict";

import { canViewAudit } from "./audit-access";

const noAdmin = { isAdmin: false, ownsTenant: false };

test("prospect audit (no tenant) is viewable by any signed-in user", () => {
  const audit = { tenant_id: null, requestor_email: null };
  assert.equal(canViewAudit(audit, { email: "anyone@example.com" }, noAdmin), true);
  assert.equal(canViewAudit(audit, { email: null }, noAdmin), true);
  assert.equal(canViewAudit(audit, null, noAdmin), true);
});

test("prospect audit with a captured email is still viewable (capability link)", () => {
  const audit = { tenant_id: null, requestor_email: "prospect@example.com" };
  // The audit sign-in accepts any email, so we must not lock out a prospect
  // who signed in with a different address than the one they typed in.
  assert.equal(
    canViewAudit(audit, { email: "other@example.com" }, noAdmin),
    true,
  );
});

test("tenant-linked audit is denied to an unrelated user", () => {
  const audit = { tenant_id: "t1", requestor_email: "owner@example.com" };
  assert.equal(canViewAudit(audit, { email: "stranger@example.com" }, noAdmin), false);
  assert.equal(canViewAudit(audit, { email: null }, noAdmin), false);
  assert.equal(canViewAudit(audit, null, noAdmin), false);
});

test("tenant-linked audit is allowed to the report addressee (case-insensitive)", () => {
  const audit = { tenant_id: "t1", requestor_email: "Owner@Example.com" };
  assert.equal(canViewAudit(audit, { email: "owner@example.com" }, noAdmin), true);
  assert.equal(canViewAudit(audit, { email: "  OWNER@example.com " }, noAdmin), true);
});

test("tenant-linked audit with no requestor email is denied to non-owners", () => {
  const audit = { tenant_id: "t1", requestor_email: null };
  assert.equal(canViewAudit(audit, { email: "stranger@example.com" }, noAdmin), false);
});

test("tenant owner can view regardless of requestor email", () => {
  const audit = { tenant_id: "t1", requestor_email: "someone@example.com" };
  assert.equal(
    canViewAudit(audit, { email: "stranger@example.com" }, {
      isAdmin: false,
      ownsTenant: true,
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
    }),
    true,
  );
});
