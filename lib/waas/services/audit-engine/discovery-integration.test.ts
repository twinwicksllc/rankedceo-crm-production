import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFullAudit } from "./index";

// Offline: mock provider, and a .example target that can never resolve, so the
// site scrape fails fast and no real network call can succeed.
describe("runFullAudit competitor discovery (mock provider)", () => {
  const original = process.env.WAAS_SEO_PROVIDER;
  before(() => {
    process.env.WAAS_SEO_PROVIDER = "mock";
  });
  after(() => {
    if (original === undefined) delete process.env.WAAS_SEO_PROVIDER;
    else process.env.WAAS_SEO_PROVIDER = original;
  });

  type Competitor = { url: string; source?: string };
  const competitorsOf = (result: unknown): Competitor[] =>
    ((result as { reportData?: { competitors?: Competitor[] } }).reportData
      ?.competitors ?? []) as Competitor[];

  it("discovers up to three competitors when none are typed", async () => {
    const result = await runFullAudit(
      "https://acme-plumbing.example",
      [],
      "plumbing",
      "Austin, TX",
    );
    const competitors = competitorsOf(result);
    assert.equal(competitors.length, 3);
    assert.ok(competitors.every((c) => c.source === "discovered"));
  });

  it("keeps typed competitors first and fills the rest with discovered ones", async () => {
    const result = await runFullAudit(
      "https://acme-plumbing.example",
      ["https://typed-rival.example"],
      "plumbing",
      "Austin, TX",
    );
    const competitors = competitorsOf(result);
    assert.equal(competitors.length, 3);
    assert.equal(competitors[0].url, "https://typed-rival.example");
    assert.equal(competitors[0].source, "typed");
    assert.ok(competitors.slice(1).every((c) => c.source === "discovered"));
  });

  it("never discovers the client's own site", async () => {
    const result = await runFullAudit(
      "https://acme-plumbing.example",
      [],
      "plumbing",
      "Austin, TX",
    );
    assert.ok(
      competitorsOf(result).every((c) => !c.url.includes("acme-plumbing")),
    );
  });

  it("adds a v3 score with a GBP component and GBP analysis from the shared lookup", async () => {
    const result = await runFullAudit(
      "https://acme-plumbing.example",
      [],
      "plumbing",
      "Austin, TX",
    );
    const report = result.reportData as unknown as {
      summary?: {
        score_version?: number;
        overall_score_components?: Array<{ key?: string; label: string; measured: boolean }>;
      };
      gbp?: { found: boolean; places_checked: number };
    };
    assert.equal(report.summary?.score_version, 3);
    const gbpComponent = report.summary?.overall_score_components?.find(
      (c) => c.label === "Google Business Profile",
    );
    assert.ok(gbpComponent, "the GBP component is in the stored breakdown");
    assert.ok(report.gbp, "gbp analysis is stored when places were available");
    assert.ok(report.gbp.places_checked >= 3);
  });
});
