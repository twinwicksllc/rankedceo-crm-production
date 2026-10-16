// =============================================================================
// lib/waas/client-edit/regeneratable-sections.ts
// Single source of truth for which sections the AI regeneration action may
// rewrite, and which leaf fields it may rewrite in each.
//
// Pure data (no I/O, no server-only imports) so both the server action
// (lib/waas/actions/client-edit/section-regen.ts) and the editor UI
// (app/edit/[reviewToken]/field-navigator.tsx) import the same list and cannot
// drift.
//
// `reviews` is deliberately absent: the Reviews section carries owner-entered
// social proof, and an AI-written subheadline is exactly how a fabricated
// testimonial ("... — Verified Customer") reaches a live tenant site.
// =============================================================================

import type { SectionId } from "@/lib/waas/templates/types";

export interface RegeneratableLeafField {
  key: string;
  label: string;
  maxLen: number;
}

export const REGENERATABLE_LEAF_FIELDS: Partial<
  Record<SectionId, RegeneratableLeafField[]>
> = {
  hero: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "primaryCtaLabel", label: "Primary CTA", maxLen: 40 },
    { key: "secondaryCtaLabel", label: "Secondary CTA", maxLen: 40 },
    { key: "locationBadge", label: "Location Badge", maxLen: 80 },
  ],
  "answer-first-aeo": [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "intro", label: "Intro", maxLen: 300 },
  ],
  "bento-emergency": [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "bottomCtaText", label: "Bottom CTA", maxLen: 60 },
  ],
  services: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "bottomCtaText", label: "Bottom CTA", maxLen: 60 },
  ],
  trust: [
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
  ],
  about: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "body", label: "Body", maxLen: 800 },
  ],
  faq: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "intro", label: "Intro", maxLen: 300 },
  ],
  "how-it-works": [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "intro", label: "Intro", maxLen: 300 },
  ],
  booking: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
    { key: "primaryCtaLabel", label: "Primary CTA", maxLen: 40 },
  ],
  // `reviews` is deliberately absent: the Reviews section carries owner-entered
  // social proof, and an AI-written subheadline is exactly how a fabricated
  // testimonial ("... — Verified Customer") gets onto a live site.
  gallery: [
    { key: "eyebrow", label: "Eyebrow", maxLen: 60 },
    { key: "headline", label: "Headline", maxLen: 120 },
  ],
  financing: [
    { key: "headline", label: "Headline", maxLen: 120 },
    { key: "subheadline", label: "Subheadline", maxLen: 240 },
  ],
};

/** Section ids the AI regeneration action accepts. */
export const REGENERATABLE_SECTION_IDS: SectionId[] = Object.keys(
  REGENERATABLE_LEAF_FIELDS,
) as SectionId[];

/** True when `sectionId` may be rewritten by AI regeneration. */
export function isRegeneratableSection(sectionId: SectionId): boolean {
  const fields = REGENERATABLE_LEAF_FIELDS[sectionId];
  return Array.isArray(fields) && fields.length > 0;
}
