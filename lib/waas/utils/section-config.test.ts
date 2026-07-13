import test from "node:test";
import assert from "node:assert/strict";

import {
  readConfigString,
  readConfigNumber,
  readConfigInt,
  readConfigBool,
  readConfigStringArray,
} from "./section-config";

test("readConfigString returns trimmed string when present", () => {
  const config = { name: "  Acme Plumbing  " };
  assert.equal(readConfigString(config, "name", "fallback"), "Acme Plumbing");
});

test("readConfigString returns fallback for empty/whitespace/missing", () => {
  assert.equal(readConfigString({}, "name", "fallback"), "fallback");
  assert.equal(readConfigString({ name: "   " }, "name", "fallback"), "fallback");
  assert.equal(readConfigString({ name: "" }, "name", "fallback"), "fallback");
  assert.equal(readConfigString({ name: 42 }, "name", "fallback"), "fallback");
});

test("readConfigNumber accepts real numbers and numeric strings", () => {
  assert.equal(readConfigNumber({ fee: 89 }, "fee", 50), 89);
  assert.equal(readConfigNumber({ fee: "129" }, "fee", 50), 129);
  assert.equal(readConfigNumber({ fee: "  45  " }, "fee", 50), 45);
});

test("readConfigNumber rejects NaN from non-numeric strings (audit 3.1)", () => {
  // The core fix: Number("abc") === NaN must fall back, not propagate.
  assert.equal(readConfigNumber({ fee: "abc" }, "fee", 50), 50);
  assert.equal(readConfigNumber({ fee: "not-a-number" }, "fee", 50), 50);
  assert.equal(readConfigNumber({ fee: NaN }, "fee", 50), 50);
  assert.equal(readConfigNumber({ fee: Infinity }, "fee", 50), 50);
  assert.equal(readConfigNumber({ fee: -10 }, "fee", 50), 50);
  assert.equal(readConfigNumber({ fee: 0 }, "fee", 50), 50);
});

test("readConfigNumber returns fallback for missing/non-number types", () => {
  assert.equal(readConfigNumber({}, "fee", 50), 50);
  assert.equal(readConfigNumber({ fee: true }, "fee", 50), 50);
  assert.equal(readConfigNumber({ fee: null }, "fee", 50), 50);
});

test("readConfigInt floors to whole numbers >= 1", () => {
  assert.equal(readConfigInt({ max: 6 }, "max", 4), 6);
  assert.equal(readConfigInt({ max: "5" }, "max", 4), 5);
  assert.equal(readConfigInt({ max: 5.9 }, "max", 4), 5);
  assert.equal(readConfigInt({ max: "3.7" }, "max", 4), 3);
});

test("readConfigInt falls back for NaN, zero, negative, non-numeric (audit 3.1)", () => {
  assert.equal(readConfigInt({ max: "abc" }, "max", 6), 6);
  assert.equal(readConfigInt({ max: NaN }, "max", 6), 6);
  assert.equal(readConfigInt({ max: 0 }, "max", 6), 6);
  assert.equal(readConfigInt({ max: -3 }, "max", 6), 6);
  assert.equal(readConfigInt({ max: "" }, "max", 6), 6);
  assert.equal(readConfigInt({ max: undefined }, "max", 6), 6);
  assert.equal(readConfigInt({}, "max", 6), 6);
});

test("readConfigBool handles real booleans and string true/false", () => {
  assert.equal(readConfigBool({ flag: true }, "flag", false), true);
  assert.equal(readConfigBool({ flag: false }, "flag", true), false);
  assert.equal(readConfigBool({ flag: "true" }, "flag", false), true);
  assert.equal(readConfigBool({ flag: "false" }, "flag", true), false);
  assert.equal(readConfigBool({ flag: " TRUE " }, "flag", false), true);
  assert.equal(readConfigBool({ flag: "FALSE" }, "flag", true), false);
});

test("readConfigBool returns fallback for missing/invalid", () => {
  assert.equal(readConfigBool({}, "flag", true), true);
  assert.equal(readConfigBool({ flag: "yes" }, "flag", true), true);
  assert.equal(readConfigBool({ flag: 1 }, "flag", false), false);
});

test("readConfigStringArray reads arrays and CSV strings", () => {
  assert.deepEqual(
    readConfigStringArray({ brands: [" Kohler ", "Moen"] }, "brands", ["default"]),
    ["Kohler", "Moen"],
  );
  assert.deepEqual(
    readConfigStringArray({ brands: "Kohler, Moen, Delta" }, "brands", ["default"]),
    ["Kohler", "Moen", "Delta"],
  );
});

test("readConfigStringArray falls back for empty/missing/non-string", () => {
  assert.deepEqual(readConfigStringArray({}, "brands", ["default"]), ["default"]);
  assert.deepEqual(
    readConfigStringArray({ brands: [] }, "brands", ["default"]),
    ["default"],
  );
  assert.deepEqual(
    readConfigStringArray({ brands: "  ,  " }, "brands", ["default"]),
    ["default"],
  );
  assert.deepEqual(
    readConfigStringArray({ brands: 42 }, "brands", ["default"]),
    ["default"],
  );
});
