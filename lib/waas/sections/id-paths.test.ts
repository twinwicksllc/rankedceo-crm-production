import test from "node:test";
import assert from "node:assert/strict";

import type { SectionConfig } from "@/lib/waas/templates/types";
import { resolveSections } from "@/lib/waas/templates/registry";
import {
  assetSlotFromPath,
  buildEditableFields,
} from "@/lib/waas/client-edit/editable-fields";
import {
  getValueAtPath,
  setValueAtPath,
  validateEditPath,
  type JsonValue,
} from "@/lib/waas/client-edit/content-paths";
import { formatEditPath } from "@/lib/waas/client-edit/format-path";
import { normalizeVariantSections } from "@/lib/waas/actions/admin/_validation";
import {
  assignMissingIds,
  isPathUndoable,
  resolveEditPathForVariant,
  sectionKey,
} from "./section-ids";

const sec = (
  section: string,
  order: number,
  content: Record<string, unknown> = {},
  extra: Partial<SectionConfig> = {},
): SectionConfig =>
  ({
    section,
    enabled: true,
    order,
    config: {},
    content,
    ...extra,
  }) as SectionConfig;

/** Apply an id path the way updateClientVariantContent does. */
function applyIdEdit(sections: SectionConfig[], path: string, value: string) {
  const resolved = resolveEditPathForVariant(sections, path);
  assert.ok(resolved.ok, resolved.ok ? "" : resolved.error);
  const res = setValueAtPath(
    { sections } as unknown as JsonValue,
    resolved.path,
    value,
  );
  assert.ok(res.ok);
  return (res as unknown as { result: { sections: SectionConfig[] } }).result
    .sections;
}

const withIds = () =>
  assignMissingIds([
    sec("hero", 1, { headline: "HERO" }),
    sec("services", 2, { headline: "SERVICES A" }),
    sec("services", 3, { headline: "SERVICES B" }),
    sec("faq", 4, { headline: "FAQ" }),
  ]);

test("validateEditPath accepts id paths for every allowed shape", () => {
  for (const p of [
    "sections[id=hero].content.headline",
    "sections[id=services-k3f9].content.headline",
    "sections[id=bento-emergency].config.responseMinutes",
    "sections[id=faq].content.faq[0].question",
    "sections[id=about].content.highlights[2]",
    "sections[id=answer-first-aeo].content.items[0].keyFacts[1]",
    "sections[id=services].enabled",
  ]) {
    assert.equal(validateEditPath(p).valid, true, p);
  }
});

test("validateEditPath still rejects bad keys and malformed ids", () => {
  for (const p of [
    "sections[id=hero].content.secretField",
    "sections[id=hero].config.notAllowed",
    "sections[id=].content.headline",
    "sections[id=Hero].content.headline",
    "sections[id=a b].content.headline",
    "sections[id=hero]x.content.headline",
    "sections[id=hero].content.headline.extra",
    "sections[id=../x].content.headline",
  ]) {
    assert.equal(validateEditPath(p).valid, false, p);
  }
});

test("setValueAtPath refuses an unresolved id path (cannot silently misplace)", () => {
  const res = setValueAtPath(
    { sections: withIds() } as unknown as JsonValue,
    "sections[id=hero].content.headline",
    "x",
  );
  assert.equal(res.ok, false);
});

test("an id edit hits the right section after the array is reordered", () => {
  const sections = withIds();
  const reordered = [sections[3], sections[0], sections[2], sections[1]];
  const after = applyIdEdit(
    reordered,
    "sections[id=hero].content.headline",
    "NEW",
  );
  assert.equal(after.length, 4);
  assert.equal(after.find((s) => s.id === "hero")?.content?.headline, "NEW");
  // nothing else changed
  for (const s of reordered.filter((r) => r.id !== "hero")) {
    assert.deepEqual(
      after.find((a) => a.id === s.id),
      s,
    );
  }
});

test("two sections of the same type are edited independently", () => {
  const sections = withIds();
  const a = applyIdEdit(
    sections,
    "sections[id=services].content.headline",
    "A2",
  );
  const b = applyIdEdit(a, "sections[id=services-2].content.headline", "B2");
  assert.equal(b.find((s) => s.id === "services")?.content?.headline, "A2");
  assert.equal(b.find((s) => s.id === "services-2")?.content?.headline, "B2");
});

test("an id that was removed fails instead of editing something else", () => {
  const sections = withIds().filter((s) => s.id !== "services-2");
  const r = resolveEditPathForVariant(
    sections,
    "sections[id=services-2].content.headline",
  );
  assert.equal(r.ok, false);
});

test("numeric paths are rejected once the variant has ids, allowed before", () => {
  const stable = withIds();
  assert.equal(
    resolveEditPathForVariant(stable, "sections[1].content.headline").ok,
    false,
  );
  const legacy = [sec("hero", 1), sec("faq", 2)];
  assert.deepEqual(
    resolveEditPathForVariant(legacy, "sections[1].content.headline"),
    { ok: true, path: "sections[1].content.headline" },
  );
});

test("a stray non-section entry in the array does not stop ids from working", () => {
  const sections = [
    ...withIds(),
    { content: { headline: "stray" } } as unknown as SectionConfig,
  ];
  // The stray entry is ignored for the "has ids" decision...
  assert.equal(
    resolveEditPathForVariant(sections, "sections[0].content.headline").ok,
    false,
  );
  // ...and id paths still resolve to the right position.
  const after = applyIdEdit(sections, "sections[id=faq].content.headline", "F");
  assert.equal(after.length, 5);
  assert.equal(after[3].content?.headline, "F");
});

test("editable fields use id paths and stay valid after a reorder", () => {
  const sections = withIds();
  const reordered = [sections[2], sections[0], sections[3], sections[1]];
  const fields = buildEditableFields({ sections: reordered, brandConfig: {} });
  const second = fields.find(
    (f) => f.path === "sections[id=services-2].content.headline",
  );
  assert.ok(second, "field for the duplicate exists");
  assert.equal(second.value, "SERVICES B");
  assert.equal(second.sectionRef, "services-2");
  // every section field path is an id path and passes validation
  for (const f of fields.filter((x) => x.scope === "section")) {
    assert.match(f.path, /^sections\[id=[a-z0-9-]+\]\./);
    assert.equal(validateEditPath(f.path).valid, true, f.path);
  }
  // applying that field's path changes exactly that section
  const after = applyIdEdit(reordered, second.path, "EDITED");
  assert.equal(
    after.find((s) => s.id === "services-2")?.content?.headline,
    "EDITED",
  );
  assert.equal(
    after.find((s) => s.id === "services")?.content?.headline,
    "SERVICES A",
  );
});

test("field ids are unique even with duplicated section types", () => {
  const fields = buildEditableFields({ sections: withIds(), brandConfig: {} });
  const ids = fields.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("without ids, fields still use the array index (legacy variants)", () => {
  const fields = buildEditableFields({
    sections: [
      sec("hero", 1, { headline: "H" }),
      sec("faq", 2, { headline: "F" }),
    ],
    brandConfig: {},
  });
  const hero = fields.find(
    (f) => f.sectionId === "hero" && f.kind !== "toggle",
  );
  assert.equal(hero?.path, "sections[0].content.headline");
  assert.equal(hero?.sectionRef, undefined);
});

test("assetSlotFromPath handles id paths (valid slug, includes the id)", () => {
  const slot = assetSlotFromPath(
    "sections[id=services-k3f9].content.image_url",
  );
  assert.equal(slot, "section-id-services-k3f9-image");
  assert.match(slot, /^[a-z0-9_-]+$/i);
  assert.equal(
    assetSlotFromPath("sections[id=gallery].content.gallery[2].image_url"),
    "section-id-gallery-gallery-2-image",
  );
  // legacy numeric form unchanged
  assert.equal(
    assetSlotFromPath("sections[0].content.image_url"),
    "section-0-image",
  );
});

test("formatEditPath shows names for id paths and 1-based numbers for old ones", () => {
  assert.equal(
    formatEditPath("sections[id=services].content.headline"),
    "Services › Headline",
  );
  assert.equal(
    formatEditPath("sections[id=services-k3f9].enabled"),
    "Services (k3f9) › Visibility",
  );
  assert.equal(
    formatEditPath("sections[id=how-it-works-2].config.maxItems"),
    "How It Works (2) › Settings › MaxItems",
  );
  assert.equal(
    formatEditPath("sections[3].content.headline"),
    "Section 4 › Headline",
  );
});

test("sectionKey is the id, or the type for legacy sections", () => {
  assert.equal(sectionKey({ section: "hero", id: "hero-2" }), "hero-2");
  assert.equal(sectionKey({ section: "hero" }), "hero");
});

test("saving a layout keeps existing ids and adds missing ones", () => {
  const saved = normalizeVariantSections([
    sec("faq", 2, {}, { id: "faq-x1" }),
    sec("hero", 1),
    sec("faq", 3),
  ]);
  assert.deepEqual(
    saved.map((s) => [s.section, s.id, s.order]),
    [
      ["hero", "hero", 1],
      ["faq", "faq-x1", 2],
      ["faq", "faq", 3],
    ],
  );
});

test("resolveSections keeps every copy of a duplicated type", () => {
  const template = [sec("hero", 1), sec("services", 2), sec("faq", 3)];
  const tenant = assignMissingIds([
    sec("hero", 1, { headline: "H" }),
    sec("services", 2, { headline: "A" }),
    sec("services", 3, { headline: "B" }),
    sec("faq", 4),
  ]);
  const merged = resolveSections(template, tenant);
  assert.deepEqual(
    merged.map((s) => s.id),
    ["hero", "services", "services-2", "faq"],
  );
  assert.equal(merged[2].content?.headline, "B");
});

test("resolveSections is unchanged for single-copy sections", () => {
  const template = [sec("hero", 1, { headline: "T" }), sec("faq", 2)];
  const merged = resolveSections(template, [
    sec("hero", 1, { headline: "Mine" }),
  ]);
  assert.deepEqual(
    merged.map((s) => s.section),
    ["hero", "faq"],
  );
  assert.equal(merged[0].content?.headline, "Mine");
});

// getValueAtPath is used for the old value in history; make sure it is safe
// to call only after resolution.
test("history old value is read from the resolved position", () => {
  const sections = withIds();
  const r = resolveEditPathForVariant(
    sections,
    "sections[id=services-2].content.headline",
  );
  assert.ok(r.ok);
  assert.equal(
    getValueAtPath({ sections } as unknown as JsonValue, r.path),
    "SERVICES B",
  );
});

test("isPathUndoable: numeric paths are read-only once ids exist", () => {
  const stable = withIds();
  const legacy = [sec("hero", 1), sec("faq", 2)];
  assert.equal(isPathUndoable("sections[1].content.headline", stable), false);
  assert.equal(isPathUndoable("sections[1].enabled", stable), false);
  assert.equal(
    isPathUndoable("sections[id=faq].content.headline", stable),
    true,
  );
  assert.equal(isPathUndoable("brand_config.tagline", stable), true);
  // legacy variant (no ids yet): numeric paths still undoable
  assert.equal(isPathUndoable("sections[1].content.headline", legacy), true);
  // no sections loaded: do not block
  assert.equal(isPathUndoable("sections[1].content.headline", []), true);
});
