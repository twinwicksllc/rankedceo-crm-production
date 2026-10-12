// =============================================================================
// lib/waas/sections/backfill.ts
// Pure planning for the one-time stable-id backfill (B4+B3 plan, PR 2).
// No I/O: scripts/backfill-section-ids.ts reads rows, calls this, and (only with
// --apply) writes the result.
// =============================================================================

import {
  assignMissingIds,
  hasStableIds,
  isSectionLike,
  isValidSectionId,
} from "./section-ids";

export interface BackfillPlan {
  /** What to do with this row. */
  action: "update" | "skip-already-done" | "skip-empty" | "skip-not-array";
  /** The new array to store (only for `update`). */
  next?: unknown[];
  /** Ids that were added (type -> id), for the report. */
  added: string[];
  /** Entries in the array that are not sections (left untouched, reported). */
  strayEntries: number;
}

export function planSectionIdBackfill(value: unknown): BackfillPlan {
  if (!Array.isArray(value)) {
    return {
      action: "skip-not-array",
      added: [],
      strayEntries: 0,
    };
  }
  const strayEntries = value.filter((v) => !isSectionLike(v)).length;
  const real = value.filter(isSectionLike);
  if (real.length === 0) {
    return { action: "skip-empty", added: [], strayEntries };
  }
  if (hasStableIds(value)) {
    return { action: "skip-already-done", added: [], strayEntries };
  }
  const next = assignMissingIds(value);
  const added = next.flatMap((entry, i) => {
    const before = value[i];
    return isSectionLike(entry) &&
      isSectionLike(before) &&
      entry.id !== before.id
      ? [entry.id as string]
      : [];
  });
  return { action: "update", next, added, strayEntries };
}

// ---------------------------------------------------------------------------
// Legacy history rewrite
// ---------------------------------------------------------------------------

const LEADING_NUMERIC_REF = /^sections\[(\d+)\]/;

/**
 * Rewrite an old position-based edit path (`sections[3].content.headline`) to
 * the id path of the section at that array position (`sections[id=faq]...`).
 * Position is correct because the old editor wrote the number straight into the
 * array (see the B4+B3 plan, section 2). Returns null when the path is not a
 * numeric section path, or when that position holds no real section (for
 * example the stray entry the old bug could append); the event is then left
 * as is and shows read-only.
 */
export function rewriteLegacyPath(
  path: string,
  sections: ReadonlyArray<unknown>,
): string | null {
  const m = path.match(LEADING_NUMERIC_REF);
  if (!m) return null;
  const target = sections[Number(m[1])];
  if (!isSectionLike(target) || !isValidSectionId(target.id)) return null;
  return path.replace(LEADING_NUMERIC_REF, `sections[id=${target.id}]`);
}
