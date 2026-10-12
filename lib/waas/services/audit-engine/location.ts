// lib/waas/services/audit-engine/location.ts
//
// Resolves the market (city, state) an audit should search in.
//
// Rule (DEC-0003): the location comes from the client's intake form or their
// website. We NEVER fall back to a default city; searching the wrong market
// produces misleading rankings. If nothing can be resolved the caller must
// stop and send the audit to manual review.

import { extractCityFromAddress } from "../serper/location-utils";

export type LocationSource = "intake" | "site_address" | "site_or_ai";

export interface ResolvedAuditLocation {
  /** Human label stored on the audit (e.g. "Nashville, TN"). */
  detectedLocation: string;
  /** Location string sent to the search provider. */
  searchLocation: string;
  /** Where the detected location came from. */
  source: LocationSource;
}

export interface ResolveAuditLocationInput {
  /** Location typed on the intake form, if any. */
  explicit: string | null | undefined;
  /** Location detected from the website or by the AI keyword planner. */
  detectedLocation: string | null | undefined;
  /** Street address found on the website, if any. */
  detectedAddress: string | null | undefined;
}

export class LocationUnresolvedError extends Error {
  constructor() {
    super(
      "Could not determine the business location from the intake form or the website. " +
        "Ask the client for their city and state, then re-run the audit.",
    );
    this.name = "LocationUnresolvedError";
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Normalizes a location for comparison ("Nashville,  TN" == "nashville, tn"). */
export function normalizeLocationKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .trim();
}

/**
 * True when a cached audit's stored market matches the requested one.
 * No requested location means "any market is fine" (the site decides).
 */
export function locationMatchesRequest(
  requested: string | null | undefined,
  stored: string | null | undefined,
): boolean {
  const want = normalizeLocationKey(requested);
  if (!want) return true;
  return normalizeLocationKey(stored) === want;
}

/**
 * Returns the resolved location, or null when none can be determined.
 * The label and the search location both follow the same precedence:
 * intake > city parsed from the site address > site/AI detected.
 * (Without an intake value the site address city is preferred for search,
 * which matches how the engine behaved before this change.)
 */
export function resolveAuditLocation(
  input: ResolveAuditLocationInput,
): ResolvedAuditLocation | null {
  const explicit = clean(input.explicit);
  const detected = clean(input.detectedLocation);
  const addressCity = extractCityFromAddress(clean(input.detectedAddress));

  const detectedLocation = explicit ?? detected ?? addressCity;
  if (!detectedLocation) return null;

  const source: LocationSource = explicit
    ? "intake"
    : detected
      ? "site_or_ai"
      : "site_address";

  return {
    detectedLocation,
    // An explicit intake location is never overridden by the site address.
    searchLocation: explicit ?? addressCity ?? detectedLocation,
    source,
  };
}
