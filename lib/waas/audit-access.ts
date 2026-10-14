// =============================================================================
// Audit report access control
//
// The public audit report at /audit/[auditId] reads the audits/tenants tables
// with the service-role client (the anon role no longer has SELECT on audits),
// so the page must decide for itself whether the signed-in user may view a
// given audit. This module holds that decision as a pure function so it can be
// unit tested.
//
// Model:
//   - Platform admins see everything.
//   - A tenant owner sees their tenant's audits.
//   - A tenant-linked audit is otherwise private to the address the report was
//     sent to (audits.requestor_email).
//   - A prospect audit (no tenant) is reachable only through its unguessable
//     id, which is emailed to the prospect; any signed-in holder may view it.
//     This matches the pre-existing behavior and keeps the emailed link usable
//     regardless of which email the prospect signed in with (the audit sign-in
//     accepts password / magic-link / Google for any address).
// =============================================================================

export interface AuditAccessRecord {
  tenant_id: string | null;
  requestor_email: string | null;
}

export interface AuditAccessSubject {
  email?: string | null;
}

export interface AuditAccessContext {
  /** True when the signed-in user is a platform admin. */
  isAdmin: boolean;
  /** True when the signed-in user owns the audit's tenant (caller-verified). */
  ownsTenant: boolean;
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Whether the signed-in user may view the audit. Callers must still require a
 * signed-in user before calling this.
 */
export function canViewAudit(
  audit: AuditAccessRecord,
  user: AuditAccessSubject | null | undefined,
  context: AuditAccessContext,
): boolean {
  if (context.isAdmin || context.ownsTenant) return true;

  // Prospect audit: no tenant. The only secret is the unguessable audit id
  // (the report link is emailed to the prospect), so a signed-in holder may
  // view it.
  if (audit.tenant_id === null) return true;

  // Tenant-linked audit: private to the report's addressee.
  const requestor = normalizeEmail(audit.requestor_email);
  const userEmail = normalizeEmail(user?.email);
  return requestor !== "" && userEmail !== "" && requestor === userEmail;
}
