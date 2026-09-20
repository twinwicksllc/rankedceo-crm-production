import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Initiative 9: Audit score comparison logic", () => {
  interface RawAuditRow {
    id: string;
    target_url: string;
    report_data: Record<string, unknown> | null;
    completed_at: string | null;
  }

  function parseAuditSnapshot(row: RawAuditRow) {
    const summary = (row.report_data?.summary as Record<string, number> | null) ?? null;
    const overall = summary?.overall_score ?? null;
    if (overall === null) return null;

    return {
      auditId: row.id,
      targetUrl: row.target_url,
      overallScore: Math.round(overall),
      seoScore: summary?.seo_score != null ? Math.round(summary.seo_score) : null,
      mobileScore: summary?.mobile_score != null ? Math.round(summary.mobile_score) : null,
      performanceScore: summary?.performance_score != null ? Math.round(summary.performance_score) : null,
      completedAt: row.completed_at,
    };
  }

  function computeComparison(
    baselineRow: RawAuditRow | null,
    latestRow: RawAuditRow | null
  ) {
    if (!baselineRow) return null;
    const baseline = parseAuditSnapshot(baselineRow);
    if (!baseline) return null;

    const latest = latestRow ? parseAuditSnapshot(latestRow) : null;
    let delta = null;

    if (latest) {
      delta = {
        overall: latest.overallScore - baseline.overallScore,
        seo:
          latest.seoScore != null && baseline.seoScore != null
            ? latest.seoScore - baseline.seoScore
            : null,
        mobile:
          latest.mobileScore != null && baseline.mobileScore != null
            ? latest.mobileScore - baseline.mobileScore
            : null,
        performance:
          latest.performanceScore != null && baseline.performanceScore != null
            ? latest.performanceScore - baseline.performanceScore
            : null,
      };
    }

    return {
      baseline,
      latest,
      delta,
      hasReAudit: latest !== null,
    };
  }

  it("handles baseline-only scenario when no re-audit has been performed", () => {
    const baselineRow: RawAuditRow = {
      id: "audit-1",
      target_url: "https://old-site.com",
      completed_at: "2026-08-01T12:00:00Z",
      report_data: {
        summary: {
          overall_score: 42.4,
          seo_score: 50,
          mobile_score: 35,
          performance_score: 40,
        },
      },
    };

    const comp = computeComparison(baselineRow, null);
    assert.ok(comp);
    assert.equal(comp.baseline.overallScore, 42);
    assert.equal(comp.hasReAudit, false);
    assert.equal(comp.latest, null);
    assert.equal(comp.delta, null);
  });

  it("computes positive deltas correctly when re-audit improves scores", () => {
    const baselineRow: RawAuditRow = {
      id: "audit-1",
      target_url: "https://old-site.com",
      completed_at: "2026-08-01T12:00:00Z",
      report_data: {
        summary: {
          overall_score: 42,
          seo_score: 50,
          mobile_score: 35,
          performance_score: 40,
        },
      },
    };

    const latestRow: RawAuditRow = {
      id: "audit-2",
      target_url: "https://new-client.rankedceo.com",
      completed_at: "2026-08-15T12:00:00Z",
      report_data: {
        summary: {
          overall_score: 78.2,
          seo_score: 85,
          mobile_score: 70,
          performance_score: 80,
        },
      },
    };

    const comp = computeComparison(baselineRow, latestRow);
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
    const baselineRow: RawAuditRow = {
      id: "audit-1",
      target_url: "https://old-site.com",
      completed_at: "2026-08-01T12:00:00Z",
      report_data: {
        summary: {
          overall_score: 50,
        },
      },
    };

    const latestRow: RawAuditRow = {
      id: "audit-2",
      target_url: "https://new-client.rankedceo.com",
      completed_at: "2026-08-15T12:00:00Z",
      report_data: {
        summary: {
          overall_score: 70,
          seo_score: 80,
        },
      },
    };

    const comp = computeComparison(baselineRow, latestRow);
    assert.ok(comp);
    assert.equal(comp.delta?.overall, 20);
    assert.equal(comp.delta?.seo, null);
    assert.equal(comp.delta?.mobile, null);
    assert.equal(comp.delta?.performance, null);
  });
});
