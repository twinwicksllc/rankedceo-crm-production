import test from "node:test";
import assert from "node:assert/strict";
import type { SectionConfig } from "@/lib/waas/templates/types";
import {
  assignMissingIds,
  hasStableIds,
  isNumericSectionPath,
  isValidSectionId,
  newSectionId,
  resolveSectionPath,
  sectionIdFromPath,
} from "./section-ids";

const sec = (
  section: string,
  order: number,
  extra: Partial<SectionConfig> = {},
): SectionConfig =>
  ({ section, enabled: true, order, config: {}, ...extra }) as SectionConfig;

test("isValidSectionId accepts slugs and rejects junk", () => {
  assert.equal(isValidSectionId("hero"), true);
  assert.equal(isValidSectionId("answer-first-aeo"), true);
  assert.equal(isValidSectionId("services-k3f9"), true);
  for (const bad of [
    "",
    "-x",
    "A",
    "a b",
    "a.b",
    "a]",
    "x".repeat(49),
    3,
    null,
  ]) {
    assert.equal(isValidSectionId(bad), false, String(bad));
  }
});

test("assignMissingIds: first of a type gets the type, later ones get -2, -3", () => {
  const out = assignMissingIds([
    sec("hero", 1),
    sec("services", 2),
    sec("services", 3),
    sec("services", 4),
  ]);
  assert.deepEqual(
    out.map((s) => s.id),
    ["hero", "services", "services-2", "services-3"],
  );
});

test("assignMissingIds keeps existing ids and never collides with them", () => {
  const out = assignMissingIds([
    sec("services", 1, { id: "services-2" }),
    sec("services", 2),
  ]);
  assert.deepEqual(
    out.map((s) => s.id),
    ["services-2", "services"],
  );
});

test("assignMissingIds does not mutate its input and is idempotent", () => {
  const input = [sec("hero", 1), sec("faq", 2)];
  const once = assignMissingIds(input);
  assert.equal(input[0].id, undefined);
  assert.deepEqual(assignMissingIds(once), once);
});

test("hasStableIds needs every section to have a unique valid id", () => {
  assert.equal(hasStableIds([]), false);
  assert.equal(hasStableIds([sec("hero", 1, { id: "hero" })]), true);
  assert.equal(
    hasStableIds([sec("hero", 1, { id: "hero" }), sec("faq", 2)]),
    false,
  );
  assert.equal(
    hasStableIds([sec("hero", 1, { id: "a" }), sec("faq", 2, { id: "a" })]),
    false,
  );
});

test("newSectionId never returns a taken id, even when the rng repeats", () => {
  const first = newSectionId("services", new Set(), () => 0);
  assert.equal(first, "services-aaaaaa");
  let calls = 0;
  const second = newSectionId("services", new Set([first]), () =>
    calls++ < 6 ? 0 : 0.5,
  );
  assert.notEqual(second, first);
  assert.match(second, /^services-[a-z0-9]{6}$/);
});

test("a removed id is not handed out again (random suffix, not a counter)", () => {
  // Two adds with different random draws give different ids even though the
  // first one was deleted in between (so it is not in `taken`).
  const a = newSectionId("faq", new Set(), () => 0.1);
  const b = newSectionId("faq", new Set(), () => 0.7);
  assert.notEqual(a, b);
});

test("path helpers", () => {
  assert.equal(isNumericSectionPath("sections[3].enabled"), true);
  assert.equal(isNumericSectionPath("sections[id=hero].enabled"), false);
  assert.equal(sectionIdFromPath("sections[id=hero].content.headline"), "hero");
  assert.equal(sectionIdFromPath("sections[2].content.headline"), null);
});

test("resolveSectionPath maps an id to the current array position", () => {
  // Array order differs from `order`: id resolution follows the array.
  const sections = [
    sec("about", 2, { id: "about" }),
    sec("hero", 1, { id: "hero" }),
  ];
  assert.deepEqual(
    resolveSectionPath(sections, "sections[id=hero].content.headline"),
    { ok: true, path: "sections[1].content.headline" },
  );
  assert.deepEqual(resolveSectionPath(sections, "sections[id=about].enabled"), {
    ok: true,
    path: "sections[0].enabled",
  });
});

test("resolveSectionPath: unknown id fails; numeric and brand paths pass through", () => {
  const sections = [sec("hero", 1, { id: "hero" })];
  const missing = resolveSectionPath(sections, "sections[id=gone].enabled");
  assert.equal(missing.ok, false);
  assert.deepEqual(resolveSectionPath(sections, "sections[0].enabled"), {
    ok: true,
    path: "sections[0].enabled",
  });
  assert.deepEqual(resolveSectionPath(sections, "brand_config.tagline"), {
    ok: true,
    path: "brand_config.tagline",
  });
});
