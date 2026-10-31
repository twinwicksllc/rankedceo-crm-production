import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hostOf,
  isBlockedDirectory,
  registrableDomain,
} from "./directory-blocklist";

describe("registrableDomain", () => {
  it("strips www and subdomains", () => {
    assert.equal(registrableDomain("https://www.acme.com/path?x=1"), "acme.com");
    assert.equal(registrableDomain("m.yelp.com"), "yelp.com");
    assert.equal(registrableDomain("https://book.acme.com"), "acme.com");
  });
  it("keeps three labels for two-label suffixes", () => {
    assert.equal(registrableDomain("https://www.acme.co.uk"), "acme.co.uk");
    assert.equal(registrableDomain("shop.acme.com.au"), "acme.com.au");
  });
  it("returns null for junk", () => {
    assert.equal(registrableDomain(""), null);
    assert.equal(registrableDomain("not a url"), null);
    assert.equal(hostOf("localhost"), null);
  });
});

describe("isBlockedDirectory", () => {
  it("blocks directories, social and lead-gen domains on any subdomain", () => {
    for (const url of [
      "https://www.yelp.com/biz/acme",
      "https://m.facebook.com/acme",
      "https://www.angi.com/companylist/us/tx/austin/acme.htm",
      "https://www.homeadvisor.com/rated.AcmePlumbing.123.html",
      "https://www.thumbtack.com/tx/austin/plumbers",
      "https://maps.google.com/?cid=1",
      "https://www.bbb.org/us/tx/austin/profile/acme",
      "https://linktr.ee/acme",
    ]) {
      assert.equal(isBlockedDirectory(url), true, url);
    }
  });
  it("does not block real business sites or look-alike names", () => {
    for (const url of [
      "https://acmeplumbing.com",
      "https://www.yelpers-plumbing.com",
      "https://notfacebook.com",
      "https://googleplumbing.net",
    ]) {
      assert.equal(isBlockedDirectory(url), false, url);
    }
  });
});
