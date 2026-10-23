import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_SERVICE_LABEL,
  UNKNOWN_DATE,
  UNNAMED_LEAD,
  contactMethodOf,
  detailsOf,
  displayName,
  formatEstimatedValue,
  getServiceTypeLabel,
  problemDescriptionOf,
  symptomsOf,
  timeAgo,
} from "./lead-display";

const NOW = new Date("2026-10-23T12:00:00.000Z");
test("detailsOf returns {} for null, undefined, strings and arrays", () => {
  assert.deepEqual(detailsOf(undefined), {});
  assert.deepEqual(detailsOf(null), {});
  assert.deepEqual(detailsOf("ac_repair"), {});
  assert.deepEqual(detailsOf(["a"]), {});
  assert.deepEqual(detailsOf({ a: 1 }), { a: 1 });
});

test("timeAgo covers the relative ranges", () => {
  assert.equal(timeAgo("2026-10-23T11:59:30.000Z", NOW), "Just now");
  assert.equal(timeAgo("2026-10-23T11:55:00.000Z", NOW), "5m ago");
  assert.equal(timeAgo("2026-10-23T09:00:00.000Z", NOW), "3h ago");
  assert.equal(timeAgo("2026-10-21T12:00:00.000Z", NOW), "2d ago");
  const old = "2026-09-01T12:00:00.000Z";
  assert.equal(timeAgo(old, NOW), new Date(old).toLocaleDateString());
});

test("timeAgo gives a fallback for an invalid, empty or missing date", () => {
  assert.equal(timeAgo("not a date", NOW), UNKNOWN_DATE);
  assert.equal(timeAgo("", NOW), UNKNOWN_DATE);
  assert.equal(timeAgo("   ", NOW), UNKNOWN_DATE);
  assert.equal(timeAgo(undefined, NOW), UNKNOWN_DATE);
  assert.equal(timeAgo(null, NOW), UNKNOWN_DATE);
  for (const bad of ["not a date", "", undefined, null]) {
    const text = timeAgo(bad, NOW);
    assert.ok(!text.includes("NaN"), text);
    assert.ok(!text.includes("Invalid"), text);
  }
});

test("getServiceTypeLabel tolerates missing details and bad service_type", () => {
  assert.equal(getServiceTypeLabel(undefined), DEFAULT_SERVICE_LABEL);
  assert.equal(getServiceTypeLabel(null), DEFAULT_SERVICE_LABEL);
  assert.equal(getServiceTypeLabel("ac_repair"), DEFAULT_SERVICE_LABEL);
  assert.equal(getServiceTypeLabel({}), DEFAULT_SERVICE_LABEL);
  assert.equal(
    getServiceTypeLabel({ service_type: 42 }),
    DEFAULT_SERVICE_LABEL,
  );
  assert.equal(
    getServiceTypeLabel({ service_type: "  " }),
    DEFAULT_SERVICE_LABEL,
  );
  assert.equal(getServiceTypeLabel({ service_type: "ac_repair" }), "Ac Repair");
});

test("displayName falls back for blank or non-string names", () => {
  assert.equal(displayName(""), UNNAMED_LEAD);
  assert.equal(displayName("   "), UNNAMED_LEAD);
  assert.equal(displayName(undefined), UNNAMED_LEAD);
  assert.equal(displayName(null), UNNAMED_LEAD);
  assert.equal(displayName(7), UNNAMED_LEAD);
  assert.equal(displayName("  Ada Lovelace "), "Ada Lovelace");
});

test("symptomsOf returns a list only when symptoms is an array", () => {
  assert.deepEqual(symptomsOf(undefined), []);
  assert.deepEqual(symptomsOf(null), []);
  assert.deepEqual(symptomsOf({}), []);
  assert.deepEqual(symptomsOf({ symptoms: "no_cooling" }), []);
  assert.deepEqual(symptomsOf({ symptoms: { 0: "x" } }), []);
  assert.deepEqual(symptomsOf({ symptoms: ["no_cooling", 3, null, ""] }), [
    "no_cooling",
  ]);
});

test("problemDescriptionOf returns only a non-empty string", () => {
  assert.equal(problemDescriptionOf(undefined), null);
  assert.equal(problemDescriptionOf({ problem_description: "" }), null);
  assert.equal(problemDescriptionOf({ problem_description: 5 }), null);
  assert.equal(
    problemDescriptionOf({ problem_description: "Unit is loud" }),
    "Unit is loud",
  );
});

test("formatEstimatedValue formats finite numbers and rejects the rest", () => {
  assert.equal(formatEstimatedValue(1250), "$1,250");
  assert.equal(formatEstimatedValue(0), "$0");
  assert.equal(formatEstimatedValue(null), null);
  assert.equal(formatEstimatedValue(undefined), null);
  assert.equal(formatEstimatedValue(Number.NaN), null);
  assert.equal(formatEstimatedValue(Infinity), null);
  assert.equal(formatEstimatedValue(-Infinity), null);
  assert.equal(formatEstimatedValue("1250"), null);
});

test("contactMethodOf falls back to phone", () => {
  assert.equal(contactMethodOf("email"), "email");
  assert.equal(contactMethodOf("text"), "text");
  assert.equal(contactMethodOf(undefined), "phone");
  assert.equal(contactMethodOf("carrier pigeon"), "phone");
});

// ---------------------------------------------------------------------------
// Source-level checks on the card (it imports React, so it is read as text)
// ---------------------------------------------------------------------------

const card = readFileSync(
  new URL("../../components/industry/lead-card.tsx", import.meta.url),
  "utf-8",
).replace(/\r\n/g, "\n");

test("lead-card never reads Object.keys on a raw service_details", () => {
  assert.ok(
    !/Object\.keys\(\s*lead\.service_details\s*\)/.test(card),
    "Object.keys(lead.service_details) throws when the field is missing",
  );
  // Any Object.keys call must be on the guarded local copy.
  for (const m of card.matchAll(/Object\.keys\(([^)]*)\)/g)) {
    assert.equal(m[1].trim(), "serviceDetails");
  }
  assert.match(
    card,
    /const serviceDetails = detailsOf\(lead\.service_details\)/,
  );
});

test("lead-card imports its formatting from lead-display", () => {
  assert.match(card, /from "@\/lib\/services\/lead-display"/);
  assert.ok(!/function timeAgo\(/.test(card), "timeAgo must not be redefined");
  assert.ok(
    !/function getServiceTypeLabel\(/.test(card),
    "getServiceTypeLabel must not be redefined",
  );
});

test("lead-card does not render raw fields that can be blank or absent", () => {
  assert.ok(!card.includes("{lead.customer_name}"));
  assert.ok(!card.includes("lead.estimated_value.toLocaleString"));
  assert.ok(!card.includes("as string[]"));
  assert.ok(!/lead\.service_details\.\w+/.test(card));
});
