import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  REGENERATABLE_LEAF_FIELDS,
  REGENERATABLE_SECTION_IDS,
  isRegeneratableSection,
} from "./regeneratable-sections";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

test("reviews can never be AI-regenerated", () => {
  assert.equal(isRegeneratableSection("reviews"), false);
  assert.ok(!REGENERATABLE_SECTION_IDS.includes("reviews"));
  assert.equal(REGENERATABLE_LEAF_FIELDS.reviews, undefined);
});

test("other sections keep their regeneratable fields", () => {
  assert.equal(isRegeneratableSection("hero"), true);
  assert.ok((REGENERATABLE_LEAF_FIELDS.hero ?? []).length > 0);
});

test("the editor UI uses the shared allow-list (no drift)", () => {
  const src = readFileSync(
    path.join(repoRoot, "app/edit/[reviewToken]/field-navigator.tsx"),
    "utf8",
  );
  assert.ok(src.includes("REGENERATABLE_SECTION_IDS"));
  assert.ok(!/REGENERATABLE_SECTIONS\b/.test(src));
  assert.ok(!/"reviews"/.test(src));
});

test("the server action uses the shared allow-list", () => {
  const src = readFileSync(
    path.join(repoRoot, "lib/waas/actions/client-edit/section-regen.ts"),
    "utf8",
  );
  assert.ok(src.includes("isRegeneratableSection(sectionId)"));
  assert.ok(!/reviews:\s*\[/.test(src));
});
