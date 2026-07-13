import test from "node:test";
import assert from "node:assert/strict";

import {
  validateEditPath,
  validateConfigValue,
} from "./content-paths";

// ---------------------------------------------------------------------------
// validateEditPath — sections[N].config.<key> support (Phase 8.6, audit 2.1)
// ---------------------------------------------------------------------------

test("validateEditPath accepts allow-listed bento-emergency config keys", () => {
  assert.equal(
    validateEditPath("sections[0].config.responseMinutes").valid,
    true,
  );
  assert.equal(validateEditPath("sections[1].config.dispatchFee").valid, true);
  assert.equal(
    validateEditPath("sections[2].config.visualDirection").valid,
    true,
  );
  assert.equal(
    validateEditPath("sections[3].config.emergencyLabel").valid,
    true,
  );
  assert.equal(validateEditPath("sections[4].config.standardLabel").valid, true);
  assert.equal(validateEditPath("sections[5].config.operatingHours").valid, true);
  assert.equal(validateEditPath("sections[6].config.serviceArea").valid, true);
  assert.equal(validateEditPath("sections[7].config.brands").valid, true);
});

test("validateEditPath accepts allow-listed answer-first-aeo config keys", () => {
  assert.equal(validateEditPath("sections[0].config.maxItems").valid, true);
  assert.equal(
    validateEditPath("sections[1].config.maxAnswerWords").valid,
    true,
  );
  assert.equal(
    validateEditPath("sections[2].config.includeJsonLd").valid,
    true,
  );
});

test("validateEditPath rejects config keys not on the allow-list", () => {
  const result = validateEditPath("sections[0].config.arbitraryInjectedKey");
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.reason, /not editable by clients/);
  }
});

test("validateEditPath still rejects unrelated/malformed config-like paths", () => {
  assert.equal(validateEditPath("sections[0].config").valid, false);
  assert.equal(validateEditPath("sections[abc].config.maxItems").valid, false);
  assert.equal(validateEditPath("config.maxItems").valid, false);
  assert.equal(
    validateEditPath("sections[0].config.maxItems.nested").valid,
    false,
  );
});

test("validateEditPath still validates content and enabled paths unaffected", () => {
  assert.equal(validateEditPath("sections[0].content.headline").valid, true);
  assert.equal(validateEditPath("sections[0].enabled").valid, true);
  assert.equal(validateEditPath("brand_config.business_name").valid, true);
});

// ---------------------------------------------------------------------------
// validateConfigValue — server-side value validation (defense-in-depth)
// ---------------------------------------------------------------------------

test("validateConfigValue: responseMinutes/dispatchFee accept in-range numbers", () => {
  assert.equal(validateConfigValue("responseMinutes", 45).valid, true);
  assert.equal(validateConfigValue("responseMinutes", "45").valid, true);
  assert.equal(validateConfigValue("dispatchFee", 0).valid, true);
  assert.equal(validateConfigValue("dispatchFee", 9999).valid, true);
});

test("validateConfigValue: numeric fields reject NaN, out-of-range, and non-numeric strings", () => {
  assert.equal(validateConfigValue("responseMinutes", "abc").valid, false);
  assert.equal(validateConfigValue("responseMinutes", NaN).valid, false);
  assert.equal(validateConfigValue("responseMinutes", 0).valid, false); // min 1
  assert.equal(validateConfigValue("responseMinutes", 1000).valid, false); // max 999
  assert.equal(validateConfigValue("dispatchFee", -1).valid, false); // min 0
  assert.equal(validateConfigValue("dispatchFee", 10000).valid, false); // max 9999
  assert.equal(validateConfigValue("maxItems", 0).valid, false); // min 1
  assert.equal(validateConfigValue("maxItems", 21).valid, false); // max 20
  assert.equal(validateConfigValue("maxAnswerWords", 10).valid, false); // min 20
  assert.equal(validateConfigValue("maxAnswerWords", 301).valid, false); // max 300
});

test("validateConfigValue: visualDirection only accepts the 5 known presets", () => {
  for (const preset of ["signal", "calm", "warm", "premium", "showcase"]) {
    assert.equal(validateConfigValue("visualDirection", preset).valid, true);
  }
  assert.equal(validateConfigValue("visualDirection", "neon").valid, false);
  assert.equal(validateConfigValue("visualDirection", "").valid, false);
});

test("validateConfigValue: includeJsonLd accepts booleans and boolean-strings only", () => {
  assert.equal(validateConfigValue("includeJsonLd", true).valid, true);
  assert.equal(validateConfigValue("includeJsonLd", false).valid, true);
  assert.equal(validateConfigValue("includeJsonLd", "true").valid, true);
  assert.equal(validateConfigValue("includeJsonLd", "false").valid, true);
  assert.equal(validateConfigValue("includeJsonLd", "yes").valid, false);
  assert.equal(validateConfigValue("includeJsonLd", 1).valid, false);
});

test("validateConfigValue: text fields enforce max length and type", () => {
  assert.equal(validateConfigValue("emergencyLabel", "Emergency!").valid, true);
  assert.equal(validateConfigValue("emergencyLabel", "x".repeat(61)).valid, false);
  assert.equal(validateConfigValue("emergencyLabel", 123).valid, false);
});

test("validateConfigValue: brands accepts array or CSV string within limits", () => {
  assert.equal(
    validateConfigValue("brands", ["Carrier", "Trane"]).valid,
    true,
  );
  assert.equal(validateConfigValue("brands", "Carrier, Trane, Rheem").valid, true);
  assert.equal(
    validateConfigValue(
      "brands",
      Array.from({ length: 13 }, (_, i) => `Brand${i}`),
    ).valid,
    false, // exceeds max 12 items
  );
  assert.equal(
    validateConfigValue("brands", ["x".repeat(41)]).valid,
    false, // exceeds max item length 40
  );
  assert.equal(validateConfigValue("brands", 42).valid, false); // wrong type
});

test("validateConfigValue: unregistered keys pass through as valid (non-breaking default)", () => {
  assert.equal(validateConfigValue("someFutureKey", "anything").valid, true);
});
