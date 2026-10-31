// lib/waas/services/audit-engine/on-page-crawl.ts
//
// A5: a real on-page crawl for the audit engine.
//
// The PageSpeed "SEO" category is a Lighthouse heuristic; it is not a crawl.
// This module fetches the target site and inspects the actual markup so the
// report can say, in plain language, what is wrong on the page: missing title,
// missing meta description, no H1, no canonical, noindex, no viewport, no
// structured data, thin content, no service/location pages, no sitemap, etc.
//
// It reuses the existing regex primitives from the keyword generator
// (fetchHtml / extractInternalLinks / extractTagContent) so there is no new
// dependency and no HTML parser to install. Everything here is best-effort:
// a page that cannot be fetched is reported as such and never throws.

import { fetchHtml, extractInternalLinks } from "../keyword-generator/site-scraper";
import {
  extractTagContent,
  stripHtml,
  normalizeTargetUrl,
  cleanText,
} from "../keyword-generator/text-utils";
import { extractDomain } from "../serper";
import { extractNap, type SiteNap } from "./site-nap";

export const ON_PAGE_FETCH_TIMEOUT_MS = 12000;
export const MAX_PAGES_TO_CRAWL = 8;
export const THIN_CONTENT_MIN_WORDS = 300;
export const MIN_INTERNAL_LINKS = 5;

const USER_AGENT =
  "Mozilla/5.0 (compatible; RankedCEOAuditBot/1.0; +https://rankedceo.com)";

export type OnPageFindingSeverity = "critical" | "warning" | "info";
export type OnPageImpact = "high" | "medium" | "low";

export interface OnPageFinding {
  /** Stable machine id, e.g. "on_page_missing_title". */
  id: string;
  severity: OnPageFindingSeverity;
  title: string;
  description: string;
  url: string;
  fix: string;
  impact: OnPageImpact;
}

export interface OnPagePageResult {
  url: string;
  fetched: boolean;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  h1Count: number;
  wordCount: number;
  canonical: string | null;
  robotsMeta: string | null;
  noindex: boolean;
  viewport: string | null;
  lang: string | null;
  schemaTypes: string[];
  internalLinkCount: number;
  isServicePage: boolean;
  isLocationPage: boolean;
}

export interface OnPageCrawlResult {
  crawledAt: string;
  homepageUrl: string;
  pagesCrawled: number;
  pagesRequested: number;
  sitemapFound: boolean;
  sitemapUrlCount: number | null;
  robotsTxtFound: boolean;
  robotsDisallowAll: boolean;
  findings: OnPageFinding[];
  pages: OnPagePageResult[];
  /** 0-100 on-page score. null = homepage could not be fetched (not measured). */
  score: number | null;
  /** Name, phone and address the homepage publishes (A3). null when not fetched. */
  nap: SiteNap | null;
}

export interface OnPageCrawlOptions {
  /** City/region label used to spot location pages by slug (e.g. "Nashville"). */
  locationHint?: string | null;
  maxPages?: number;
  /** Injectable for tests. Defaults to the shared site-scraper fetchHtml. */
  fetchHtml?: (url: string) => Promise<string | null>;
  /** Injectable for tests. Fetches non-HTML text (sitemap.xml, robots.txt). */
  fetchText?: (url: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Raw text fetch (sitemap.xml / robots.txt are not text/html, so the shared
// fetchHtml returns null for them; this one does not check content-type).
// ---------------------------------------------------------------------------
export async function fetchRawText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(ON_PAGE_FETCH_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure extractors (unit-tested directly)
// ---------------------------------------------------------------------------

export function extractTitle(html: string): string | null {
  return extractTagContent(html, "title");
}

export function extractH1s(html: string): string[] {
  const out: string[] = [];
  const re = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = cleanText(stripHtml(match[1] ?? ""));
    if (text) out.push(text);
  }
  return out;
}

/** Read a `<meta name="..." content="...">` value regardless of attribute order. */
export function extractMetaContent(html: string, name: string): string | null {
  const target = name.toLowerCase();
  const re = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    if (!nameMatch || nameMatch[1].toLowerCase() !== target) continue;
    const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);
    return contentMatch ? cleanText(contentMatch[1]) : "";
  }
  return null;
}

export function extractCanonical(html: string): string | null {
  const re = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i);
    if (!rel || rel[1].toLowerCase() !== "canonical") continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i);
    return href ? cleanText(href[1]) : null;
  }
  return null;
}

export function extractHtmlLang(html: string): string | null {
  const match = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  return match?.[1] ? cleanText(match[1]) : null;
}

/** Collect every @type declared across all JSON-LD blocks (handles @graph/arrays). */
export function extractSchemaTypes(html: string): string[] {
  const types = new Set<string>();
  const re =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // invalid JSON-LD is ignored, not fatal
    }
    collectSchemaTypes(parsed, types);
  }
  return [...types];
}

function collectSchemaTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSchemaTypes(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    if (typeof type === "string") out.add(type);
    else if (Array.isArray(type)) {
      for (const t of type) if (typeof t === "string") out.add(t);
    }
    for (const key of Object.keys(record)) {
      if (key === "@type") continue;
      collectSchemaTypes(record[key], out);
    }
  }
}

export function countWords(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}

const SERVICE_PATH_RE =
  /(service|services|what-we-do|solutions|offerings|capabilities|repair|installation)/i;
const LOCATION_PATH_RE =
  /(location|locations|areas?|service-area|where-we-serve|near|city|town|county|serving)/i;
const ABOUT_CONTACT_RE = /(about|contact|team|company|reviews?|gallery|projects?)/i;
const SKIP_PATH_RE =
  /(privacy|terms|legal|cookie|login|signin|sign-in|signup|sign-up|cart|checkout|account|wp-admin|wp-login|feed|sitemap|\.(pdf|jpe?g|png|gif|svg|webp|zip|xml|css|js)$)/i;

export function classifyPageType(
  url: string,
  homepageUrl: string,
  locationSlug: string | null,
): { isServicePage: boolean; isLocationPage: boolean } {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return { isServicePage: false, isLocationPage: false };
  }
  const isHomepage = url === homepageUrl || pathname === "/" || pathname === "";
  const isLocationPage =
    LOCATION_PATH_RE.test(pathname) ||
    (locationSlug !== null && pathname.includes(locationSlug));
  const isServicePage = !isHomepage && SERVICE_PATH_RE.test(pathname);
  return { isServicePage, isLocationPage };
}

// ---------------------------------------------------------------------------
// Per-page analysis
// ---------------------------------------------------------------------------

function analyzePage(
  url: string,
  html: string,
  homepageUrl: string,
  locationSlug: string | null,
): OnPagePageResult {
  const title = extractTitle(html);
  const metaDescription = extractMetaContent(html, "description");
  const h1s = extractH1s(html);
  const canonical = extractCanonical(html);
  const robotsMeta = extractMetaContent(html, "robots");
  const viewport = extractMetaContent(html, "viewport");
  const lang = extractHtmlLang(html);
  const schemaTypes = extractSchemaTypes(html);
  const internalLinkCount = extractInternalLinks(html, url).length;
  const wordCount = countWords(stripHtml(html));
  const { isServicePage, isLocationPage } = classifyPageType(
    url,
    homepageUrl,
    locationSlug,
  );

  return {
    url,
    fetched: true,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1: h1s[0] ?? null,
    h1Count: h1s.length,
    wordCount,
    canonical,
    robotsMeta,
    noindex: robotsMeta?.toLowerCase().includes("noindex") ?? false,
    viewport,
    lang,
    schemaTypes,
    internalLinkCount,
    isServicePage,
    isLocationPage,
  };
}

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------

function toLocationSlug(locationHint: string | null | undefined): string | null {
  if (!locationHint) return null;
  const city = locationHint.split(",")[0]?.trim().toLowerCase();
  if (!city) return null;
  return city.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null;
}

function selectCrawlTargets(
  homepageUrl: string,
  links: string[],
  maxTargets: number,
  locationSlug: string | null,
): string[] {
  const seen = new Set<string>([homepageUrl]);
  const scored: Array<{ url: string; priority: number }> = [];

  for (const link of links) {
    if (seen.has(link)) continue;
    let pathname: string;
    try {
      pathname = new URL(link).pathname.toLowerCase();
    } catch {
      continue;
    }
    if (!pathname || pathname === "/") continue;
    if (SKIP_PATH_RE.test(pathname)) continue;
    seen.add(link);

    let priority = 1;
    if (SERVICE_PATH_RE.test(pathname)) priority = 3;
    else if (
      LOCATION_PATH_RE.test(pathname) ||
      (locationSlug !== null && pathname.includes(locationSlug))
    )
      priority = 3;
    else if (ABOUT_CONTACT_RE.test(pathname)) priority = 2;

    scored.push({ url: link, priority });
  }

  scored.sort((a, b) => b.priority - a.priority);
  return scored.slice(0, maxTargets).map((entry) => entry.url);
}

async function fetchSitemap(
  origin: string,
  fetchText: (url: string) => Promise<string | null>,
): Promise<{ found: boolean; urlCount: number | null }> {
  const xml = await fetchText(`${origin}/sitemap.xml`);
  if (!xml) return { found: false, urlCount: null };
  const locs = xml.match(/<loc>\s*[^<]+<\/loc>/gi);
  return { found: true, urlCount: locs ? locs.length : 0 };
}

async function fetchRobots(
  origin: string,
  fetchText: (url: string) => Promise<string | null>,
): Promise<{ found: boolean; disallowAll: boolean }> {
  const text = await fetchText(`${origin}/robots.txt`);
  if (!text) return { found: false, disallowAll: false };
  const disallowAll = /^\s*disallow:\s*\/\s*$/im.test(text);
  return { found: true, disallowAll };
}

export async function crawlOnPage(
  targetUrl: string,
  options: OnPageCrawlOptions = {},
): Promise<OnPageCrawlResult> {
  const doFetchHtml = options.fetchHtml ?? fetchHtml;
  const doFetchText = options.fetchText ?? fetchRawText;
  const maxPages = Math.max(1, options.maxPages ?? MAX_PAGES_TO_CRAWL);
  const locationSlug = toLocationSlug(options.locationHint);

  const homepageUrl = normalizeTargetUrl(targetUrl);
  const domain = extractDomain(targetUrl);
  const origin = (() => {
    try {
      return new URL(homepageUrl).origin;
    } catch {
      return `https://${domain}`;
    }
  })();

  const homepageHtml = await doFetchHtml(homepageUrl);

  if (!homepageHtml) {
    return {
      crawledAt: new Date().toISOString(),
      homepageUrl,
      pagesCrawled: 0,
      pagesRequested: 1,
      sitemapFound: false,
      sitemapUrlCount: null,
      robotsTxtFound: false,
      robotsDisallowAll: false,
      findings: [
        {
          id: "on_page_site_unreachable",
          severity: "critical",
          title: "Homepage could not be fetched",
          description:
            "The audit bot could not download the homepage. Search engines may also struggle to crawl it. Check that the site is online, returns HTTP 200, and does not block automated requests.",
          url: homepageUrl,
          fix: "Confirm the site loads in a browser and is not blocking crawlers.",
          impact: "high",
        },
      ],
      pages: [],
      score: null,
      nap: null,
    };
  }

  const homepage = analyzePage(homepageUrl, homepageHtml, homepageUrl, locationSlug);
  const internalLinks = extractInternalLinks(homepageHtml, homepageUrl);
  const targets = selectCrawlTargets(
    homepageUrl,
    internalLinks,
    maxPages - 1,
    locationSlug,
  );

  const [pageResults, sitemap, robots] = await Promise.all([
    Promise.all(
      targets.map(async (url) => {
        const html = await doFetchHtml(url);
        return html ? analyzePage(url, html, homepageUrl, locationSlug) : null;
      }),
    ),
    fetchSitemap(origin, doFetchText),
    fetchRobots(origin, doFetchText),
  ]);

  const pages = [homepage, ...pageResults.filter((p): p is OnPagePageResult => p !== null)];
  const findings = buildFindings({
    homepage,
    pages,
    internalLinkCount: homepage.internalLinkCount,
    sitemap,
    robots,
  });
  const score = computeOnPageScore({ homepage, pages, sitemap, robots });

  return {
    crawledAt: new Date().toISOString(),
    homepageUrl,
    pagesCrawled: pages.length,
    pagesRequested: 1 + targets.length,
    sitemapFound: sitemap.found,
    sitemapUrlCount: sitemap.urlCount,
    robotsTxtFound: robots.found,
    robotsDisallowAll: robots.disallowAll,
    findings,
    pages,
    score,
    nap: extractNap(homepageHtml),
  };
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

function finding(
  id: string,
  severity: OnPageFindingSeverity,
  impact: OnPageImpact,
  title: string,
  description: string,
  url: string,
  fix: string,
): OnPageFinding {
  return { id, severity, impact, title, description, url, fix };
}

function buildFindings(input: {
  homepage: OnPagePageResult;
  pages: OnPagePageResult[];
  internalLinkCount: number;
  sitemap: { found: boolean; urlCount: number | null };
  robots: { found: boolean; disallowAll: boolean };
}): OnPageFinding[] {
  const { homepage, pages, internalLinkCount, sitemap, robots } = input;
  const findings: OnPageFinding[] = [];
  const url = homepage.url;

  if (!homepage.title) {
    findings.push(
      finding(
        "on_page_missing_title",
        "critical",
        "high",
        "Homepage has no title tag",
        "The homepage has no <title>. The title is the clickable headline in Google results and one of the strongest relevance signals.",
        url,
        "Add a unique <title> of 15-60 characters that includes the service and city.",
      ),
    );
  } else if (homepage.titleLength > 60 || homepage.titleLength < 15) {
    findings.push(
      finding(
        "on_page_title_length",
        "warning",
        "medium",
        `Homepage title is ${homepage.titleLength} characters`,
        "Titles longer than ~60 characters are truncated in search results; very short titles waste relevance. Aim for 15-60 characters.",
        url,
        "Rewrite the title to 15-60 characters, leading with the service and city.",
      ),
    );
  }

  if (!homepage.metaDescription) {
    findings.push(
      finding(
        "on_page_missing_meta_description",
        "warning",
        "medium",
        "Homepage has no meta description",
        "There is no meta description. Google will improvise a snippet, which usually reduces click-through from search results.",
        url,
        "Add a 50-160 character meta description with the service, city and a call to action.",
      ),
    );
  } else if (
    homepage.metaDescriptionLength > 160 ||
    homepage.metaDescriptionLength < 50
  ) {
    findings.push(
      finding(
        "on_page_meta_description_length",
        "info",
        "low",
        `Meta description is ${homepage.metaDescriptionLength} characters`,
        "Meta descriptions outside 50-160 characters are truncated or too thin to earn the click.",
        url,
        "Trim or expand the meta description to 50-160 characters.",
      ),
    );
  }

  if (homepage.h1Count === 0) {
    findings.push(
      finding(
        "on_page_missing_h1",
        "critical",
        "high",
        "Homepage has no H1 heading",
        "The homepage has no <h1>. The H1 tells Google (and visitors) what the page is about.",
        url,
        "Add one H1 that states the service and city.",
      ),
    );
  } else if (homepage.h1Count > 1) {
    findings.push(
      finding(
        "on_page_multiple_h1",
        "warning",
        "low",
        `Homepage has ${homepage.h1Count} H1 headings`,
        "Multiple H1s dilute the page's main topic. Use one H1 and demote the rest to H2.",
        url,
        "Keep a single H1; change the others to H2.",
      ),
    );
  }

  if (!homepage.canonical) {
    findings.push(
      finding(
        "on_page_missing_canonical",
        "info",
        "low",
        "Homepage has no canonical tag",
        "Without a rel=canonical, duplicate URLs (with/without www, tracking params) can split ranking signals.",
        url,
        'Add <link rel="canonical" href="..."> pointing to the preferred homepage URL.',
      ),
    );
  }

  if (homepage.noindex) {
    findings.push(
      finding(
        "on_page_noindex",
        "critical",
        "high",
        "Homepage is set to noindex",
        'A robots meta tag contains "noindex", which asks Google not to list the page at all.',
        url,
        'Remove noindex from the robots meta tag (use "index,follow").',
      ),
    );
  }

  if (!homepage.viewport) {
    findings.push(
      finding(
        "on_page_missing_viewport",
        "warning",
        "medium",
        "Homepage has no viewport meta tag",
        "Without a viewport tag, mobile browsers render a zoomed-out desktop layout, hurting mobile usability and rankings.",
        url,
        'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
      ),
    );
  }

  if (!homepage.lang) {
    findings.push(
      finding(
        "on_page_missing_lang",
        "info",
        "low",
        "Homepage <html> has no lang attribute",
        "A lang attribute helps search engines and assistive tech know the page language.",
        url,
        'Add lang="en" (or the correct language) to the <html> tag.',
      ),
    );
  }

  const schemaTypes = new Set(pages.flatMap((p) => p.schemaTypes));
  if (schemaTypes.size === 0) {
    findings.push(
      finding(
        "on_page_missing_schema",
        "warning",
        "medium",
        "No structured data (JSON-LD) found",
        "No schema.org markup was found. Structured data helps Google understand the business and can unlock rich results.",
        url,
        "Add LocalBusiness JSON-LD (name, address, phone, hours) to the homepage.",
      ),
    );
  } else {
    const hasLocalBusiness = [...schemaTypes].some((t) =>
      /localbusiness|professionalservice|homeandconstructionbusiness|store|dentist|restaurant|attorney|plumber|electrician|contractor|hvacbusiness/i.test(
        t,
      ),
    );
    if (!hasLocalBusiness) {
      findings.push(
        finding(
          "on_page_missing_local_business_schema",
          "warning",
          "medium",
          "No LocalBusiness structured data",
          "Structured data exists but none of it is a LocalBusiness type, so Google gets no machine-readable NAP, hours or category.",
          url,
          "Add LocalBusiness JSON-LD with name, address, phone, opening hours and category.",
        ),
      );
    }
    if (!schemaTypes.has("Service") && !schemaTypes.has("Offer")) {
      findings.push(
        finding(
          "on_page_missing_service_schema",
          "info",
          "low",
          "No Service structured data",
          "There is no Service schema, so the services offered are not described to Google in a structured way.",
          url,
          "Add Service JSON-LD for each main service.",
        ),
      );
    }
    if (!schemaTypes.has("FAQPage") && !schemaTypes.has("Question")) {
      findings.push(
        finding(
          "on_page_missing_faq_schema",
          "info",
          "low",
          "No FAQ structured data",
          "No FAQPage schema was found. FAQs are a cheap way to win answer-box and AI-overview visibility.",
          url,
          "Add FAQPage JSON-LD for the questions customers actually ask.",
        ),
      );
    }
  }

  if (homepage.wordCount < THIN_CONTENT_MIN_WORDS) {
    findings.push(
      finding(
        "on_page_thin_content",
        "warning",
        "medium",
        `Homepage has only ~${homepage.wordCount} words`,
        `Thin pages (under ~${THIN_CONTENT_MIN_WORDS} words) rarely rank for competitive local terms because they do not cover the topic.`,
        url,
        "Add genuinely useful content: services, service areas, FAQs and trust signals.",
      ),
    );
  }

  if (internalLinkCount < MIN_INTERNAL_LINKS) {
    findings.push(
      finding(
        "on_page_few_internal_links",
        "warning",
        "medium",
        `Homepage has only ${internalLinkCount} internal links`,
        "Few internal links make it hard for Google to discover the rest of the site and pass ranking signals to service/location pages.",
        url,
        "Link to your service, location and about pages from the homepage.",
      ),
    );
  }

  const servicePages = pages.filter((p) => p.isServicePage);
  if (servicePages.length === 0) {
    findings.push(
      finding(
        "on_page_no_service_pages",
        "warning",
        "high",
        "No dedicated service pages found",
        "No service page was discovered. Individual service pages are the strongest lever for local organic rankings.",
        url,
        "Create a page per service (e.g. /services/drain-cleaning) with its own title, H1 and content.",
      ),
    );
  }

  const locationPages = pages.filter((p) => p.isLocationPage);
  if (locationPages.length === 0) {
    findings.push(
      finding(
        "on_page_no_location_pages",
        "warning",
        "high",
        "No location or service-area pages found",
        "No location page was discovered. City/service-area pages are how local businesses rank in nearby towns.",
        url,
        "Create a page per city or service area (e.g. /areas/nashville).",
      ),
    );
  }

  if (!sitemap.found) {
    findings.push(
      finding(
        "on_page_missing_sitemap",
        "warning",
        "medium",
        "No XML sitemap found at /sitemap.xml",
        "A sitemap helps Google discover and re-crawl your pages, especially new service and location pages.",
        url,
        "Publish an XML sitemap at /sitemap.xml and reference it in robots.txt.",
      ),
    );
  }

  if (!robots.found) {
    findings.push(
      finding(
        "on_page_missing_robots_txt",
        "info",
        "low",
        "No robots.txt found",
        "A robots.txt is not required, but it is the standard place to point Google at your sitemap.",
        url,
        "Add a robots.txt that allows crawling and links to your sitemap.",
      ),
    );
  } else if (robots.disallowAll) {
    findings.push(
      finding(
        "on_page_robots_disallow_all",
        "critical",
        "high",
        "robots.txt blocks all crawlers",
        'robots.txt contains "Disallow: /", which asks search engines not to crawl any page on the site.',
        url,
        "Remove the blanket Disallow rule and allow crawling.",
      ),
    );
  }

  // Aggregated per-page issues (kept as single findings so the list stays tight).
  const otherPages = pages.filter((p) => p.url !== homepage.url);
  if (otherPages.length > 0) {
    const missingTitle = otherPages.filter((p) => !p.title);
    const missingMeta = otherPages.filter((p) => !p.metaDescription);
    const missingH1 = otherPages.filter((p) => p.h1Count === 0);
    const thin = otherPages.filter((p) => p.wordCount < THIN_CONTENT_MIN_WORDS);
    const noindexed = otherPages.filter((p) => p.noindex);

    if (missingTitle.length > 0) {
      findings.push(
        finding(
          "on_page_pages_missing_title",
          "warning",
          "medium",
          `${missingTitle.length} of ${otherPages.length} crawled pages have no title`,
          `Pages without a title cannot rank well: ${missingTitle
            .slice(0, 3)
            .map((p) => p.url)
            .join(", ")}${missingTitle.length > 3 ? ", ..." : ""}`,
          url,
          "Give every page a unique, descriptive title.",
        ),
      );
    }
    if (missingMeta.length > 0) {
      findings.push(
        finding(
          "on_page_pages_missing_meta",
          "warning",
          "medium",
          `${missingMeta.length} of ${otherPages.length} crawled pages have no meta description`,
          "Pages without a meta description get improvised snippets, lowering click-through.",
          url,
          "Add a unique meta description to every page.",
        ),
      );
    }
    if (missingH1.length > 0) {
      findings.push(
        finding(
          "on_page_pages_missing_h1",
          "warning",
          "medium",
          `${missingH1.length} of ${otherPages.length} crawled pages have no H1`,
          "Pages without an H1 give Google no clear topic heading.",
          url,
          "Add one H1 per page.",
        ),
      );
    }
    if (thin.length > 0) {
      findings.push(
        finding(
          "on_page_pages_thin",
          "info",
          "low",
          `${thin.length} of ${otherPages.length} crawled pages look thin`,
          `Pages under ~${THIN_CONTENT_MIN_WORDS} words rarely rank for competitive terms.`,
          url,
          "Expand thin pages with useful, specific content.",
        ),
      );
    }
    if (noindexed.length > 0) {
      findings.push(
        finding(
          "on_page_pages_noindex",
          "critical",
          "high",
          `${noindexed.length} of ${otherPages.length} crawled pages are set to noindex`,
          "These pages ask Google not to index them, so they can never rank.",
          url,
          "Remove noindex from pages you want to rank.",
        ),
      );
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const PENALTIES: Record<string, number> = {
  on_page_missing_title: 25,
  on_page_title_length: 5,
  on_page_missing_meta_description: 12,
  on_page_meta_description_length: 3,
  on_page_missing_h1: 15,
  on_page_multiple_h1: 4,
  on_page_missing_canonical: 3,
  on_page_noindex: 30,
  on_page_missing_viewport: 8,
  on_page_missing_lang: 2,
  on_page_missing_schema: 10,
  on_page_missing_local_business_schema: 6,
  on_page_missing_service_schema: 3,
  on_page_missing_faq_schema: 2,
  on_page_thin_content: 8,
  on_page_few_internal_links: 6,
  on_page_no_service_pages: 8,
  on_page_no_location_pages: 8,
  on_page_missing_sitemap: 6,
  on_page_missing_robots_txt: 2,
  on_page_robots_disallow_all: 25,
  on_page_pages_missing_title: 4,
  on_page_pages_missing_meta: 3,
  on_page_pages_missing_h1: 3,
  on_page_pages_thin: 2,
  on_page_pages_noindex: 10,
};

/**
 * Turn the crawl into a 0-100 score. Starts at 100 and subtracts a fixed
 * penalty per finding, so the score is deterministic and easy to explain.
 * Returns null when the homepage could not be fetched (not measured).
 */
export function computeOnPageScore(input: {
  homepage: OnPagePageResult | null;
  pages: OnPagePageResult[];
  sitemap: { found: boolean; urlCount: number | null };
  robots: { found: boolean; disallowAll: boolean };
}): number | null {
  if (!input.homepage) return null;

  const findings = buildFindings({
    homepage: input.homepage,
    pages: input.pages,
    internalLinkCount: input.homepage.internalLinkCount,
    sitemap: input.sitemap,
    robots: input.robots,
  });

  const total = findings.reduce(
    (sum, f) => sum + (PENALTIES[f.id] ?? 0),
    0,
  );
  return Math.max(0, Math.min(100, 100 - total));
}
