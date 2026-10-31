// lib/waas/services/audit-engine/directory-blocklist.ts
//
// Domains that show up in Google Maps results as a business's "website" but are
// directories, social profiles, marketplaces or lead-gen aggregators, not a
// competing local business. Competitor auto-discovery (A7) skips these.
// Matched on the registrable domain (so "m.yelp.com" and "www.yelp.com" both hit).

// Second-level suffixes where the registrable domain has three labels
// (acme.co.uk, not co.uk). Not exhaustive; covers the markets we serve.
const TWO_LABEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "com.au",
  "net.au",
  "co.nz",
  "co.za",
  "com.br",
  "com.mx",
  "co.in",
  "co.jp",
]);

export const DIRECTORY_BLOCKLIST: ReadonlySet<string> = new Set([
  // Reviews, directories, listings
  "yelp.com",
  "yellowpages.com",
  "yp.com",
  "bbb.org",
  "mapquest.com",
  "tripadvisor.com",
  "manta.com",
  "superpages.com",
  "citysearch.com",
  "foursquare.com",
  "angi.com",
  "angieslist.com",
  "homeadvisor.com",
  "thumbtack.com",
  "porch.com",
  "houzz.com",
  "networx.com",
  "fixr.com",
  "expertise.com",
  "bark.com",
  "birdeye.com",
  "nextdoor.com",
  "trustpilot.com",
  "chamberofcommerce.com",
  "merchantcircle.com",
  "buildzoom.com",
  "homeguide.com",
  // Social and big platforms
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "google.com",
  "goo.gl",
  "apple.com",
  "bing.com",
  "wikipedia.org",
  // Booking and marketplaces
  "amazon.com",
  "ebay.com",
  "groupon.com",
  "opentable.com",
  "booksy.com",
  "vagaro.com",
  "squareup.com",
  "square.site",
  "linktr.ee",
]);

/** Host of a URL or bare domain, lower-cased, without a leading "www.". */
export function hostOf(urlOrDomain: string): string | null {
  const raw = urlOrDomain.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return host.length > 0 && host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/** Registrable domain: "m.yelp.com" -> "yelp.com", "a.b.co.uk" -> "b.co.uk". */
export function registrableDomain(urlOrDomain: string): string | null {
  const host = hostOf(urlOrDomain);
  if (!host) return null;
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (TWO_LABEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}

export function isBlockedDirectory(urlOrDomain: string): boolean {
  const domain = registrableDomain(urlOrDomain);
  return domain !== null && DIRECTORY_BLOCKLIST.has(domain);
}
