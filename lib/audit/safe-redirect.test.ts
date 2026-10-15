import test from "node:test";
import assert from "node:assert/strict";

import { resolveSafeRedirect, DEFAULT_AUDIT_REDIRECT } from "./safe-redirect";

// ── Finding 8: the post-auth redirect must be a validated same-origin path ──

test("allows a same-origin relative path", () => {
  assert.equal(resolveSafeRedirect("/audit/abc-123?token=xyz"), "/audit/abc-123?token=xyz");
  assert.equal(resolveSafeRedirect("/onboarding/1"), "/onboarding/1");
});

test("trims surrounding whitespace from a valid path", () => {
  assert.equal(resolveSafeRedirect("  /audit/start  "), "/audit/start");
});

test("rejects absolute URLs", () => {
  assert.equal(resolveSafeRedirect("https://evil.example.com"), DEFAULT_AUDIT_REDIRECT);
  assert.equal(resolveSafeRedirect("http://evil.example.com/x"), DEFAULT_AUDIT_REDIRECT);
});

test("rejects protocol-relative and backslash tricks", () => {
  assert.equal(resolveSafeRedirect("//evil.example.com"), DEFAULT_AUDIT_REDIRECT);
  assert.equal(resolveSafeRedirect("/\\evil.example.com"), DEFAULT_AUDIT_REDIRECT);
  assert.equal(resolveSafeRedirect("/audit\\..\\evil"), DEFAULT_AUDIT_REDIRECT);
});

test("rejects non-absolute schemes", () => {
  assert.equal(resolveSafeRedirect("javascript:alert(1)"), DEFAULT_AUDIT_REDIRECT);
  assert.equal(resolveSafeRedirect("data:text/html,x"), DEFAULT_AUDIT_REDIRECT);
});

test("rejects values with whitespace or control characters", () => {
  assert.equal(resolveSafeRedirect("/audit/start\nSet-Cookie: x"), DEFAULT_AUDIT_REDIRECT);
  assert.equal(resolveSafeRedirect("/audit/start path"), DEFAULT_AUDIT_REDIRECT);
});

test("falls back for empty / missing values", () => {
  assert.equal(resolveSafeRedirect(null), DEFAULT_AUDIT_REDIRECT);
  assert.equal(resolveSafeRedirect(undefined), DEFAULT_AUDIT_REDIRECT);
  assert.equal(resolveSafeRedirect(""), DEFAULT_AUDIT_REDIRECT);
});

test("honors a custom fallback", () => {
  assert.equal(resolveSafeRedirect("https://evil.example.com", "/audit/start"), "/audit/start");
});
