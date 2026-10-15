import test from "node:test";
import assert from "node:assert/strict";

import { escapeHtml } from "./utils";

test("escapeHtml escapes the five HTML-significant characters", () => {
  assert.equal(
    escapeHtml(`<a href="x" onclick='y'>&</a>`),
    "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
  );
});

test("escapeHtml escapes ampersands first (no double-escaping)", () => {
  assert.equal(escapeHtml("a & b"), "a &amp; b");
  assert.equal(escapeHtml("&amp;"), "&amp;amp;");
});

test("escapeHtml handles null/undefined/non-strings", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(42), "42");
});

test("escapeHtml leaves plain text unchanged", () => {
  assert.equal(escapeHtml("Acme Plumbing LLC"), "Acme Plumbing LLC");
});
