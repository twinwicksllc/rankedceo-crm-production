// lib/waas/services/audit-engine/gbp-summary.ts
//
// Plain-language lines for the Google Business Profile analysis (A3), shared by
// the report page and the PDF so both say the same thing. Type-only imports.

import type { GbpAnalysis, NapStatus } from "./gbp-analysis";

export const NAP_STATUS_LABEL: Record<NapStatus, string> = {
  match: "Consistent with your website",
  partial: "Partly checked, no conflicts found",
  mismatch: "Does not match your website",
  unknown: "Could not be compared",
};

export function gbpSummaryLines(gbp: GbpAnalysis): string[] {
  if (!gbp.found || !gbp.place) {
    return [
      `Your business was not in the top ${gbp.places_checked} Google Maps results for "${gbp.keyword}". That does not mean you have no Google Business Profile; Google only showed us the top results for this search.`,
    ];
  }

  const lines: string[] = [];
  const { place } = gbp;
  lines.push(
    `Listing found: ${place.title} (#${place.position}${place.category ? `, ${place.category}` : ""}).`,
  );

  if (gbp.completeness?.score != null) {
    const missing = gbp.completeness.missing;
    lines.push(
      `Profile completeness: ${gbp.completeness.score}/100${missing.length > 0 ? `. Missing or weak: ${missing.join(", ")}` : ""}.`,
    );
  }

  if (gbp.nap) {
    lines.push(`Name, address and phone: ${NAP_STATUS_LABEL[gbp.nap.status]}.`);
    if (gbp.nap.phone === "mismatch") {
      lines.push(
        `Phone on your website: ${gbp.nap.site.phone}. On Google: ${gbp.nap.gbp.phone}.`,
      );
    }
    if (gbp.nap.address === "mismatch") {
      lines.push(
        `Address on your website: ${gbp.nap.site.address}. On Google: ${gbp.nap.gbp.address}.`,
      );
    }
    if (gbp.nap.name === "mismatch") {
      lines.push(
        `Name on your website: ${gbp.nap.site.name}. On Google: ${gbp.nap.gbp.name}.`,
      );
    }
  }

  const gap = gbp.review_gap;
  if (gap && gap.target_count != null) {
    const rating = gap.target_rating != null ? ` (rating ${gap.target_rating})` : "";
    const versus =
      gap.competitor_median_count != null
        ? gap.competitors_compared === 1
          ? `; the competitor we compared has ${gap.competitor_median_count}`
          : `; the ${gap.competitors_compared} competitors we compared have a median of ${gap.competitor_median_count}`
        : "";
    lines.push(`Google reviews: ${gap.target_count}${rating}${versus}.`);
  } else if (place.rating_count != null) {
    lines.push(
      `Google reviews: ${place.rating_count}${place.rating != null ? ` (rating ${place.rating})` : ""}.`,
    );
  }

  return lines;
}
