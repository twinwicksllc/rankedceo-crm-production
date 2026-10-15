// =============================================================================
// HTTP helpers for the audit API routes
// =============================================================================

/**
 * Cache-Control for the audit status polling response.
 *
 * The response body carries report_data and is authorized per caller (a share
 * token or a signed-in matching email), so it must never be stored by a shared
 * cache — a `public` directive here would let one caller's report be served to
 * another. Always `private, no-store`.
 */
export function auditStatusCacheControl(): string {
  return "private, no-store";
}
