// lib/waas/services/audit-engine/competitor-discovery.ts
//
// A7: find competitors from the Google Maps local pack instead of relying only
// on what the visitor typed. Pure functions: the places list comes from the one
// shared /places lookup (local-pack.ts), which already used the resolved search
// location (DEC-0003: never a default city).

import type { PlaceResult } from "../serper";
import { isBlockedDirectory, registrableDomain } from "./directory-blocklist";

export const MAX_COMPETITORS = 3;

export interface DiscoveredCompetitor {
  /** Origin of the business website, e.g. "https://acmeplumbing.com". */
  url: string;
  domain: string;
  title: string;
  /** Position in the local pack (1 = best). */
  position: number;
}

/**
 * Pick up to `max` local competitors from `places`, in local-pack rank order.
 * Skips: places with no usable website, the client's own domain, typed
 * competitors (they are already included), blocklisted directories, and
 * duplicates of the same registrable domain.
 */
export function discoverCompetitors(opts: {
  places: PlaceResult[];
  targetUrl: string;
  typedCompetitorUrls: string[];
  max?: number;
}): DiscoveredCompetitor[] {
  const max = opts.max ?? MAX_COMPETITORS;
  const excluded = new Set<string>();
  const targetDomain = registrableDomain(opts.targetUrl);
  if (targetDomain) excluded.add(targetDomain);
  for (const url of opts.typedCompetitorUrls) {
    const domain = registrableDomain(url);
    if (domain) excluded.add(domain);
  }

  const found: DiscoveredCompetitor[] = [];
  const ranked = [...opts.places].sort((a, b) => a.position - b.position);
  for (const place of ranked) {
    if (found.length >= max) break;
    if (!place.website) continue;
    const domain = registrableDomain(place.website);
    if (!domain || excluded.has(domain) || isBlockedDirectory(domain)) continue;

    let origin: string;
    try {
      const raw = place.website.includes("://")
        ? place.website
        : `https://${place.website}`;
      origin = new URL(raw).origin;
    } catch {
      continue;
    }

    excluded.add(domain);
    found.push({
      url: origin,
      domain,
      title: place.title,
      position: place.position,
    });
  }
  return found;
}

export interface MergedCompetitors {
  /** Final list the audit runs against: typed first, then discovered. */
  urls: string[];
  /** The subset of `urls` that was auto-discovered. */
  discoveredUrls: string[];
}

/** Typed competitors always win; discovered ones only fill the remaining slots. */
export function mergeCompetitors(
  typedCompetitorUrls: string[],
  discovered: DiscoveredCompetitor[],
  max: number = MAX_COMPETITORS,
): MergedCompetitors {
  const typed = typedCompetitorUrls.slice(0, max);
  const room = Math.max(0, max - typed.length);
  const added = discovered.slice(0, room).map((d) => d.url);
  return { urls: [...typed, ...added], discoveredUrls: added };
}
