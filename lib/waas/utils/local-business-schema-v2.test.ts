import test from "node:test";
import assert from "node:assert/strict";

import { buildLocalBusinessServiceJsonLdV2 } from "./local-business-schema-v2";

test("builds LocalBusiness graph with service nodes, geo, licenses, and hours", () => {
  const result = buildLocalBusinessServiceJsonLdV2({
    canonicalUrl: "https://example.com",
    name: "Acme Plumbing",
    businessType: "Plumber",
    description: "Emergency plumbing support.",
    telephone: "+1-615-555-0101",
    email: "dispatch@example.com",
    address: {
      streetAddress: "123 Main St",
      addressLocality: "Nashville",
      addressRegion: "TN",
      postalCode: "37201",
      addressCountry: "US",
    },
    geo: {
      latitude: 36.1627,
      longitude: -86.7816,
      elevation: 182,
    },
    licenses: [
      {
        licenseNumber: "TN-PLUMB-7788",
        authorityName: "TN Board",
        authorityUrl: "https://example.gov/licenses",
        issuingRegion: "TN",
      },
    ],
    operatingHours: [
      {
        dayOfWeek: ["Monday", "Tuesday"],
        opens: "07:00",
        closes: "19:00",
      },
    ],
    serviceAreas: ["Nashville", "Franklin"],
    services: [
      {
        name: "Drain Cleaning",
        description: "Mainline and branch drain cleaning.",
        serviceType: "Plumbing",
        category: "Emergency Plumbing",
        areaServed: ["Nashville"],
        offers: [
          {
            name: "Drain Callout",
            price: 129,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: "https://example.com/services/drain-cleaning",
          },
        ],
      },
    ],
  });

  assert.equal(result["@context"], "https://schema.org");

  const graph = result["@graph"] as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(graph));
  assert.equal(graph.length, 2);

  const localBusiness = graph.find((node) => node["@type"] === "Plumber");
  assert.ok(localBusiness);
  assert.equal(localBusiness?.name, "Acme Plumbing");

  const geo = localBusiness?.geo as Record<string, unknown>;
  assert.equal(geo.latitude, 36.1627);
  assert.equal(geo.longitude, -86.7816);

  const identifiers = localBusiness?.identifier as Array<
    Record<string, unknown>
  >;
  assert.equal(identifiers[0]?.value, "TN-PLUMB-7788");

  const serviceNode = graph.find((node) => node["@type"] === "Service");
  assert.ok(serviceNode);
  assert.equal(serviceNode?.name, "Drain Cleaning");

  const offers = serviceNode?.offers as Array<Record<string, unknown>>;
  assert.equal(offers[0]?.price, 129);
  assert.equal(offers[0]?.priceCurrency, "USD");
});

test("defaults offer currency to USD and links service provider to local business node", () => {
  const result = buildLocalBusinessServiceJsonLdV2({
    canonicalUrl: "https://example.com",
    name: "Summit HVAC",
    address: { addressCountry: "US" },
    services: [
      {
        name: "No-Cool Diagnostics",
        offers: [
          {
            name: "Diagnostics Visit",
            price: "89",
          },
        ],
      },
    ],
  });

  const graph = result["@graph"] as Array<Record<string, unknown>>;
  const localBusiness = graph.find((node) => node["@type"] === "LocalBusiness");
  const serviceNode = graph.find((node) => node["@type"] === "Service");

  assert.ok(localBusiness);
  assert.ok(serviceNode);

  const provider = serviceNode?.provider as Record<string, unknown>;
  assert.equal(provider["@id"], localBusiness?.["@id"]);

  const offers = serviceNode?.offers as Array<Record<string, unknown>>;
  assert.equal(offers[0]?.priceCurrency, "USD");
});

test("produces empty service graph entries safely when no optional fields are provided", () => {
  const result = buildLocalBusinessServiceJsonLdV2({
    canonicalUrl: "https://example.com",
    name: "Local Services Co",
    address: { addressCountry: "US" },
    services: [{ name: "Emergency Visit" }],
  });

  const graph = result["@graph"] as Array<Record<string, unknown>>;
  assert.equal(graph.length, 2);

  const localBusiness = graph.find((node) => node["@type"] === "LocalBusiness");
  const serviceNode = graph.find((node) => node["@type"] === "Service");

  assert.ok(localBusiness);
  assert.ok(serviceNode);

  const localAddress = localBusiness?.address as Record<string, unknown>;
  assert.equal(localAddress.addressCountry, "US");
  assert.equal(serviceNode?.name, "Emergency Visit");
});
