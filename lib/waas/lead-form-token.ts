// =============================================================================
// Site lead-form token (B5)
//
// The contact form on a customer's website posts to a server action. That action
// must know WHICH customer the lead belongs to without trusting the browser.
// The server page that renders the site signs the tenant id; the action checks
// the signature before it writes anything.
//
// token = HMAC-SHA256(secret, "site-lead:" + tenantId), base64url. Derived, not
// stored, so there is no column or migration. Same idea as audit-share-token.ts.
//
// Secret resolution (first set wins): WAAS_LEAD_FORM_SECRET, AUDIT_SHARE_SECRET,
// WAAS_SUPABASE_SERVICE_ROLE_KEY. If none is set the token is null and the form
// is not shown (fail closed), so a site never offers a form that cannot be
// verified.
// =============================================================================

import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "site-lead:";

function getSecret(): string | null {
  for (const name of [
    "WAAS_LEAD_FORM_SECRET",
    "AUDIT_SHARE_SECRET",
    "WAAS_SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

/** The token for a tenant, or null when no secret is configured. */
export function signSiteLeadToken(tenantId: string): string | null {
  const secret = getSecret();
  if (!secret || !tenantId) return null;
  return createHmac("sha256", secret)
    .update(`${PREFIX}${tenantId}`)
    .digest("base64url");
}

/** Constant-time check of a presented token for a tenant id. */
export function verifySiteLeadToken(
  tenantId: string,
  token: string | null | undefined,
): boolean {
  if (!token || !tenantId) return false;
  const expected = signSiteLeadToken(tenantId);
  if (!expected) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
