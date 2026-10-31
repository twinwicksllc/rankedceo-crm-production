import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePlace } from "./search-client";

// Representative /places item. The field names phoneNumber and openingHours are
// the assumed Serper shape; this fixture pins what the code does with them.
const fixture = {
  position: 1,
  title: "Acme Plumbing LLC",
  address: "12 Main St, Austin, TX 78701",
  rating: 4.8,
  ratingCount: 112,
  category: "Plumber",
  cid: "123456789",
  website: "https://acmeplumbing.com/",
  phoneNumber: "(512) 555-0142",
  openingHours: "Mon-Fri 8am-6pm",
  thumbnailUrl: "https://example.com/photo.jpg",
};

describe("normalizePlace (Serper /places item)", () => {
  it("maps phoneNumber and openingHours onto phone and hours", () => {
    const place = normalizePlace(fixture as never);
    assert.equal(place.phone, "(512) 555-0142");
    assert.equal(place.hours, "Mon-Fri 8am-6pm");
    assert.equal(place.website, "https://acmeplumbing.com/");
    assert.equal(place.cid, "123456789");
  });

  it("drops the raw Serper keys so they do not leak into the report", () => {
    const place = normalizePlace(fixture as never) as unknown as Record<string, unknown>;
    assert.equal("phoneNumber" in place, false);
    assert.equal("openingHours" in place, false);
  });

  it("leaves absent optional fields absent rather than inventing values", () => {
    const place = normalizePlace({ position: 2, title: "Bare" } as never);
    assert.equal(place.phone, undefined);
    assert.equal(place.hours, undefined);
    assert.equal(place.thumbnailUrl, undefined);
  });

  it("ignores blank strings", () => {
    const place = normalizePlace({ position: 3, title: "Blank", phoneNumber: "   " } as never);
    assert.equal(place.phone, undefined);
  });
});
