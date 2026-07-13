import test from "node:test";
import assert from "node:assert/strict";

import { buildEditableFields } from "./editable-fields";
import type { SectionConfig } from "@/lib/waas/templates/types";

// ---------------------------------------------------------------------------
// Config-field surfacing (Phase 8.6, audit finding 2.1)
// ---------------------------------------------------------------------------

function bentoSection(config: Record<string, unknown> = {}): SectionConfig {
  return {
    section: "bento-emergency",
    enabled: true,
    order: 0,
    config,
    content: { headline: "Emergency Service" },
  } as SectionConfig;
}

function aeoSection(config: Record<string, unknown> = {}): SectionConfig {
  return {
    section: "answer-first-aeo",
    enabled: true,
    order: 0,
    config,
    content: { headline: "Answers" },
  } as SectionConfig;
}

test("buildEditableFields surfaces bento-emergency config fields with correct paths/kinds", () => {
  const fields = buildEditableFields({
    sections: [bentoSection({ responseMinutes: 30, dispatchFee: 99 })],
    brandConfig: {},
  });

  const responseMinutes = fields.find(
    (f) => f.path === "sections[0].config.responseMinutes",
  );
  assert.ok(responseMinutes, "responseMinutes field should be present");
  assert.equal(responseMinutes?.kind, "number");
  assert.equal(responseMinutes?.value, "30");

  const dispatchFee = fields.find(
    (f) => f.path === "sections[0].config.dispatchFee",
  );
  assert.equal(dispatchFee?.value, "99");

  const visualDirection = fields.find(
    (f) => f.path === "sections[0].config.visualDirection",
  );
  assert.ok(visualDirection, "visualDirection field should be present");
  assert.equal(visualDirection?.kind, "select");
  assert.ok(
    visualDirection?.options?.some((o) => o.value === "signal"),
    "visualDirection should offer the signal preset",
  );
});

test("buildEditableFields falls back to the section's own default when config key is absent", () => {
  // No config at all — every config field should still appear, using its
  // documented default (matching what BentoEmergencySection itself falls
  // back to via readConfigNumber/readConfigString), so the editor never
  // shows a blank/undefined value for a value that IS actually rendering.
  const fields = buildEditableFields({
    sections: [bentoSection()],
    brandConfig: {},
  });

  const responseMinutes = fields.find(
    (f) => f.path === "sections[0].config.responseMinutes",
  );
  assert.equal(responseMinutes?.value, "45");

  const dispatchFee = fields.find(
    (f) => f.path === "sections[0].config.dispatchFee",
  );
  assert.equal(dispatchFee?.value, "89");

  const visualDirection = fields.find(
    (f) => f.path === "sections[0].config.visualDirection",
  );
  assert.equal(visualDirection?.value, "signal");
});

test("buildEditableFields surfaces answer-first-aeo config fields (maxItems/maxAnswerWords/includeJsonLd)", () => {
  const fields = buildEditableFields({
    sections: [
      aeoSection({ maxItems: 4, maxAnswerWords: 50, includeJsonLd: false }),
    ],
    brandConfig: {},
  });

  const maxItems = fields.find((f) => f.path === "sections[0].config.maxItems");
  assert.equal(maxItems?.kind, "number");
  assert.equal(maxItems?.value, "4");

  const includeJsonLd = fields.find(
    (f) => f.path === "sections[0].config.includeJsonLd",
  );
  assert.equal(includeJsonLd?.kind, "boolean");
  assert.equal(includeJsonLd?.value, "false");
});

test("buildEditableFields serializes array config values (brands) as a comma-joined string", () => {
  const fields = buildEditableFields({
    sections: [bentoSection({ brands: ["Kohler", "Moen"] })],
    brandConfig: {},
  });

  const brands = fields.find((f) => f.path === "sections[0].config.brands");
  assert.equal(brands?.kind, "string_list");
  assert.equal(brands?.value, "Kohler, Moen");
});

test("buildEditableFields does not surface config fields for disabled sections", () => {
  const disabledBento = bentoSection({ responseMinutes: 30 });
  disabledBento.enabled = false;

  const fields = buildEditableFields({
    sections: [disabledBento],
    brandConfig: {},
  });

  const responseMinutes = fields.find(
    (f) => f.path === "sections[0].config.responseMinutes",
  );
  assert.equal(
    responseMinutes,
    undefined,
    "disabled sections should not surface config fields",
  );
});

test("buildEditableFields does not add config fields for sections with no config-field definitions", () => {
  const heroSection = {
    section: "hero",
    enabled: true,
    order: 0,
    config: { someRandomKey: "value" },
    content: { headline: "Welcome" },
  } as SectionConfig;

  const fields = buildEditableFields({
    sections: [heroSection],
    brandConfig: {},
  });

  const configFields = fields.filter((f) => f.path.includes(".config."));
  assert.equal(configFields.length, 0);
});
