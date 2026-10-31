// =============================================================================
// Spam and abuse guard for the lead form on customer websites (B5)
//
// Three layers, none needing a third-party service (custom tenant domains make
// reCAPTCHA keys awkward):
//   1. a honeypot field no real visitor fills,
//   2. a minimum fill time (a bot submits instantly),
//   3. a per-hour rate limit counted in the leads table, so it works on
//      serverless where in-memory counters do not.
// A tripped honeypot or timing check returns a fake success so the bot learns
// nothing and retries nothing. Pure functions; the database counts come in from
// the caller.
// =============================================================================

import { createHash } from "node:crypto";

export const MIN_FILL_MS = 2000;
export const RATE_WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMITS = {
  /** Submissions per IP per tenant per window. */
  perIp: 5,
  /** Submissions per email per tenant per window. */
  perEmail: 3,
  /** Above this many leads in a window, new ones are saved but not emailed. */
  perTenantEmails: 20,
} as const;

export type SpamVerdict = "ok" | "bot";

export function checkSpamSignals(input: {
  website?: string | null;
  shownAt?: number | null;
  now: number;
}): SpamVerdict {
  if (input.website && input.website.trim().length > 0) return "bot";
  const shownAt = input.shownAt;
  if (typeof shownAt !== "number" || !Number.isFinite(shownAt)) return "bot";
  // A clock far ahead of the server is not a real fill time.
  if (shownAt > input.now + 60_000) return "bot";
  if (input.now - shownAt < MIN_FILL_MS) return "bot";
  return "ok";
}

export function isRateLimited(counts: {
  ip: number;
  email: number;
}): boolean {
  return counts.ip >= RATE_LIMITS.perIp || counts.email >= RATE_LIMITS.perEmail;
}

/**
 * Salted SHA-256 of the IP, scoped to the tenant so the same visitor is not
 * linkable across customers. The raw address is never stored. Returns null when
 * the address is unknown (then only the email limit applies).
 */
export function hashIp(ip: string | null, tenantId: string): string | null {
  if (!ip) return null;
  const salt = process.env.WAAS_LEAD_IP_SALT?.trim() || "waas-lead-ip";
  return createHash("sha256")
    .update(`${salt}:${tenantId}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** First address of x-forwarded-for, else x-real-ip. */
export function clientIpFromHeaders(
  get: (name: string) => string | null,
): string | null {
  const forwarded = get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  const real = get("x-real-ip")?.trim();
  return real || null;
}
