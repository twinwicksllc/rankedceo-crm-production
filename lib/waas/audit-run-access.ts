// =============================================================================
// Pure access helpers for POST /api/audit/run
//
// Kept separate from the route so the decisions are unit-testable.
// =============================================================================

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Whether a cached audit may be returned to this requester.
 *
 * The cache key (target_url + competitor_urls + location) is entirely public,
 * so a cached audit must only be reused when the caller is provably the same
 * requester — i.e. the incoming requestor email matches the one stored on the
 * cached audit. When either side has no email we cannot prove it, so we do not
 * reuse (fail-closed) and the caller gets a fresh audit instead. Without this a
 * stranger repeating someone else's inputs would receive a share token for that
 * person's report.
 */
export function canReuseCachedAudit(
  cachedRequestorEmail: string | null | undefined,
  incomingRequestorEmail: string | null | undefined,
): boolean {
  const cached = normalizeEmail(cachedRequestorEmail);
  const incoming = normalizeEmail(incomingRequestorEmail);
  return cached !== "" && incoming !== "" && cached === incoming;
}
