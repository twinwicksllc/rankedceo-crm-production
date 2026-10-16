import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewNFCSection } from "@/components/waas/sections/ReviewNFCSection";
import type { ResolvedTenant } from "@/lib/waas/templates/types";

function tenant(google?: string): ResolvedTenant {
  return { brand_config: { social: { google } } } as unknown as ResolvedTenant;
}

function render(
  content: Record<string, unknown> | undefined,
  google?: string,
  config: Record<string, unknown> = {},
): string {
  return renderToStaticMarkup(
    ReviewNFCSection({ tenant: tenant(google), config, content }) as never,
  );
}

// tsx compiles JSX with the classic runtime (tsconfig has jsx: "preserve" for
// Next), so the component under test needs React in scope.
(globalThis as unknown as { React: typeof React }).React = React;

const FAKE = ["Michael T.", "Sarah K.", "James R.", "100+", "g.page", "NFC"];

test("renders nothing when there is no real proof and no Google URL", () => {
  assert.equal(render({ headline: "What Our Customers Say" }), "");
  assert.equal(render(undefined), "");
});

test("never renders the old fabricated reviews, badge or NFC link", () => {
  for (const html of [
    render({ headline: "x" }, "https://reviews.example.com/acme"),
    render({ headline: "x" }),
  ]) {
    for (const needle of FAKE) {
      assert.ok(!html.includes(needle), `found "${needle}"`);
    }
  }
});

test("renders owner-entered reviews and the owner-entered badge", () => {
  const html = render({
    reviews: [{ author: "Pat Lee", rating: 4, text: "Fixed our leak fast." }],
    googleRating: 4.8,
    googleReviewCount: 37,
  });
  assert.ok(html.includes('id="reviews"'));
  assert.ok(html.includes("Pat Lee"));
  assert.ok(html.includes("Fixed our leak fast."));
  assert.ok(html.includes("4.8"));
  assert.ok(html.includes("37 Google reviews"));
});

test("no badge without both rating and count; escapes review text", () => {
  const html = render({
    reviews: [{ author: "A", rating: 5, text: "<script>x</script>" }],
    googleRating: 5,
  });
  assert.ok(!html.includes("Google review"));
  assert.ok(!html.includes("<script>"));
});

test("Google link renders only for http(s) URLs", () => {
  const bad = render({ headline: "x" }, "javascript:alert(1)");
  assert.equal(bad, "");
  const ok = render({ headline: "x" }, "https://g.page/r/abc");
  assert.ok(ok.includes('href="https://g.page/r/abc"'));
  assert.ok(ok.includes("Write a Google Review"));
  assert.equal(
    render({ headline: "x" }, "https://g.page/r/abc", { showNFC: false }),
    "",
  );
});
