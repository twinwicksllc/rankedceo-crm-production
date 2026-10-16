import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_REVIEWS,
  buildReviewSectionView,
  normalizeReviews,
  parseGoogleAggregate,
  parseReviewRating,
  safeExternalUrl,
  shouldRenderReviewSection,
  stripUnverifiedReviewData,
} from "./reviews";

const good = { author: "Pat Lee", rating: 5, text: "Fixed our leak fast." };

test("parseReviewRating accepts whole numbers 1-5 only", () => {
  assert.equal(parseReviewRating(5), 5);
  assert.equal(parseReviewRating("4"), 4);
  assert.equal(parseReviewRating(0), null);
  assert.equal(parseReviewRating(6), null);
  assert.equal(parseReviewRating(4.5), null);
  assert.equal(parseReviewRating(""), null);
  assert.equal(parseReviewRating(null), null);
  assert.equal(parseReviewRating("abc"), null);
});

test("normalizeReviews keeps only complete reviews and tolerates null holes", () => {
  const out = normalizeReviews({
    reviews: [
      null,
      good,
      { author: "No Text", rating: 5, text: "  " },
      { author: "", rating: 5, text: "x" },
      { author: "Bad Rating", rating: 9, text: "x" },
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].author, "Pat Lee");
});

test("normalizeReviews caps the list and handles missing content", () => {
  const many = Array.from({ length: 20 }, () => good);
  assert.equal(normalizeReviews({ reviews: many }).length, MAX_REVIEWS);
  assert.deepEqual(normalizeReviews(undefined), []);
  assert.deepEqual(normalizeReviews({ reviews: "nope" }), []);
});

test("parseGoogleAggregate needs BOTH a valid rating and a valid count", () => {
  assert.deepEqual(
    parseGoogleAggregate({ googleRating: "4.84", googleReviewCount: "37" }),
    { rating: 4.8, count: 37 },
  );
  assert.equal(parseGoogleAggregate({ googleRating: 4.8 }), null);
  assert.equal(parseGoogleAggregate({ googleReviewCount: 10 }), null);
  assert.equal(
    parseGoogleAggregate({ googleRating: 6, googleReviewCount: 10 }),
    null,
  );
  assert.equal(
    parseGoogleAggregate({ googleRating: 5, googleReviewCount: 0 }),
    null,
  );
  assert.equal(
    parseGoogleAggregate({ googleRating: 5, googleReviewCount: 1.5 }),
    null,
  );
  assert.equal(
    parseGoogleAggregate({ googleRating: 5, googleReviewCount: 2_000_000 }),
    null,
  );
});

test("the badge is never computed from curated reviews", () => {
  const view = buildReviewSectionView({ reviews: [good] }, null);
  assert.equal(view.aggregate, null);
  assert.equal(view.reviews.length, 1);
});

test("safeExternalUrl allows only http(s)", () => {
  assert.equal(safeExternalUrl("https://g.page/r/abc"), "https://g.page/r/abc");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("data:text/html,x"), null);
  assert.equal(safeExternalUrl("not a url"), null);
  assert.equal(safeExternalUrl(""), null);
  assert.equal(safeExternalUrl(undefined), null);
});

test("section renders nothing without real proof or a Google URL", () => {
  const empty = buildReviewSectionView({}, undefined);
  assert.equal(empty.hasProof, false);
  assert.equal(shouldRenderReviewSection(empty, true), false);

  const urlOnly = buildReviewSectionView({}, "https://g.page/r/abc");
  assert.equal(shouldRenderReviewSection(urlOnly, true), true);
  assert.equal(shouldRenderReviewSection(urlOnly, false), false);

  const proof = buildReviewSectionView({ reviews: [good] }, null);
  assert.equal(shouldRenderReviewSection(proof, false), true);
});

test("stripUnverifiedReviewData removes review data without mutating input", () => {
  const input = [
    { section: "hero", content: { headline: "H", reviews: "keep" } },
    {
      section: "reviews",
      content: {
        headline: "What Our Customers Say",
        reviews: [good],
        googleRating: 5,
        googleReviewCount: 100,
      },
    },
    { section: "reviews" },
  ];
  const out = stripUnverifiedReviewData(input);
  assert.deepEqual(out[1].content, { headline: "What Our Customers Say" });
  assert.deepEqual(out[0], input[0]);
  assert.equal(out[2], input[2]);
  assert.ok(
    "reviews" in (input[1].content as Record<string, unknown>),
    "input must not be mutated",
  );
});
