import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PlaceResult } from "../serper";
import {
  analyzeGbp,
  buildGbpFindings,
  compareNap,
  computeCompleteness,
  computeReviewGap,
  gbpComponentScore,
  matchTargetPlace,
} from "./gbp-analysis";
import type { SiteNap } from "./site-nap";

const site = (over: Partial<SiteNap> = {}): SiteNap => ({
  name: "Acme Plumbing",
  phone: "(512) 555-0142",
  address: "12 Main St, Austin, TX",
  source: "json-ld",
  ...over,
});

const place = (over: Partial<PlaceResult> = {}): PlaceResult => ({
  position: 2,
  title: "Acme Plumbing LLC",
  address: "12 Main Street, Austin, TX 78701",
  phone: "+1 512-555-0142",
  category: "Plumber",
  website: "https://www.acmeplumbing.com/",
  rating: 4.6,
  ratingCount: 18,
  ...over,
});

describe("matchTargetPlace", () => {
  it("matches by website domain first", () => {
    const { place: found, confidence } = matchTargetPlace(
      [place({ title: "Other", website: "https://rival.com" }), place()],
      "https://acmeplumbing.com",
      null,
    );
    assert.equal(found?.title, "Acme Plumbing LLC");
    assert.equal(confidence, "domain");
  });

  it("falls back to the phone number the site publishes", () => {
    const { confidence, place: found } = matchTargetPlace(
      [place({ website: undefined })],
      "https://acme-pro.net",
      site(),
    );
    assert.equal(confidence, "phone");
    assert.ok(found);
  });

  it("falls back to a close name match", () => {
    const { confidence } = matchTargetPlace(
      [place({ website: undefined, phone: undefined })],
      "https://acme-plumbing-austin.com",
      site({ phone: null }),
    );
    assert.equal(confidence, "name");
  });

  it("does not match on a single shared word", () => {
    const { place: found, confidence } = matchTargetPlace(
      [place({ website: undefined, phone: undefined, title: "Austin Plumbing Supply Depot" })],
      "https://zeta-plumbing.com",
      site({ name: "Zeta Plumbing", phone: null }),
    );
    assert.equal(found, null);
    assert.equal(confidence, "none");
  });
});

describe("compareNap", () => {
  it("is a match when name, phone and address agree after normalising", () => {
    const nap = compareNap(site(), place());
    assert.equal(nap.phone, "match");
    assert.equal(nap.address, "match");
    assert.equal(nap.name, "match");
    assert.equal(nap.status, "match");
  });

  it("flags a different phone number as a mismatch", () => {
    const nap = compareNap(site({ phone: "(512) 555-9999" }), place());
    assert.equal(nap.phone, "mismatch");
    assert.equal(nap.status, "mismatch");
  });

  it("flags a different street number", () => {
    const nap = compareNap(site({ address: "99 Main St, Austin, TX" }), place());
    assert.equal(nap.address, "mismatch");
  });

  it("is partial when only some fields can be compared", () => {
    const nap = compareNap(site({ address: null, name: null }), place());
    assert.equal(nap.status, "partial");
  });

  it("is unknown when the site publishes nothing to compare", () => {
    const nap = compareNap(
      { name: null, phone: null, address: null, source: null },
      place(),
    );
    assert.equal(nap.status, "unknown");
  });
});

describe("computeReviewGap", () => {
  it("compares with the competitors found in the same results", () => {
    const target = place();
    const gap = computeReviewGap(
      target,
      [
        target,
        place({ position: 1, website: "https://a.com", ratingCount: 100, rating: 4.9 }),
        place({ position: 3, website: "https://b.com", ratingCount: 60, rating: 4.7 }),
        place({ position: 4, website: "https://not-a-competitor.com", ratingCount: 999 }),
      ],
      ["https://a.com", "https://b.com"],
    );
    assert.equal(gap?.competitors_compared, 2);
    assert.equal(gap?.competitor_median_count, 80);
    assert.equal(gap?.competitor_max_count, 100);
    assert.equal(gap?.rating_delta, -0.2);
  });

  it("returns null with no comparable competitors", () => {
    assert.equal(computeReviewGap(place(), [place()], ["https://a.com"]), null);
  });
});

describe("computeCompleteness", () => {
  it("does not count fields the data source never returned", () => {
    const result = computeCompleteness(place(), [place()]);
    // hours and photo are not returned for any place, so they are not penalised
    assert.deepEqual(result.not_provided.sort(), ["Opening hours", "Photo"]);
    assert.ok(result.missing.includes("25+ reviews"));
    assert.ok(result.score !== null && result.score > 60 && result.score < 100);
  });

  it("is null when nothing was provided", () => {
    const bare: PlaceResult = { position: 1, title: "X" };
    assert.equal(computeCompleteness(bare, [bare]).score, null);
  });

  it("counts a missing field as missing when other places have it", () => {
    const target = place({ phone: undefined });
    const result = computeCompleteness(target, [target, place()]);
    assert.ok(result.missing.includes("Phone number"));
  });
});

describe("gbpComponentScore", () => {
  const comp = { score: 80, present: [], missing: [], not_provided: [] };
  it("blends completeness and NAP 70/30", () => {
    const nap = compareNap(site(), place());
    assert.equal(gbpComponentScore(comp, nap), Math.round(80 * 0.7 + 100 * 0.3));
  });
  it("uses completeness alone when NAP is unknown", () => {
    assert.equal(gbpComponentScore(comp, null), 80);
  });
  it("is null when nothing can be judged", () => {
    assert.equal(gbpComponentScore(null, null), null);
  });
});

describe("analyzeGbp", () => {
  const base = {
    targetUrl: "https://acmeplumbing.com",
    siteNap: site(),
    competitorUrls: [] as string[],
    keyword: "plumber austin",
    location: "Austin, TX",
  };

  it("returns null when there are no places (not measured)", () => {
    assert.equal(analyzeGbp({ ...base, places: [] }), null);
  });

  it("reports not found without claiming there is no profile", () => {
    const analysis = analyzeGbp({
      ...base,
      places: [place({ website: "https://rival.com", title: "Rival Co", phone: "+1 737-555-0000" })],
    });
    assert.equal(analysis?.found, false);
    assert.equal(analysis?.score, null);
    const [finding] = buildGbpFindings(analysis);
    assert.equal(finding.id, "gbp_not_found");
    assert.match(finding.fix, /does not mean you have no profile/i);
  });

  it("scores a found, consistent profile", () => {
    const analysis = analyzeGbp({ ...base, places: [place()] });
    assert.equal(analysis?.found, true);
    assert.equal(analysis?.match_confidence, "domain");
    assert.equal(analysis?.nap?.status, "match");
    assert.ok((analysis?.score ?? 0) > 60);
  });
});

describe("buildGbpFindings", () => {
  it("reports nothing for no analysis", () => {
    assert.deepEqual(buildGbpFindings(null), []);
  });

  it("raises NAP mismatch as high impact when the phone differs", () => {
    const analysis = analyzeGbp({
      places: [place()],
      targetUrl: "https://acmeplumbing.com",
      siteNap: site({ phone: "(512) 555-9999" }),
      competitorUrls: [],
      keyword: "k",
      location: "Austin, TX",
    });
    const finding = buildGbpFindings(analysis).find((f) => f.id === "nap_mismatch");
    assert.equal(finding?.impact, "high");
  });

  it("raises a review gap only when the client is behind", () => {
    const target = place({ ratingCount: 10 });
    const behind = analyzeGbp({
      places: [target, place({ position: 1, website: "https://a.com", ratingCount: 80 })],
      targetUrl: "https://acmeplumbing.com",
      siteNap: null,
      competitorUrls: ["https://a.com"],
      keyword: "k",
      location: "Austin, TX",
    });
    assert.equal(buildGbpFindings(behind).find((f) => f.id === "review_gap")?.impact, "high");

    const ahead = analyzeGbp({
      places: [place({ ratingCount: 200 }), place({ position: 1, website: "https://a.com", ratingCount: 80 })],
      targetUrl: "https://acmeplumbing.com",
      siteNap: null,
      competitorUrls: ["https://a.com"],
      keyword: "k",
      location: "Austin, TX",
    });
    assert.equal(buildGbpFindings(ahead).find((f) => f.id === "review_gap"), undefined);
  });

  it("flags an incomplete profile and names what is missing", () => {
    const target = place({ phone: undefined, category: undefined, ratingCount: 2, rating: 3.1 });
    const analysis = analyzeGbp({
      places: [target, place({ position: 1, website: "https://a.com" })],
      targetUrl: "https://acmeplumbing.com",
      siteNap: null,
      competitorUrls: [],
      keyword: "k",
      location: "Austin, TX",
    });
    const finding = buildGbpFindings(analysis).find((f) => f.id === "gbp_incomplete");
    assert.ok(finding);
    assert.match(finding.fix, /Phone number/);
  });
});
