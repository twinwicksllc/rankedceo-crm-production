import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ITEMS_BY_TRADE,
  getBentoDefaultsForTrade,
} from "./bento-trade-defaults";

// The full set of trades offered by the onboarding picker
// (app/get-started/steps/step-business-identity.tsx), excluding "Other"
// which has no fixed trade-specific framing.
const ONBOARDING_TRADES = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Roofing",
  "Landscaping",
  "Pest Control",
  "Cleaning Services",
  "Painting",
  "Flooring",
  "General Contractor",
  "Concrete & Masonry",
  "Tree Service",
  "Garage Door",
  "Locksmith",
  "Pool & Spa",
];

test("DEFAULT_ITEMS_BY_TRADE has a curated entry for every onboarding trade (audit 2.4)", () => {
  for (const trade of ONBOARDING_TRADES) {
    assert.ok(
      DEFAULT_ITEMS_BY_TRADE[trade],
      `expected curated defaults for trade "${trade}"`,
    );
    assert.ok(
      DEFAULT_ITEMS_BY_TRADE[trade].length >= 4,
      `expected at least 4 cards for trade "${trade}"`,
    );
  }
});

test("DEFAULT_ITEMS_BY_TRADE has a generic default entry", () => {
  assert.ok(DEFAULT_ITEMS_BY_TRADE.default);
  assert.ok(DEFAULT_ITEMS_BY_TRADE.default.length >= 4);
});

test("every curated card has non-empty icon/title/description", () => {
  for (const [trade, items] of Object.entries(DEFAULT_ITEMS_BY_TRADE)) {
    for (const item of items) {
      assert.ok(item.icon.trim().length > 0, `${trade}: icon is empty`);
      assert.ok(item.title.trim().length > 0, `${trade}: title is empty`);
      assert.ok(
        item.description.trim().length > 0,
        `${trade}: description is empty`,
      );
    }
  }
});

test("getBentoDefaultsForTrade returns the curated set for a known trade", () => {
  const result = getBentoDefaultsForTrade("Roofing");
  assert.deepEqual(result, DEFAULT_ITEMS_BY_TRADE.Roofing);
});

test("getBentoDefaultsForTrade falls back to default for unknown trade", () => {
  const result = getBentoDefaultsForTrade("Some Unlisted Trade");
  assert.deepEqual(result, DEFAULT_ITEMS_BY_TRADE.default);
});

test("getBentoDefaultsForTrade falls back to default for null/undefined/empty", () => {
  assert.deepEqual(getBentoDefaultsForTrade(null), DEFAULT_ITEMS_BY_TRADE.default);
  assert.deepEqual(
    getBentoDefaultsForTrade(undefined),
    DEFAULT_ITEMS_BY_TRADE.default,
  );
  assert.deepEqual(getBentoDefaultsForTrade(""), DEFAULT_ITEMS_BY_TRADE.default);
});

test("getBentoDefaultsForTrade handles trades with special characters (e.g. ampersand)", () => {
  assert.deepEqual(
    getBentoDefaultsForTrade("Concrete & Masonry"),
    DEFAULT_ITEMS_BY_TRADE["Concrete & Masonry"],
  );
  assert.deepEqual(
    getBentoDefaultsForTrade("Pool & Spa"),
    DEFAULT_ITEMS_BY_TRADE["Pool & Spa"],
  );
});
