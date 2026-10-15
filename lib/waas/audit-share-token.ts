// =============================================================================
// Audit share token (capability URL)
//
// Decision D1=A: an unlinked prospect audit may be read only by the requester,
// proved by a share token OR a signed-in matching email. The audit sign-in
// accepts any address and `requestor_email` is written only after the download
// form, so the person who just ran an audit (no email captured yet) can only be
// recognised by a token.
//
// The token is derived, not stored: HMAC-SHA256(secret, "audit:" + auditId),
// base64url. No database column, no migration. It travels in the report URL,
// the emailed report/PDF links, and the post-audit redirect as `?token=`.
//
// Secret resolution:
//   1. AUDIT_SHARE_SECRET (dedicated, preferred);
//   2. SUPABASE_SERVICE_ROLE_KEY (fallback so the feature works without a new
//      env var; rotating that key invalidates outstanding share links, which
//      is acceptable for short-lived report links).
// If neither is set (e.g. local dev with no env), signing returns null and the
// callers fall back to sign-in-only access.
// =============================================================================

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "audit:";

function getSecret(): string | null {
  const dedicated = process.env.AUDIT_SHARE_SECRET?.trim();
  if (dedicated) return dedicated;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return fallback || null;
}

/** True when a secret is available and tokens can be issued. */
export function isAuditShareTokenConfigured(): boolean {
  return getSecret() !== null;
}

/**
 * The share token for an audit, or null when no secret is configured.
 * Deterministic: the same audit id always yields the same token.
 */
export function signAuditToken(auditId: string): string | null {
  const secret = getSecret();
  if (!secret || !auditId) return null;
  return createHmac("sha256", secret)
    .update(`${TOKEN_PREFIX}${auditId}`)
    .digest("base64url");
}

/**
 * Constant-time verification of a presented token. Returns false when the
 * token is missing, malformed, or no secret is configured.
 */
export function verifyAuditToken(
  auditId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const expected = signAuditToken(auditId);
  if (!expected) return false;

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(token, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
