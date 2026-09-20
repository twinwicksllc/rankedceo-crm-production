import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuditScoreComparison,
  type RawAuditRow,
} from "./compute-audit-score-comparison";

describe("Initiative 9: Audit score comparison logic", () => {
  const auditRow = (
    id: string,
    overallScore: number,
    completedAt: string,
    scores: Record<string, number> = {},
  ): RawAuditRow => ({
    id,
    status: "completed",
    target_url: id === "audit-1" ? "https://old-site.com" : "https://new-client.rankedceo.com",
    completed_at: completedAt,
    report_data: { summary: { overall_score: overallScore, ...scores } },
    audit_type: "prospect",
    created_at: completedAt,
  });

  it("handles baseline-only scenario when no re-audit has been performed", () => {
    const comp = buildAuditScoreComparison([
      auditRow("audit-1", 42.4, "2026-08-01T12:00:00Z", {
        seo_score: 50,
        mobile_score: 35,
        performance_score: 40,
      }),
    ], null);
    assert.ok(comp);
    assert.equal(comp.baseline.overallScore, 42);
    assert.equal(comp.totalAuditsCount, 1);
    assert.equal(comp.hasReAudit, false);
    assert.equal(comp.latest, null);
    assert.equal(comp.delta, null);
  });

  it("computes positive deltas correctly when re-audit improves scores", () => {
    const comp = buildAuditScoreComparison([
      auditRow("audit-1", 42, "2026-08-01T12:00:00Z", {
        seo_score: 50,
        mobile_score: 35,
        performance_score: 40,
      }),
      auditRow("audit-2", 78.2, "2026-08-15T12:00:00Z", {
        seo_score: 85,
        mobile_score: 70,
        performance_score: 80,
      }),
    ], null);
    assert.ok(comp);
    assert.equal(comp.hasReAudit, true);
    assert.equal(comp.baseline.overallScore, 42);
    assert.equal(comp.latest?.overallScore, 78);
    assert.deepEqual(comp.delta, {
      overall: 36,
      seo: 35,
      mobile: 35,
      performance: 40,
    });
  });

  it("handles null/missing sub-scores gracefully", () => {
    const comp = buildAuditScoreComparison([
      auditRow("audit-1", 50, "2026-08-01T12:00:00Z"),
      auditRow("audit-2", 70, "2026-08-15T12:00:00Z", { seo_score: 80 }),
    ], null);
    assert.ok(comp);
    assert.equal(comp.delta?.overall, 20);
    assert.equal(comp.delta?.seo, null);
    assert.equal(comp.delta?.mobile, null);
    assert.equal(comp.delta?.performance, null);
  });
});
