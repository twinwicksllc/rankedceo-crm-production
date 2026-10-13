import assert from "node:assert/strict";
import { test } from "node:test";

import { getErrorMessage, getErrorStack } from "./errors";

test("getErrorMessage reads Error instances", () => {
  assert.equal(getErrorMessage(new Error("boom")), "boom");
});

test("getErrorMessage reads plain objects with a message (Supabase-style)", () => {
  assert.equal(
    getErrorMessage({ message: "row not found", code: "PGRST116" }),
    "row not found",
  );
});

test("getErrorMessage falls back for empty, missing and non-string messages", () => {
  assert.equal(getErrorMessage({ message: "" }, "fallback"), "fallback");
  assert.equal(getErrorMessage({}, "fallback"), "fallback");
  assert.equal(getErrorMessage({ message: 42 }, "fallback"), "fallback");
});

test("getErrorMessage falls back for primitives, null and undefined", () => {
  assert.equal(getErrorMessage("just a string", "fallback"), "fallback");
  assert.equal(getErrorMessage(null, "fallback"), "fallback");
  assert.equal(getErrorMessage(undefined), "Unknown error");
});

test("getErrorStack only returns stacks from Error instances", () => {
  assert.equal(typeof getErrorStack(new Error("x")), "string");
  assert.equal(getErrorStack({ stack: "fake" }), undefined);
});
