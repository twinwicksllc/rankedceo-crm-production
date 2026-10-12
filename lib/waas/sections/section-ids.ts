// =============================================================================
// lib/waas/sections/section-ids.ts
// Stable section ids (B4+B3 plan, PR 2). Pure functions, no I/O.
//
// An id is written once and never reused. The first section of a type gets
// id = type ("hero"); any further one gets "<type>-<suffix>". Runtime additions
// use a random suffix, so a deleted id is never handed out again and no counter
// has to be stored (sections_json is a bare array, so there is nowhere to keep
// one).
// =============================================================================

import type { SectionConfig, SectionId } from "@/lib/waas/templates/types";

/** Lowercase letters, digits and hyphens; 1-48 chars; starts with a letter/digit. */
export const SECTION_ID_PATTERN = "[a-z0-9][a-z0-9-]{0,47}";
const SECTION_ID_RE = new RegExp(`^${SECTION_ID_PATTERN}$`);

export function isValidSectionId(value: unknown): value is string {
  return typeof value === "string" && SECTION_ID_RE.test(value);
}

/**
 * A real section entry. The old index bug (see B4_B3 plan, section 2) could
 * leave a stray `{ content: ... }` object or `null` in the array; those are not
 * sections, get no id, and are ignored by the helpers below.
 */
export function isSectionLike(value: unknown): value is SectionConfig {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { section?: unknown }).section === "string"
  );
}

/** True when there is at least one section and each has a unique valid id. */
export function hasStableIds(sections: ReadonlyArray<unknown>): boolean {
  const real = sections.filter(isSectionLike);
  if (real.length === 0) return false;
  const seen = new Set<string>();
  for (const s of real) {
    if (!isValidSectionId(s.id) || seen.has(s.id)) return false;
    seen.add(s.id);
  }
  return true;
}

/**
 * Give every section without a valid id one. Existing ids are kept; stray
 * non-section entries pass through untouched. Used for the one-time backfill
 * and for freshly generated sections (no history exists yet, so a
 * deterministic "<type>-2", "<type>-3" is safe). Does not mutate the input.
 */
export function assignMissingIds<T>(sections: T[]): T[] {
  const taken = new Set<string>();
  for (const s of sections) {
    if (isSectionLike(s) && isValidSectionId(s.id)) taken.add(s.id);
  }
  return sections.map((entry) => {
    if (!isSectionLike(entry)) return entry;
    const s = entry;
    // A duplicate of an earlier id is as bad as a missing one.
    if (isValidSectionId(s.id) && !isDuplicate(sections, s)) return entry;
    let candidate: string = s.section;
    for (let n = 2; taken.has(candidate); n++) candidate = `${s.section}-${n}`;
    taken.add(candidate);
    return { ...s, id: candidate } as T;
  });
}

function isDuplicate(all: ReadonlyArray<unknown>, s: SectionConfig): boolean {
  return all.find((o) => isSectionLike(o) && o.id === s.id) !== s;
}

const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Id for a section added at runtime (Layout editor). Random suffix so an id is
 * never reused after a delete. `rng` is injectable for tests.
 */
export function newSectionId(
  type: string,
  taken: ReadonlySet<string>,
  rng: () => number = Math.random,
): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += SUFFIX_CHARS[Math.floor(rng() * SUFFIX_CHARS.length)];
    }
    const candidate = `${type}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Could not generate a unique section id");
}

// ---------------------------------------------------------------------------
// Edit paths
//   numeric:  sections[3].content.headline        (position in the array)
//   by id:    sections[id=services-k3f9].content.headline
// ---------------------------------------------------------------------------

/** Regex source for the bracket part of a section path (numeric or id). */
export const SECTION_REF_PATTERN = `(?:\\d+|id=${SECTION_ID_PATTERN})`;

const NUMERIC_SECTION_PATH_RE = /^sections\[\d+\]/;
const ID_SECTION_PATH_RE = new RegExp(
  `^sections\\[id=(${SECTION_ID_PATTERN})\\]`,
);

export function isNumericSectionPath(path: string): boolean {
  return NUMERIC_SECTION_PATH_RE.test(path);
}

export function sectionIdFromPath(path: string): string | null {
  const m = path.match(ID_SECTION_PATH_RE);
  return m ? m[1] : null;
}

export type ResolvedPath =
  { ok: true; path: string } | { ok: false; error: string };

/**
 * Turn an id path into the numeric path for this exact array (the patcher works
 * on array positions). Numeric and non-section paths pass through unchanged.
 */
export function resolveSectionPath(
  sections: ReadonlyArray<SectionConfig>,
  path: string,
): ResolvedPath {
  const id = sectionIdFromPath(path);
  if (id === null) return { ok: true, path };
  const index = sections.findIndex((s) => isSectionLike(s) && s.id === id);
  if (index < 0) {
    return { ok: false, error: `Section "${id}" no longer exists.` };
  }
  return {
    ok: true,
    path: path.replace(ID_SECTION_PATH_RE, `sections[${index}]`),
  };
}

/** `sections[id=hero]` for a section, or null when it has no id yet. */
export function idPathPrefix(section: SectionConfig): string | null {
  return isValidSectionId(section.id) ? `sections[id=${section.id}]` : null;
}

/**
 * The identity of a section: its stable id once it has one, otherwise its type
 * (legacy data has one section per type, so the type was the identity).
 */
export function sectionKey(
  section: Pick<SectionConfig, "id" | "section">,
): string {
  return isValidSectionId(section.id) ? section.id : section.section;
}

// ---------------------------------------------------------------------------
// Id -> section type (for display only; the type never decides identity)
// ---------------------------------------------------------------------------

// Typed as a full Record so adding a SectionId without listing it here is a
// compile error.
const SECTION_TYPE_LOOKUP: Record<SectionId, true> = {
  hero: true,
  "answer-first-aeo": true,
  "bento-emergency": true,
  services: true,
  trust: true,
  financing: true,
  booking: true,
  reviews: true,
  about: true,
  faq: true,
  "how-it-works": true,
  gallery: true,
};

/**
 * "services-k3f9" -> { type: "services", suffix: "k3f9" }; "hero" -> { type:
 * "hero", suffix: null }. Longest known type wins ("how-it-works-2" is not
 * type "how"). Returns null when the id does not start with a known type.
 */
export function parseSectionId(
  id: string,
): { type: SectionId; suffix: string | null } | null {
  let best: SectionId | null = null;
  for (const type of Object.keys(SECTION_TYPE_LOOKUP) as SectionId[]) {
    if (id === type || id.startsWith(`${type}-`)) {
      if (!best || type.length > best.length) best = type;
    }
  }
  if (!best) return null;
  return { type: best, suffix: id === best ? null : id.slice(best.length + 1) };
}

/**
 * The single rule for turning a stored edit path into the position path the
 * patcher needs, for one variant's current sections:
 *  - id path        -> resolved to the current array position (fails if gone)
 *  - numeric path   -> accepted only while the variant has no stable ids; once
 *                      it has them a position can point at a different section
 *  - anything else  -> unchanged
 */
export function resolveEditPathForVariant(
  sections: ReadonlyArray<unknown>,
  path: string,
): ResolvedPath {
  if (isNumericSectionPath(path) && hasStableIds(sections)) {
    return {
      ok: false,
      error:
        "This edit uses an out-of-date section reference. Please reload the editor.",
    };
  }
  return resolveSectionPath(sections as ReadonlyArray<SectionConfig>, path);
}

/**
 * Can a stored event be undone by re-applying its path? Old position-based
 * paths stop being safe once the variant has stable ids (a reorder may have
 * moved a different section into that position).
 */
export function isPathUndoable(
  path: string,
  sections: ReadonlyArray<unknown>,
): boolean {
  return !(isNumericSectionPath(path) && hasStableIds(sections));
}
