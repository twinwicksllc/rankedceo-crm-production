import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeGbp } from "./gbp-analysis";
import { gbpSummaryLines } from "./gbp-summary";

const place = {
  position: 2,
  title: "Acme Plumbing LLC",
  address: "12 Main Street, Austin, TX",
  phone: "+1 512-555-0142",
  category: "Plumber",
  website: "https://acmeplumbing.com",
  rating: 4.6,
  ratingCount: 10,
};

describe("gbpSummaryLines", () => {
  it("never says the client has no profile when it was only absent from the results", () => {
    const gbp = analyzeGbp({
      places: [{ ...place, website: "https://rival.com", title: "Rival", phone: "+1 737-555-0000" }],
      targetUrl: "https://acmeplumbing.com",
      siteNap: null,
      competitorUrls: [],
      keyword: "plumber austin",
      location: "Austin, TX",
    });
    assert.ok(gbp);
    const [line] = gbpSummaryLines(gbp);
    assert.match(line, /not in the top 1 Google Maps results/i);
    assert.match(line, /does not mean you have no Google Business Profile/i);
  });

  it("states both values when the phone differs", () => {
    const gbp = analyzeGbp({
      places: [place, { ...place, position: 1, website: "https://a.com", ratingCount: 80 }],
      targetUrl: "https://acmeplumbing.com",
      siteNap: { name: "Acme Plumbing", phone: "(512) 555-9999", address: null, source: "text" },
      competitorUrls: ["https://a.com"],
      keyword: "plumber austin",
      location: "Austin, TX",
    });
    assert.ok(gbp);
    const text = gbpSummaryLines(gbp).join("\n");
    assert.match(text, /Does not match your website/);
    assert.match(text, /Phone on your website: \(512\) 555-9999\. On Google: \+1 512-555-0142/);
    assert.match(text, /the competitor we compared has 80/);
  });
});
