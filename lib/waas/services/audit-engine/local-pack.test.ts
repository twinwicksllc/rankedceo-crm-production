import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalPackReport,
  type PlaceResult,
} from "../serper";
import { serperPlacesSearch } from "../serper/search-client";
import { createPlacesFetcher, isPlacesAvailable } from "./local-pack";

const place = (position: number, website: string, title = website): PlaceResult => ({
  position,
  title,
  website,
  address: "Austin, TX",
  rating: 4.5,
  ratingCount: 40,
});

describe("isPlacesAvailable", () => {
  it("is always available in mock mode", () => {
    assert.equal(isPlacesAvailable("mock", false), true);
  });
  it("needs the flag for live providers", () => {
    assert.equal(isPlacesAvailable("serper", false), false);
    assert.equal(isPlacesAvailable("serper", true), true);
  });
});

describe("createPlacesFetcher", () => {
  it("does not call the search when disabled", async () => {
    let calls = 0;
    const fetchPlaces = createPlacesFetcher(
      "serper",
      "https://client.com",
      [],
      "plumber austin",
      "Austin, TX",
      {
        enabled: false,
        search: async () => {
          calls += 1;
          return [];
        },
      },
    );
    const result = await fetchPlaces();
    assert.equal(result.status, "disabled");
    assert.deepEqual(result.places, []);
    assert.equal(calls, 0);
  });

  it("is memoised: repeated calls make one search", async () => {
    let calls = 0;
    const fetchPlaces = createPlacesFetcher(
      "serper",
      "https://client.com",
      [],
      "plumber austin",
      "Austin, TX",
      {
        enabled: true,
        search: async () => {
          calls += 1;
          return [place(1, "https://a.com")];
        },
      },
    );
    const [a, b] = await Promise.all([fetchPlaces(), fetchPlaces()]);
    const c = await fetchPlaces();
    assert.equal(calls, 1);
    assert.equal(a.status, "ok");
    assert.equal(a, b);
    assert.equal(b, c);
  });

  it("reports error when the search returns null or throws, never throws itself", async () => {
    const nullSearch = createPlacesFetcher("serper", "https://client.com", [], "k", "Austin, TX", {
      enabled: true,
      search: async () => null,
    });
    assert.equal((await nullSearch()).status, "error");

    const throwing = createPlacesFetcher("serper", "https://client.com", [], "k", "Austin, TX", {
      enabled: true,
      search: async () => {
        throw new Error("boom");
      },
    });
    assert.equal((await throwing()).status, "error");
  });

  it("reports empty when the search returns no places", async () => {
    const fetchPlaces = createPlacesFetcher("serper", "https://client.com", [], "k", "Austin, TX", {
      enabled: true,
      search: async () => [],
    });
    assert.equal((await fetchPlaces()).status, "empty");
  });

  it("has no keyword means nothing to look up", async () => {
    const fetchPlaces = createPlacesFetcher("serper", "https://client.com", [], undefined, "Austin, TX", {
      enabled: true,
      search: async () => {
        throw new Error("should not be called");
      },
    });
    assert.equal((await fetchPlaces()).status, "disabled");
  });

  it("mock mode returns the target, typed competitors and padding with no network", async () => {
    const fetchPlaces = createPlacesFetcher(
      "mock",
      "https://client.com",
      ["https://rival.com"],
      "plumber austin",
      "Austin, TX",
    );
    const { places, status } = await fetchPlaces();
    assert.equal(status, "ok");
    const others = places.filter((p) => p.website !== "https://client.com");
    assert.ok(others.length >= 3, "at least three non-target places");
    assert.ok(places.every((p) => typeof p.website === "string"));
  });
});

describe("buildLocalPackReport", () => {
  it("returns null for no places", () => {
    assert.equal(
      buildLocalPackReport([], "https://client.com", [], "k", "Austin, TX"),
      null,
    );
  });

  it("finds the target and typed competitors by website domain", () => {
    const report = buildLocalPackReport(
      [place(1, "https://rival.com"), place(2, "https://www.client.com/")],
      "https://client.com",
      ["https://rival.com", "https://missing.com"],
      "plumber austin",
      "Austin, TX",
    );
    assert.ok(report);
    assert.equal(report.target.position, 2);
    assert.equal(report.competitorResults[0].position, 1);
    assert.equal(report.competitorResults[1].position, null);
    assert.equal(report.places.length, 2);
  });

  it("keeps at most ten places", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      place(i + 1, `https://site${i}.com`),
    );
    const report = buildLocalPackReport(many, "https://client.com", [], "k", "Austin, TX");
    assert.equal(report?.places.length, 10);
  });
});

describe("serperPlacesSearch timeout", () => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.SERPER_API_KEY;
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = realKey;
  });

  it("passes an abort signal to fetch", async () => {
    process.env.SERPER_API_KEY = "test-key";
    let signal: AbortSignal | null | undefined;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(JSON.stringify({ places: [] }), { status: 200 });
    }) as typeof fetch;
    const result = await serperPlacesSearch("plumber austin", "Austin, TX");
    assert.deepEqual(result, []);
    assert.ok(signal instanceof AbortSignal, "fetch received an AbortSignal");
  });

  it("resolves null (not throws) when the request times out", async () => {
    process.env.SERPER_API_KEY = "test-key";
    globalThis.fetch = (async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as typeof fetch;
    const result = await serperPlacesSearch("plumber austin", "Austin, TX");
    assert.equal(result, null);
  });
});
