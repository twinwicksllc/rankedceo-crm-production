// =============================================================================
// Audit report access control
//
// The public audit report at /audit/[auditId] reads the audits/tenants tables
// with the service-role client (the anon role no longer has SELECT on audits),
// so the page must decide for itself whether the caller may view a given audit.
// This module holds that decision as a pure function so it can be unit tested.
//
// Model (decision D1=A): an audit may be read only by
//   - a platform admin,
//   - the tenant owner (a tenant-linked audit),
//   - the holder of a valid share token (the capability link that is emailed to
//     the requester and used in the post-audit redirect), or
//   - a signed-in user whose email matches the audit's requestor_email.
// Everyone else is denied. A prospect audit with no captured email and no
// token is therefore not readable, which is the point: the unguessable id alone
// is no longer enough.
// =============================================================================

export interface AuditAccessRecord {
  tenant_id: string | null;
  requestor_email: string | null;
}

export interface AuditAccessSubject {
  email?: string | null;
}

export interface AuditAccessContext {
  /** True when the caller is a platform admin. */
  isAdmin: boolean;
  /** True when the caller owns the audit's tenant (caller-verified). */
  ownsTenant: boolean;
  /** True when the caller presented a valid share token for this audit. */
  hasValidToken: boolean;
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Whether the caller may view the audit. Callers must still fetch the audit
 * with the service-role client and verify the token before calling this.
 */
export function canViewAudit(
  audit: AuditAccessRecord,
  user: AuditAccessSubject | null | undefined,
  context: AuditAccessContext,
): boolean {
  if (context.isAdmin || context.ownsTenant || context.hasValidToken) return true;

  // Otherwise only the report's addressee may view it, proved by a matching
  // signed-in email.
  const requestor = normalizeEmail(audit.requestor_email);
  const userEmail = normalizeEmail(user?.email);
  return requestor !== "" && userEmail !== "" && requestor === userEmail;
}
