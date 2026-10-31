import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PlaceResult } from "../serper";
import {
  discoverCompetitors,
  mergeCompetitors,
  MAX_COMPETITORS,
} from "./competitor-discovery";

const place = (position: number, website: string | undefined, title = `P${position}`): PlaceResult => ({
  position,
  title,
  website,
});

describe("discoverCompetitors", () => {
  const target = "https://client.com";

  it("returns origins in local-pack rank order, capped at three", () => {
    const found = discoverCompetitors({
      places: [
        place(4, "https://d.com"),
        place(1, "https://www.a.com/services?utm=1"),
        place(3, "https://c.com"),
        place(2, "https://b.com"),
      ],
      targetUrl: target,
      typedCompetitorUrls: [],
    });
    assert.deepEqual(
      found.map((c) => c.url),
      ["https://www.a.com", "https://b.com", "https://c.com"],
    );
    assert.equal(found.length, MAX_COMPETITORS);
    assert.equal(found[0].position, 1);
  });

  it("skips places with no website, the client's own domain, directories and duplicates", () => {
    const found = discoverCompetitors({
      places: [
        place(1, undefined),
        place(2, "https://www.client.com/contact"),
        place(3, "https://shop.client.com"),
        place(4, "https://www.yelp.com/biz/rival"),
        place(5, "https://rival.com"),
        place(6, "https://www.rival.com/about"),
        place(7, "https://other.com"),
      ],
      targetUrl: target,
      typedCompetitorUrls: [],
    });
    assert.deepEqual(
      found.map((c) => c.domain),
      ["rival.com", "other.com"],
    );
  });

  it("does not repeat competitors the visitor already typed", () => {
    const found = discoverCompetitors({
      places: [place(1, "https://typed.com"), place(2, "https://new.com")],
      targetUrl: target,
      typedCompetitorUrls: ["https://www.typed.com"],
    });
    assert.deepEqual(found.map((c) => c.domain), ["new.com"]);
  });

  it("ignores unusable website values", () => {
    const found = discoverCompetitors({
      places: [place(1, "not a url"), place(2, "   ")],
      targetUrl: target,
      typedCompetitorUrls: [],
    });
    assert.deepEqual(found, []);
  });

  it("returns nothing for an empty places list", () => {
    assert.deepEqual(
      discoverCompetitors({ places: [], targetUrl: target, typedCompetitorUrls: [] }),
      [],
    );
  });
});

describe("mergeCompetitors", () => {
  const d = (n: number) => ({ url: `https://d${n}.com`, domain: `d${n}.com`, title: `D${n}`, position: n });

  it("typed competitors win and discovered fill the remaining slots", () => {
    const merged = mergeCompetitors(["https://t1.com"], [d(1), d(2), d(3)]);
    assert.deepEqual(merged.urls, ["https://t1.com", "https://d1.com", "https://d2.com"]);
    assert.deepEqual(merged.discoveredUrls, ["https://d1.com", "https://d2.com"]);
  });

  it("uses only discovered competitors when none were typed", () => {
    const merged = mergeCompetitors([], [d(1), d(2), d(3), d(4)]);
    assert.equal(merged.urls.length, 3);
    assert.equal(merged.discoveredUrls.length, 3);
  });

  it("adds no discovered competitors when three were typed", () => {
    const typed = ["https://a.com", "https://b.com", "https://c.com"];
    const merged = mergeCompetitors(typed, [d(1)]);
    assert.deepEqual(merged.urls, typed);
    assert.deepEqual(merged.discoveredUrls, []);
  });

  it("returns an empty list when nothing typed and nothing discovered", () => {
    assert.deepEqual(mergeCompetitors([], []), { urls: [], discoveredUrls: [] });
  });
});
