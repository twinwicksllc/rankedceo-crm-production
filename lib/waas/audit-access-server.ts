// =============================================================================
// Server-side audit access authorization
//
// Shared by the report page, the PDF route and the status polling route so the
// D1=A decision lives in one place. All reads use the service-role client (the
// anon role no longer has SELECT on audits/tenants); access is decided here.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { getWaasAdminClient } from "@/lib/waas/supabase";
import { isPlatformAdmin, type AdminCandidate } from "@/lib/auth/admin";
import { canViewAudit, type AuditAccessRecord } from "@/lib/waas/audit-access";
import { verifyAuditToken } from "@/lib/waas/audit-share-token";

export type AuditAccessUser = AdminCandidate & { email?: string | null };

/** True when the given email owns the tenant (tenants.submitted_by_email). */
export async function userOwnsTenant(
  tenantId: string,
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  try {
    const client = getWaasAdminClient();
    const { data } = await client
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .eq("submitted_by_email", email)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/** Minimal access record for an audit, or null when it does not exist. */
export async function fetchAuditAccessRecord(
  auditId: string,
): Promise<(AuditAccessRecord & { id: string }) | null> {
  try {
    const client = getWaasAdminClient();
    const { data } = await client
      .from("audits")
      .select("id, tenant_id, audit_type, requestor_email")
      .eq("id", auditId)
      .maybeSingle();
    return (data as (AuditAccessRecord & { id: string }) | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Decide whether the caller may read the audit. Pass the already-fetched audit
 * row when available (the report page and PDF route fetch it anyway) to avoid a
 * second query; otherwise it is fetched here.
 */
export async function authorizeAuditAccess(params: {
  auditId: string;
  token?: string | null;
  user?: AuditAccessUser | null;
  authClient?: SupabaseClient;
  audit?: AuditAccessRecord | null;
}): Promise<{ allowed: boolean; audit: AuditAccessRecord | null }> {
  const { auditId, token, user, authClient } = params;

  const audit = params.audit ?? (await fetchAuditAccessRecord(auditId));
  if (!audit) return { allowed: false, audit: null };

  const hasValidToken = verifyAuditToken(auditId, token);

  let isAdmin = false;
  let ownsTenant = false;
  if (user && authClient) {
    isAdmin = await isPlatformAdmin(authClient, user);
    if (!isAdmin && audit.tenant_id) {
      ownsTenant = await userOwnsTenant(audit.tenant_id, user.email);
    }
  }

  return {
    allowed: canViewAudit(audit, user, { isAdmin, ownsTenant, hasValidToken }),
    audit,
  };
}
