import { SECTION_LABELS } from "./editable-fields";
import {
  SECTION_ID_PATTERN,
  parseSectionId,
} from "@/lib/waas/sections/section-ids";

/**
 * Human-readable label for a stored edit path, shared by every edit-history
 * surface (history panel, portal home).
 *
 * Old events use the 0-based position in `sections_json` (shown 1-based); new
 * ones use the section's stable id (shown by section name):
 *   sections[0].content.headline          → "Section 1 › Headline"
 *   sections[2].config.layout             → "Section 3 › Settings › Layout"
 *   sections[1].enabled                   → "Section 2 › Visibility"
 *   sections[id=services].content.title   → "Services › Title"
 *   sections[id=services-k3f9].enabled    → "Services (k3f9) › Visibility"
 */
function sectionName(ref: string): string {
  if (/^\d+$/.test(ref)) return `Section ${Number(ref) + 1}`;
  const id = ref.replace(/^id=/, "");
  const parsed = parseSectionId(id);
  if (!parsed) return id;
  const base = SECTION_LABELS[parsed.type] ?? parsed.type;
  return parsed.suffix ? `${base} (${parsed.suffix})` : base;
}

const REF = `(\\d+|id=${SECTION_ID_PATTERN})`;
const ENABLED_RE = new RegExp(`^sections\\[${REF}\\]\\.enabled$`);
const CONFIG_RE = new RegExp(`^sections\\[${REF}\\]\\.config\\.`);
const CONTENT_RE = new RegExp(`^sections\\[${REF}\\]\\.content\\.`);

export function formatEditPath(path: string): string {
  // Section names are substituted after the generic prettifying below, so their
  // own capitalisation and parentheses are not mangled.
  const marks: string[] = [];
  const mark = (name: string, tail: string): string => {
    marks.push(name);
    return `\u0000${marks.length - 1}\u0000${tail}`;
  };

  const prefixed = path
    .replace(ENABLED_RE, (_m, ref: string) =>
      mark(sectionName(ref), " › Visibility"),
    )
    .replace(CONFIG_RE, (_m, ref: string) =>
      mark(sectionName(ref), " › Settings › "),
    )
    .replace(CONTENT_RE, (_m, ref: string) => mark(sectionName(ref), " › "));

  return prefixed
    .replace(/brand_config\./, "Brand › ")
    .replace(/_/g, " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\s*\.\s*/g, " › ")
    .replace(/\u0000(\d+)\u0000/g, (_m, i: string) => marks[Number(i)]);
}
