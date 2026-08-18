import test from "node:test";
import assert from "node:assert/strict";

import type { WaasTenant } from "@/lib/waas/types";
import {
  generateMetaTitle,
  generateMetaDescription,
  generateOgImageUrl,
  generateSeoDefaults,
} from "../seo-defaults";

const mockTenant = (overrides?: Partial<WaasTenant>): WaasTenant => ({
  id: "test-tenant-1",
  domain: null,
  subdomain: null,
  slug: "test-tenant",
  brand_config: {
    business_name: "Test Business",
  },
  package_tier: "standard",
  status: "onboarding",
  crm_account_id: null,
  vercel_project_id: null,
  domain_verified: false,
  domain_verified_at: null,
  target_industry: null,
  target_location: null,
  legal_name: null,
  physical_address: null,
  city: null,
  state: null,
  zip: null,
  primary_trade: null,
  source_audit_id: null,
  calendly_url: null,
  financing_enabled: false,
  usp: null,
  onboarding_step: 4,
  onboarding_completed: false,
  onboarding_completed_at: null,
  submitted_by_email: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// generateMetaTitle
// ---------------------------------------------------------------------------

test("generateMetaTitle: generates title with all components: business_name | primary_trade in city, state", () => {
  const tenant = mockTenant({
    legal_name: "Acme Plumbing",
    primary_trade: "Plumbing",
    city: "Chicago",
    state: "IL",
  });
  const title = generateMetaTitle(tenant);
  assert.equal(title, "Acme Plumbing | Plumbing in Chicago, IL");
});

test("generateMetaTitle: trims to 60 chars max", () => {
  const tenant = mockTenant({
    legal_name: "Very Long Business Name LLC",
    primary_trade: "Professional Advanced Services",
    city: "San Francisco",
    state: "California",
  });
  const title = generateMetaTitle(tenant);
  assert.ok(title.length <= 60);
  assert.ok(title.endsWith("..."));
});

test("generateMetaTitle: ensures minimum length of 20 chars", () => {
  const tenant = mockTenant({
    legal_name: "Co",
    primary_trade: "Svc",
  });
  const title = generateMetaTitle(tenant);
  assert.ok(title.length >= 20);
});

test("generateMetaTitle: falls back to business_name when primary_trade missing", () => {
  const tenant = mockTenant({
    legal_name: "Test Business",
    city: "Denver",
    state: "CO",
  });
  const title = generateMetaTitle(tenant);
  assert.ok(title.includes("Test Business"));
  assert.ok(title.includes("Services")); // default
});

test("generateMetaTitle: uses brand_config.business_name when legal_name missing", () => {
  const tenant = mockTenant({
    legal_name: null,
    brand_config: { business_name: "Brand Co" },
    primary_trade: "Consulting",
    city: "Austin",
    state: "TX",
  });
  const title = generateMetaTitle(tenant);
  assert.ok(title.includes("Brand Co"));
});

test("generateMetaTitle: handles city without state", () => {
  const tenant = mockTenant({
    legal_name: "Local Shop",
    primary_trade: "Retail",
    city: "Brooklyn",
  });
  const title = generateMetaTitle(tenant);
  assert.ok(title.includes("Local Shop"));
  assert.ok(title.includes("Brooklyn"));
});

test("generateMetaTitle: handles state without city", () => {
  const tenant = mockTenant({
    legal_name: "State Co",
    primary_trade: "Manufacturing",
    state: "Ohio",
  });
  const title = generateMetaTitle(tenant);
  assert.ok(title.includes("State Co"));
  assert.ok(title.includes("Ohio"));
});

// ---------------------------------------------------------------------------
// generateMetaDescription
// ---------------------------------------------------------------------------

test("generateMetaDescription: generates description >= 70 and <= 160 chars", () => {
  const tenant = mockTenant({
    legal_name: "ABC Company",
    primary_trade: "Web Design",
    city: "New York",
    state: "NY",
    usp: "We create stunning, responsive websites that convert visitors into customers.",
  });
  const desc = generateMetaDescription(tenant);
  assert.ok(desc.length >= 70);
  assert.ok(desc.length <= 160);
});

test("generateMetaDescription: uses USP if available and short enough", () => {
  const usp = "Best plumbing in town";
  const tenant = mockTenant({
    usp,
    city: "Chicago",
    state: "IL",
  });
  const desc = generateMetaDescription(tenant);
  assert.ok(desc.includes(usp));
});

test("generateMetaDescription: falls back to tagline when USP missing", () => {
  const tagline = "Quality service guaranteed";
  const tenant = mockTenant({
    brand_config: { business_name: "Test", tagline },
    city: "Denver",
    state: "CO",
  });
  const desc = generateMetaDescription(tenant);
  assert.ok(desc.includes(tagline));
});

test("generateMetaDescription: generates fallback when no USP or tagline", () => {
  const tenant = mockTenant({
    legal_name: "Generic Corp",
    primary_trade: "Consulting",
    city: "Austin",
    state: "TX",
  });
  const desc = generateMetaDescription(tenant);
  assert.ok(desc.includes("Generic Corp"));
  assert.ok(desc.includes("Consulting"));
  assert.ok(desc.length >= 70);
});

test("generateMetaDescription: trims long descriptions intelligently", () => {
  const longUsp =
    "This is a very long unique selling proposition that goes on and on and on and definitely exceeds the character limit and should be truncated gracefully.";
  const tenant = mockTenant({
    usp: longUsp,
    city: "Seattle",
    state: "WA",
  });
  const desc = generateMetaDescription(tenant);
  assert.ok(desc.length <= 160);
  assert.ok(desc.endsWith("."));
});

test("generateMetaDescription: includes location suffix when available", () => {
  const tenant = mockTenant({
    legal_name: "Local Service",
    primary_trade: "Cleaning",
    city: "Portland",
    state: "OR",
  });
  const desc = generateMetaDescription(tenant);
  assert.ok(desc.includes("Portland"));
  assert.ok(desc.includes("OR"));
});

test("generateMetaDescription: handles missing location gracefully", () => {
  const tenant = mockTenant({
    legal_name: "Online Service",
    primary_trade: "Tutoring",
  });
  const desc = generateMetaDescription(tenant);
  assert.ok(desc.length >= 70);
  assert.ok(desc.includes("Online Service"));
});

// ---------------------------------------------------------------------------
// generateOgImageUrl
// ---------------------------------------------------------------------------

test("generateOgImageUrl: returns logo_url when available", () => {
  const logoUrl = "https://example.com/logo.png";
  const tenant = mockTenant({
    brand_config: { business_name: "Test", logo_url: logoUrl },
  });
  const url = generateOgImageUrl(tenant);
  assert.equal(url, logoUrl);
});

test("generateOgImageUrl: returns null when logo_url missing", () => {
  const tenant = mockTenant();
  const url = generateOgImageUrl(tenant);
  assert.equal(url, null);
});

test("generateOgImageUrl: returns null for empty logo_url", () => {
  const tenant = mockTenant({
    brand_config: { business_name: "Test", logo_url: "" },
  });
  const url = generateOgImageUrl(tenant);
  assert.equal(url, null);
});

test("generateOgImageUrl: returns null for whitespace logo_url", () => {
  const tenant = mockTenant({
    brand_config: { business_name: "Test", logo_url: "   " },
  });
  const url = generateOgImageUrl(tenant);
  assert.equal(url, null);
});

// ---------------------------------------------------------------------------
// generateSeoDefaults
// ---------------------------------------------------------------------------

test("generateSeoDefaults: generates all three defaults together", () => {
  const tenant = mockTenant({
    legal_name: "Full Service Inc",
    primary_trade: "Marketing",
    city: "Boston",
    state: "MA",
    usp: "Data-driven marketing strategies that work.",
    brand_config: {
      business_name: "Full Service Inc",
      logo_url: "https://example.com/logo.png",
    },
  });
  const defaults = generateSeoDefaults(tenant);
  assert.ok(defaults.meta_title);
  assert.ok(defaults.meta_title.length >= 20);
  assert.ok(defaults.meta_description);
  assert.ok(defaults.meta_description.length >= 70);
  assert.ok(defaults.meta_description.length <= 160);
  assert.equal(defaults.og_image_url, "https://example.com/logo.png");
});

test("generateSeoDefaults: generates defaults when tenant data is minimal", () => {
  const tenant = mockTenant();
  const defaults = generateSeoDefaults(tenant);
  assert.ok(defaults.meta_title);
  assert.ok(defaults.meta_title.length >= 20);
  assert.ok(defaults.meta_description);
  assert.ok(defaults.meta_description.length >= 70);
  assert.equal(defaults.og_image_url, null);
});
