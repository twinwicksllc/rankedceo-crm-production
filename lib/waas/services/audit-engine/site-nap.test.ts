import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractNap, normalizePhone } from "./site-nap";

describe("normalizePhone", () => {
  it("compares North-American numbers by their last ten digits", () => {
    assert.equal(normalizePhone("(512) 555-0142"), "5125550142");
    assert.equal(normalizePhone("+1 512-555-0142"), "5125550142");
    assert.equal(normalizePhone("1.512.555.0142"), "5125550142");
  });
  it("rejects values too short to compare", () => {
    assert.equal(normalizePhone("555"), null);
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone(null), null);
  });
});

describe("extractNap", () => {
  it("prefers LocalBusiness JSON-LD (name, telephone, address)", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"ignored"},
        {"@type":["Plumber","LocalBusiness"],"name":"Acme Plumbing","telephone":"+1-512-555-0142",
         "address":{"@type":"PostalAddress","streetAddress":"12 Main St","addressLocality":"Austin","addressRegion":"TX","postalCode":"78701"}}
      ]}</script></head><body><a href="tel:5125559999">call</a></body></html>`;
    const nap = extractNap(html);
    assert.equal(nap.name, "Acme Plumbing");
    assert.equal(nap.phone, "+1-512-555-0142");
    assert.equal(nap.address, "12 Main St, Austin, TX, 78701");
    assert.equal(nap.source, "json-ld");
  });

  it("falls back to a tel: link", () => {
    const nap = extractNap(`<a href="tel:+15125550142">Call</a>`);
    assert.equal(nap.phone, "+15125550142");
    assert.equal(nap.source, "tel-link");
  });

  it("skips a tel: link with a malformed percent escape instead of throwing", () => {
    const nap = extractNap(
      `<a href="tel:%E0%A4%A">bad</a><a href="tel:+15125550142">good</a>`,
    );
    assert.equal(nap.phone, "+15125550142");
    assert.equal(nap.source, "tel-link");
  });

  it("falls back to a phone number printed in the text", () => {
    const nap = extractNap(`<body><p>Call us at (512) 555-0142 today</p></body>`);
    assert.equal(nap.phone, "(512) 555-0142");
    assert.equal(nap.source, "text");
  });

  it("ignores scripts and non-phone digit runs", () => {
    const nap = extractNap(
      `<script>var id = "5125550142";</script><p>Order 20240131 shipped</p>`,
    );
    assert.equal(nap.phone, null);
  });

  it("uses og:site_name when there is no JSON-LD name", () => {
    const nap = extractNap(
      `<meta property="og:site_name" content="Acme Plumbing">`,
    );
    assert.equal(nap.name, "Acme Plumbing");
  });

  it("returns nulls for empty or invalid input", () => {
    assert.deepEqual(extractNap(null), {
      name: null,
      phone: null,
      address: null,
      source: null,
    });
    assert.equal(
      extractNap(`<script type="application/ld+json">{bad json</script>`).name,
      null,
    );
  });
});
