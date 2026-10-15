import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyPageType,
  computeOnPageScore,
  countWords,
  crawlOnPage,
  extractCanonical,
  extractH1s,
  extractHtmlLang,
  extractMetaContent,
  extractSchemaTypes,
  extractTitle,
  type OnPagePageResult,
} from "./on-page-crawl";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

function buildPage(
  opts: {
    title?: string | null;
    description?: string | null;
    h1?: string | null;
    wordCount?: number;
    schema?: Array<Record<string, unknown>>;
    links?: string[];
    canonical?: string | null;
    lang?: string | null;
    viewport?: string | null;
    robots?: string | null;
  } = {},
): string {
  const {
    title = "Nashville Drain Cleaning | Acme Plumbing",
    description = "Acme Plumbing offers fast, affordable drain cleaning in Nashville, TN. Call today for same-day service and upfront pricing.",
    h1 = "Nashville Drain Cleaning",
    wordCount = 320,
    schema = [
      { "@context": "https://schema.org", "@type": "LocalBusiness", name: "Acme" },
      { "@context": "https://schema.org", "@type": "Service", name: "Drain Cleaning" },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [] },
    ],
    links = [],
    canonical = "https://example.com/",
    lang = "en",
    viewport = "width=device-width, initial-scale=1",
    robots = null,
  } = opts;

  const head: string[] = [];
  if (title !== null) head.push(`<title>${title}</title>`);
  if (description !== null)
    head.push(`<meta name="description" content="${description}">`);
  if (viewport !== null)
    head.push(`<meta name="viewport" content="${viewport}">`);
  if (robots !== null) head.push(`<meta name="robots" content="${robots}">`);
  if (canonical !== null)
    head.push(`<link rel="canonical" href="${canonical}">`);
  for (const s of schema)
    head.push(
      `<script type="application/ld+json">${JSON.stringify(s)}</script>`,
    );

  const body: string[] = [];
  if (h1 !== null) body.push(`<h1>${h1}</h1>`);
  body.push(`<p>${words(wordCount)}</p>`);
  for (const l of links) body.push(`<a href="${l}">link</a>`);

  const htmlOpen = lang === null ? "<html>" : `<html lang="${lang}">`;
  return `<!DOCTYPE html>${htmlOpen}<head>${head.join("")}</head><body>${body.join("")}</body></html>`;
}

const HEALTHY_LINKS = [
  "/services/drain-cleaning",
  "/services/repair",
  "/areas/nashville",
  "/about",
  "/contact",
  "/gallery",
];

function healthySite(): Record<string, string> {
  return {
    "https://example.com/": buildPage({ links: HEALTHY_LINKS }),
    "https://example.com/services/drain-cleaning": buildPage({
      title: "Drain Cleaning in Nashville | Acme Plumbing",
      h1: "Drain Cleaning",
      canonical: "https://example.com/services/drain-cleaning",
    }),
    "https://example.com/services/repair": buildPage({
      title: "Plumbing Repair in Nashville | Acme Plumbing",
      h1: "Plumbing Repair",
      canonical: "https://example.com/services/repair",
    }),
    "https://example.com/areas/nashville": buildPage({
      title: "Plumber in Nashville, TN | Acme Plumbing",
      h1: "Plumber in Nashville",
      canonical: "https://example.com/areas/nashville",
    }),
    "https://example.com/about": buildPage({
      title: "About Acme Plumbing",
      h1: "About Us",
      canonical: "https://example.com/about",
    }),
    "https://example.com/contact": buildPage({
      title: "Contact Acme Plumbing",
      h1: "Contact Us",
      canonical: "https://example.com/contact",
    }),
    "https://example.com/gallery": buildPage({
      title: "Our Work | Acme Plumbing",
      h1: "Our Work",
      canonical: "https://example.com/gallery",
    }),
  };
}

const goodSitemap =
  "<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/about</loc></url></urlset>";
const goodRobots = "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml";

function healthyFetchText(): (url: string) => Promise<string | null> {
  return async (url: string) => {
    if (url.endsWith("/sitemap.xml")) return goodSitemap;
    if (url.endsWith("/robots.txt")) return goodRobots;
    return null;
  };
}

function fetchFromMap(
  map: Record<string, string>,
): (url: string) => Promise<string | null> {
  return async (url: string) => map[url] ?? null;
}

// ---------------------------------------------------------------------------
// Pure extractors
// ---------------------------------------------------------------------------

test("extractTitle / extractH1s", () => {
  assert.equal(extractTitle("<title>Hello World</title>"), "Hello World");
  assert.equal(extractTitle("<html></html>"), null);
  assert.deepEqual(
    extractH1s("<h1>One</h1><h2>Two</h2><h1>Three</h1>"),
    ["One", "Three"],
  );
  assert.deepEqual(extractH1s("<p>no headings</p>"), []);
});

test("extractMetaContent handles reversed attribute order and missing content", () => {
  assert.equal(
    extractMetaContent('<meta name="description" content="abc">', "description"),
    "abc",
  );
  assert.equal(
    extractMetaContent('<meta content="xyz" name="description">', "description"),
    "xyz",
  );
  assert.equal(
    extractMetaContent('<meta charset="utf-8">', "description"),
    null,
  );
  assert.equal(
    extractMetaContent('<meta name="robots" content="noindex">', "robots"),
    "noindex",
  );
});

test("extractCanonical / extractHtmlLang", () => {
  assert.equal(
    extractCanonical('<link rel="canonical" href="https://x.com/">'),
    "https://x.com/",
  );
  assert.equal(extractCanonical('<link rel="stylesheet" href="/a.css">'), null);
  assert.equal(extractHtmlLang('<html lang="en-US">'), "en-US");
  assert.equal(extractHtmlLang("<html>"), null);
});

test("extractSchemaTypes: @graph, arrays, invalid JSON", () => {
  const html = [
    `<script type="application/ld+json">{"@graph":[{"@type":"LocalBusiness"},{"@type":"Service"}]}</script>`,
    `<script type="application/ld+json">[{"@type":"FAQPage"}]</script>`,
    `<script type="application/ld+json">{not valid json}</script>`,
  ].join("");
  const types = extractSchemaTypes(html).sort();
  assert.deepEqual(types, ["FAQPage", "LocalBusiness", "Service"]);
  assert.deepEqual(extractSchemaTypes("<p>none</p>"), []);
});

test("countWords ignores extra whitespace", () => {
  assert.equal(countWords("  one   two \n three "), 3);
  assert.equal(countWords(""), 0);
});

test("classifyPageType detects service, location and homepage", () => {
  const home = "https://example.com/";
  assert.deepEqual(classifyPageType(home, home, "nashville"), {
    isServicePage: false,
    isLocationPage: false,
  });
  assert.deepEqual(
    classifyPageType("https://example.com/services/drain-cleaning", home, "nashville"),
    { isServicePage: true, isLocationPage: false },
  );
  assert.deepEqual(classifyPageType("https://example.com/areas/nashville", home, "nashville"), {
    isServicePage: false,
    isLocationPage: true,
  });
  // location slug match even without a keyword path
  assert.deepEqual(classifyPageType("https://example.com/nashville", home, "nashville"), {
    isServicePage: false,
    isLocationPage: true,
  });
});

// ---------------------------------------------------------------------------
// crawlOnPage
// ---------------------------------------------------------------------------

test("healthy site: no findings, full score", async () => {
  const result = await crawlOnPage("example.com", {
    locationHint: "Nashville, TN",
    fetchHtml: fetchFromMap(healthySite()),
    fetchText: healthyFetchText(),
  });

  assert.equal(result.findings.length, 0, JSON.stringify(result.findings, null, 2));
  assert.equal(result.score, 100);
  assert.equal(result.pagesCrawled, 7);
  assert.equal(result.sitemapFound, true);
  assert.equal(result.sitemapUrlCount, 2);
  assert.equal(result.robotsTxtFound, true);
  assert.equal(result.robotsDisallowAll, false);
  const homepage = result.pages[0];
  assert.equal(homepage.isServicePage, false);
  assert.ok(result.pages.some((p) => p.isServicePage));
  assert.ok(result.pages.some((p) => p.isLocationPage));
});

test("bad site: critical findings and a low score", async () => {
  const bad = buildPage({
    title: null,
    description: null,
    h1: null,
    wordCount: 20,
    schema: [],
    links: [],
    canonical: null,
    lang: null,
    viewport: null,
  });

  const result = await crawlOnPage("example.com", {
    fetchHtml: async (url) => (url === "https://example.com/" ? bad : null),
    fetchText: async () => null,
  });

  const ids = new Set(result.findings.map((f) => f.id));
  for (const expected of [
    "on_page_missing_title",
    "on_page_missing_meta_description",
    "on_page_missing_h1",
    "on_page_missing_canonical",
    "on_page_missing_viewport",
    "on_page_missing_lang",
    "on_page_missing_schema",
    "on_page_thin_content",
    "on_page_few_internal_links",
    "on_page_no_service_pages",
    "on_page_no_location_pages",
    "on_page_missing_sitemap",
    "on_page_missing_robots_txt",
  ]) {
    assert.ok(ids.has(expected), `expected finding ${expected}`);
  }
  assert.equal(result.score, 0);
  assert.ok(result.findings.some((f) => f.severity === "critical"));
});

test("noindex homepage is a critical finding", async () => {
  const result = await crawlOnPage("example.com", {
    fetchHtml: fetchFromMap({
      "https://example.com/": buildPage({ robots: "noindex,follow" }),
    }),
    fetchText: healthyFetchText(),
  });
  assert.ok(result.findings.some((f) => f.id === "on_page_noindex"));
});

test("unreachable homepage: score null, single critical finding", async () => {
  const result = await crawlOnPage("example.com", {
    fetchHtml: async () => null,
    fetchText: async () => null,
  });
  assert.equal(result.score, null);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].id, "on_page_site_unreachable");
  assert.equal(result.findings[0].severity, "critical");
  assert.equal(result.pagesCrawled, 0);
});

test("robots.txt Disallow: / is a critical finding", async () => {
  const result = await crawlOnPage("example.com", {
    fetchHtml: fetchFromMap(healthySite()),
    fetchText: async (url) =>
      url.endsWith("/robots.txt") ? "User-agent: *\nDisallow: /" : goodSitemap,
  });
  assert.ok(result.findings.some((f) => f.id === "on_page_robots_disallow_all"));
});

test("aggregated per-page findings (noindex on a subpage)", async () => {
  const map = healthySite();
  map["https://example.com/about"] = buildPage({
    title: "About",
    h1: "About",
    robots: "noindex",
    canonical: "https://example.com/about",
  });
  const result = await crawlOnPage("example.com", {
    fetchHtml: fetchFromMap(map),
    fetchText: healthyFetchText(),
  });
  assert.ok(result.findings.some((f) => f.id === "on_page_pages_noindex"));
});

// ---------------------------------------------------------------------------
// computeOnPageScore
// ---------------------------------------------------------------------------

test("computeOnPageScore: null homepage is not measured", () => {
  assert.equal(
    computeOnPageScore({
      homepage: null,
      pages: [],
      sitemap: { found: false, urlCount: null },
      robots: { found: false, disallowAll: false },
    }),
    null,
  );
});

test("computeOnPageScore: a clean homepage scores 100", () => {
  const homepage: OnPagePageResult = {
    url: "https://example.com/",
    fetched: true,
    title: "Nashville Drain Cleaning | Acme Plumbing",
    titleLength: 40,
    metaDescription: "Acme Plumbing offers fast, affordable drain cleaning in Nashville, TN. Call today for same-day service.",
    metaDescriptionLength: 100,
    h1: "Nashville Drain Cleaning",
    h1Count: 1,
    wordCount: 400,
    canonical: "https://example.com/",
    robotsMeta: null,
    noindex: false,
    viewport: "width=device-width, initial-scale=1",
    lang: "en",
    schemaTypes: ["LocalBusiness", "Service", "FAQPage"],
    internalLinkCount: 8,
    isServicePage: false,
    isLocationPage: false,
  };
  const score = computeOnPageScore({
    homepage,
    pages: [
      homepage,
      { ...homepage, url: "https://example.com/services/x", isServicePage: true },
      { ...homepage, url: "https://example.com/areas/y", isLocationPage: true },
    ],
    sitemap: { found: true, urlCount: 3 },
    robots: { found: true, disallowAll: false },
  });
  assert.equal(score, 100);
});
