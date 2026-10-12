import test from "node:test";
import assert from "node:assert/strict";

import { LocationUnresolvedError, resolveAuditLocation } from "./location";

test("returns null when nothing is known (no default city)", () => {
  const result = resolveAuditLocation({
    explicit: null,
    detectedLocation: null,
    detectedAddress: null,
  });
  assert.equal(result, null);
});

test("treats blank strings as missing", () => {
  const result = resolveAuditLocation({
    explicit: "   ",
    detectedLocation: "",
    detectedAddress: "  ",
  });
  assert.equal(result, null);
});

test("never returns Chicago unless the input says Chicago", () => {
  const result = resolveAuditLocation({
    explicit: "Nashville, TN",
    detectedLocation: null,
    detectedAddress: null,
  });
  assert.ok(result);
  assert.doesNotMatch(result.detectedLocation, /chicago/i);
  assert.doesNotMatch(result.searchLocation, /chicago/i);
});

test("intake location wins for the label", () => {
  const result = resolveAuditLocation({
    explicit: "Nashville, TN",
    detectedLocation: "Austin, TX",
    detectedAddress: null,
  });
  assert.ok(result);
  assert.equal(result.detectedLocation, "Nashville, TN");
  assert.equal(result.searchLocation, "Nashville, TN");
  assert.equal(result.source, "intake");
});

test("uses site/AI detected location when there is no intake value", () => {
  const result = resolveAuditLocation({
    explicit: null,
    detectedLocation: "Austin, TX",
    detectedAddress: null,
  });
  assert.ok(result);
  assert.equal(result.detectedLocation, "Austin, TX");
  assert.equal(result.source, "site_or_ai");
});

test("falls back to the city parsed from the site address", () => {
  const result = resolveAuditLocation({
    explicit: null,
    detectedLocation: null,
    detectedAddress: "123 Main St, Franklin, TN 37064",
  });
  assert.ok(result);
  assert.equal(result.detectedLocation, "Franklin, TN");
  assert.equal(result.searchLocation, "Franklin, TN");
  assert.equal(result.source, "site_address");
});

test("search location prefers the site address city", () => {
  const result = resolveAuditLocation({
    explicit: null,
    detectedLocation: "Nashville",
    detectedAddress: "123 Main St, Franklin, TN 37064",
  });
  assert.ok(result);
  assert.equal(result.detectedLocation, "Nashville");
  assert.equal(result.searchLocation, "Franklin, TN");
});

test("LocationUnresolvedError has a client-actionable message", () => {
  const err = new LocationUnresolvedError();
  assert.equal(err.name, "LocationUnresolvedError");
  assert.match(err.message, /city and state/i);
});
