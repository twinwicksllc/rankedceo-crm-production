import test from "node:test";
import assert from "node:assert/strict";
import { formatEditPath } from "./format-path";

test("content path shows 1-based section number", () => {
  assert.equal(
    formatEditPath("sections[0].content.headline"),
    "Section 1 › Headline",
  );
});

test("config path shows 1-based section number", () => {
  assert.equal(
    formatEditPath("sections[2].config.layout"),
    "Section 3 › Settings › Layout",
  );
});

test("enabled toggle shows 1-based section number", () => {
  assert.equal(formatEditPath("sections[1].enabled"), "Section 2 › Visibility");
});

test("brand config path", () => {
  assert.equal(
    formatEditPath("brand_config.primary_color"),
    "Brand › Primary Color",
  );
});
