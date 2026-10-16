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

// ---------------------------------------------------------------------------
// Edit paths must address the stored array, not the 1-based `order` value.
// Generators write order = index + 1 (see templates/registry.ts `ordered()`).
// ---------------------------------------------------------------------------

import { setValueAtPath, getValueAtPath } from "./content-paths";
import type { JsonValue } from "./content-paths";

function generated(): SectionConfig[] {
  return [
    {
      section: "hero",
      enabled: true,
      order: 1,
      config: {},
      content: { headline: "HERO headline" },
    },
    {
      section: "about",
      enabled: true,
      order: 2,
      config: {},
      content: { headline: "ABOUT headline" },
    },
    {
      section: "faq",
      enabled: true,
      order: 3,
      config: {},
      content: { headline: "FAQ headline" },
    },
  ] as SectionConfig[];
}

function applyEdit(
  sections: SectionConfig[],
  path: string,
  value: string,
): SectionConfig[] {
  const wrapped = { sections } as unknown as JsonValue;
  const res = setValueAtPath(wrapped, path, value);
  assert.ok(res.ok);
  return (res as unknown as { result: { sections: SectionConfig[] } }).result
    .sections;
}

test("editing a headline changes that section (1-based order data)", () => {
  const sections = generated();
  const fields = buildEditableFields({ sections, brandConfig: {} });

  for (const [i, name] of [
    [0, "HERO"],
    [1, "ABOUT"],
    [2, "FAQ"],
  ] as const) {
    const field = fields.find(
      (f) =>
        f.scope === "section" &&
        f.path.endsWith(".content.headline") &&
        f.value === `${name} headline`,
    );
    assert.ok(field, `${name} headline field exists`);
    assert.equal(field?.path, `sections[${i}].content.headline`);

    const after = applyEdit(sections, field!.path, "NEW");
    assert.equal(after.length, 3, "no stray entry appended");
    assert.equal((after[i].content as Record<string, string>).headline, "NEW");
    // the other two are untouched
    for (const j of [0, 1, 2].filter((x) => x !== i)) {
      assert.deepEqual(after[j], sections[j]);
    }
  }
});

test("toggle path and id use the array index too", () => {
  const fields = buildEditableFields({
    sections: generated(),
    brandConfig: {},
  });
  const toggles = fields.filter((f) => f.kind === "toggle");
  assert.deepEqual(
    toggles.map((t) => t.path),
    ["sections[0].enabled", "sections[1].enabled", "sections[2].enabled"],
  );
  assert.deepEqual(
    toggles.map((t) => t.id),
    ["sec-0-enabled", "sec-1-enabled", "sec-2-enabled"],
  );
  assert.deepEqual(
    toggles.map((t) => t.sectionOrder),
    [0, 1, 2],
  );
  assert.deepEqual(
    toggles.map((t) => t.sectionId),
    ["hero", "about", "faq"],
  );
  // value read back through the same path matches the section
  const wrapped = { sections: generated() } as unknown as JsonValue;
  assert.equal(getValueAtPath(wrapped, "sections[1].enabled"), true);
});

test("array NOT sorted by order: paths follow the array, labels follow order", () => {
  const [hero, about, faq] = generated();
  // stored array order: faq, hero, about  (order values 3, 1, 2)
  const sections = [faq, hero, about];
  const fields = buildEditableFields({ sections, brandConfig: {} });

  const heroField = fields.find((f) => f.value === "HERO headline");
  assert.equal(heroField?.path, "sections[1].content.headline");
  const faqField = fields.find((f) => f.value === "FAQ headline");
  assert.equal(faqField?.path, "sections[0].content.headline");

  // display group is numbered by sorted position: hero is 1st
  assert.ok(heroField?.group.startsWith("1."), heroField?.group);
  assert.ok(faqField?.group.startsWith("3."), faqField?.group);

  const after = applyEdit(sections, heroField!.path, "NEW");
  assert.equal(after.length, 3);
  assert.equal((after[1].content as Record<string, string>).headline, "NEW");
});

test("order values with gaps still address the right array slot", () => {
  const sections = generated().map((s, i) => ({ ...s, order: (i + 1) * 10 }));
  const fields = buildEditableFields({ sections, brandConfig: {} });
  const about = fields.find((f) => f.value === "ABOUT headline");
  assert.equal(about?.path, "sections[1].content.headline");
});

// ---------------------------------------------------------------------------
// Owner-entered reviews (B1): every slot is surfaced even when empty
// ---------------------------------------------------------------------------

test("buildEditableFields always surfaces all review slots and Google fields", () => {
  const sections = [
    {
      section: "reviews",
      enabled: true,
      order: 1,
      config: {},
      content: { headline: "What Our Customers Say" },
    } as SectionConfig,
  ];
  const fields = buildEditableFields({ sections, brandConfig: {} });
  const paths = fields.map((f) => f.path);
  assert.ok(paths.includes("sections[0].content.googleRating"));
  assert.ok(paths.includes("sections[0].content.googleReviewCount"));
  for (let i = 0; i < 6; i++) {
    for (const key of ["author", "rating", "text", "date"]) {
      assert.ok(
        paths.includes(`sections[0].content.reviews[${i}].${key}`),
        `${i}.${key}`,
      );
    }
  }
  assert.ok(!paths.includes("sections[0].content.reviews[6].author"));
  const rating = fields.find((f) => f.path.endsWith("reviews[0].rating"));
  assert.equal(rating?.kind, "select");
  assert.equal(rating?.value, "");
});

test("buildEditableFields shows stored review values and skips disabled sections", () => {
  const stored = {
    section: "reviews",
    enabled: true,
    order: 1,
    config: {},
    content: {
      reviews: [{ author: "Pat Lee", rating: 4, text: "Great", date: null }],
      googleRating: 4.8,
      googleReviewCount: 37,
    },
  } as unknown as SectionConfig;
  const fields = buildEditableFields({ sections: [stored], brandConfig: {} });
  const val = (suffix: string) =>
    fields.find((f) => f.path.endsWith(suffix))?.value;
  assert.equal(val("reviews[0].author"), "Pat Lee");
  assert.equal(val("reviews[0].rating"), "4");
  assert.equal(val("reviews[0].date"), "");
  assert.equal(val("googleRating"), "4.8");
  assert.equal(val("googleReviewCount"), "37");

  const off = { ...stored, enabled: false } as SectionConfig;
  const none = buildEditableFields({ sections: [off], brandConfig: {} });
  assert.ok(!none.some((f) => f.path.includes("reviews[")));
});
