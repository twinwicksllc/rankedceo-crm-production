import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// handleIndustrySubdomain rewrites every path that is not a shared route to
// /{industry}/..., so /thank-you on smile.rankedceo.com became /smile/thank-you
// and returned 404. The quote route redirects there on every outcome.
test("the industry-subdomain middleware passes /thank-you through", () => {
  const source = readFileSync(
    new URL("../../middleware.ts", import.meta.url),
    "utf-8",
  ).replace(/\r\n/g, "\n");
  const start = source.indexOf("const isSharedRoute = [");
  assert.ok(start > -1, "isSharedRoute list not found");
  const list = source.slice(start, source.indexOf("].some", start));
  assert.match(list, /"\/thank-you"/);
});

test("/thank-you exists as a top-level page", () => {
  const page = readFileSync(
    new URL("../../app/thank-you/page.tsx", import.meta.url),
    "utf-8",
  );
  assert.match(page, /ThankYouContent/);
});
