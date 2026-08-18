import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getWaasAdminClient } from "@/lib/waas/supabase";
import { createClient } from "@/lib/supabase/server";
import type { AuditReportData, WaasAudit } from "@/lib/waas/types";

interface RequestContext {
  params: Promise<{ auditId: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomain(url: string | null | undefined): string {
  if (!url) return "unknown-domain";
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function calculateScore(summary: any): number {
  if (!summary) return 0;
  return Math.round(
    summary.performance_score * 0.4 +
      summary.seo_score * 0.3 +
      summary.mobile_score * 0.2 +
      summary.accessibility_score * 0.1,
  );
}

function getGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#16a34a";
    case "B":
      return "#2563eb";
    case "C":
      return "#d97706";
    case "D":
      return "#ea580c";
    default:
      return "#dc2626";
  }
}

function scoreBar(value: number, max = 100, width = 20): string {
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// PDF builder helpers (operate on the doc instance)
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 612;
const MARGIN = 40;
const CONTENT_W = PAGE_WIDTH - MARGIN * 2;

// Draw a horizontal rule
function hr(doc: any, y?: number): void {
  const yPos = y ?? (doc as any).y;
  doc.moveTo(MARGIN, yPos).lineTo(PAGE_WIDTH - MARGIN, yPos);
  (doc as any).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
}

// Section header: colored left bar + bold title
function sectionHeader(doc: any, title: string, emoji: string): void {
  const y = (doc as any).y + 6;
  doc.rect(MARGIN, y, 3, 16).fillColor("#2563eb").fill();
  doc
    .fillColor("#0f172a")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`${emoji}  ${title}`, MARGIN + 10, y + 1, { width: CONTENT_W - 10 });
  doc.moveDown(0.5);
}

// Key-value row
function kvRow(
  doc: any,
  label: string,
  value: string,
  labelColor = "#64748b",
  valueColor = "#0f172a",
): void {
  const y = (doc as any).y;
  doc
    .fillColor(labelColor)
    .fontSize(9)
    .font("Helvetica")
    .text(label, MARGIN, y, { width: 130, continued: false });
  doc
    .fillColor(valueColor)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(value, MARGIN + 135, y, { width: CONTENT_W - 135 });
  doc.moveDown(0.25);
}

// ---------------------------------------------------------------------------
// GET /api/audit/[auditId]/pdf
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RequestContext) {
  try {
    const { auditId } = await context.params;

    // Fetch audit — use service-role client so RLS does not block server-side reads
    const waasAdmin = getWaasAdminClient();
    const { data: audit, error } = (await waasAdmin
      .from("audits")
      .select("*")
      .eq("id", auditId)
      .single()) as { data: WaasAudit | null; error: any };

    if (error || !audit) {
      console.error("PDF: audit fetch failed", { auditId, error });
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    // Ownership check — if tied to a tenant, verify user owns it
    if (audit.tenant_id) {
      const authClient = await createClient();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: tenant } = await waasAdmin
        .from("tenants")
        .select("id")
        .eq("id", audit.tenant_id)
        .eq("submitted_by_email", user.email)
        .single();

      if (!tenant) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    const report = (audit as any).report_data as AuditReportData | null;
    if (!report) {
      console.error("PDF: no report_data", { auditId });
      return NextResponse.json({ error: "No report data" }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // Build PDF
    // -------------------------------------------------------------------------
    const doc = new PDFDocument({ size: "letter", margin: MARGIN });
    const bufferPromise = streamToBuffer(doc);

    const targetDomain = extractDomain(audit.target_url);
    const score = calculateScore(report.summary);
    const grade = getGrade(score);
    const gColor = gradeColor(grade);
    const summary = report.summary;
    const keywords = Array.isArray((report as any).keywords_used)
      ? ((report as any).keywords_used as string[])
      : [];
    const leaderboard = Array.isArray((report as any).leaderboard)
      ? ((report as any).leaderboard as any[])
      : [];
    const gapAnalysis = (report as any).gap_analysis as
      | { nationalCompetitorNote?: string }
      | undefined;
    const localPack = (report as any).local_pack as
      | {
          keyword: string;
          places: Array<{
            position: number;
            title: string;
            address?: string;
            rating?: number;
            ratingCount?: number;
          }>;
          target: { position: number | null; title: string | null };
        }
      | null
      | undefined;
    const opportunities = report.opportunities ?? [];
    const techIssues = report.technical_issues ?? [];
    const completedDate = audit.completed_at
      ? new Date(audit.completed_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "N/A";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL_PROD ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://crm.rankedceo.com";
    const reportUrl = `${baseUrl}/audit/${auditId}`;
    const shortId = auditId.slice(0, 8).toUpperCase();

    // ==========================================================================
    // SECTION 1 — HEADER BANNER
    // ==========================================================================
    doc.rect(0, 0, PAGE_WIDTH, 78).fillColor("#0f172a").fill();

    // Branding
    doc
      .fillColor("#ffffff")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Ranked", 40, 16, { continued: true });
    doc.fillColor("#3b82f6").text("CEO", { continued: false });

    doc
      .fillColor("rgba(255,255,255,0.5)")
      .fontSize(8)
      .font("Helvetica")
      .text("SURFACE AUDIT ENGINE v2", 40, 38, { width: 200 });

    // Domain & date (right-aligned)
    doc
      .fillColor("#cbd5e1")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(targetDomain, PAGE_WIDTH - 240, 16, { width: 200, align: "right" });
    doc
      .fillColor("rgba(255,255,255,0.45)")
      .fontSize(8)
      .font("Helvetica")
      .text(completedDate, PAGE_WIDTH - 240, 34, {
        width: 200,
        align: "right",
      });
    doc
      .fillColor("rgba(255,255,255,0.3)")
      .fontSize(7)
      .font("Helvetica")
      .text(`ID: ${shortId}`, PAGE_WIDTH - 240, 48, {
        width: 200,
        align: "right",
      });

    // Move below header
    (doc as any).y = 90;

    // ==========================================================================
    // SECTION 2 — SCORE CARD
    // ==========================================================================
    const scoreCardY = (doc as any).y;

    // Score card background
    doc.rect(MARGIN, scoreCardY, CONTENT_W, 80).fillColor("#f8fafc").fill();

    // Grade circle (drawn as filled circle approximation via rect + text)
    const circleX = MARGIN + 20;
    const circleY = scoreCardY + 12;
    doc.rect(circleX, circleY, 56, 56).fillColor(gColor).fill();
    doc
      .fillColor("#ffffff")
      .fontSize(30)
      .font("Helvetica-Bold")
      .text(grade, circleX, circleY + 10, { width: 56, align: "center" });

    // Score number
    doc
      .fillColor("#0f172a")
      .fontSize(36)
      .font("Helvetica-Bold")
      .text(`${score}`, circleX + 70, scoreCardY + 8, {
        width: 80,
        continued: true,
      });
    doc
      .fillColor("#94a3b8")
      .fontSize(14)
      .font("Helvetica")
      .text("/100", { continued: false });

    // Score label
    const scoreLabel =
      score >= 80
        ? "Ahead of most competitors"
        : score >= 65
          ? "Good — improvements available"
          : score >= 50
            ? "Average — opportunities to capture"
            : score >= 35
              ? "Below average — competitors likely outranking"
              : "Critical — significant organic traffic being lost";
    doc
      .fillColor(gColor)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(scoreLabel, circleX + 70, scoreCardY + 50, {
        width: CONTENT_W - 100,
      });

    (doc as any).y = scoreCardY + 88;
    doc.moveDown(0.5);

    // ==========================================================================
    // SECTION 3 — SCORE BREAKDOWN
    // ==========================================================================
    if (summary) {
      sectionHeader(doc, "Score Breakdown", "📊");

      const metrics = [
        {
          label: "Performance (40%)",
          value: Math.round(summary.performance_score),
        },
        { label: "SEO (30%)", value: Math.round(summary.seo_score) },
        { label: "Mobile (20%)", value: Math.round(summary.mobile_score) },
        {
          label: "Accessibility (10%)",
          value: Math.round(summary.accessibility_score),
        },
      ];

      metrics.forEach((m) => {
        const barColor =
          m.value >= 70 ? "#16a34a" : m.value >= 50 ? "#d97706" : "#dc2626";
        kvRow(
          doc,
          m.label,
          `${scoreBar(m.value, 100, 18)}  ${m.value}/100`,
          "#64748b",
          barColor,
        );
      });

      doc.moveDown(0.75);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 4 — KEYWORD LEADERBOARD
    // ==========================================================================
    if (leaderboard.length > 0) {
      sectionHeader(doc, "Google Ranking Leaderboard", "🏆");

      const primaryKw = keywords[0] ?? "primary keyword";
      doc
        .fillColor("#64748b")
        .fontSize(8)
        .font("Helvetica")
        .text(`Rankings for: "${primaryKw}"`, MARGIN, (doc as any).y, {
          width: CONTENT_W,
        });
      doc.moveDown(0.4);

      leaderboard.slice(0, 8).forEach((entry: any, i: number) => {
        const isTarget = entry.isTarget === true;
        const rowY = (doc as any).y;

        if (isTarget) {
          doc
            .rect(MARGIN, rowY - 1, CONTENT_W, 16)
            .fillColor("#eff6ff")
            .fill();
        }

        const rankLabel = isTarget ? "★" : `#${entry.rank ?? i + 1}`;
        const domLabel = entry.domain ?? entry.url ?? "—";
        const pos =
          entry.bestPosition != null
            ? `Position ${entry.bestPosition}`
            : "Not ranked";

        doc
          .fillColor(isTarget ? "#1d4ed8" : "#94a3b8")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(rankLabel, MARGIN + 2, rowY, { width: 30 });

        doc
          .fillColor(isTarget ? "#0f172a" : "#334155")
          .fontSize(9)
          .font(isTarget ? "Helvetica-Bold" : "Helvetica")
          .text(
            isTarget ? `${domLabel}  ← Your Site` : domLabel,
            MARGIN + 36,
            rowY,
            { width: CONTENT_W - 130 },
          );

        doc
          .fillColor(isTarget ? "#2563eb" : "#64748b")
          .fontSize(8)
          .font("Helvetica")
          .text(pos, PAGE_WIDTH - MARGIN - 90, rowY, {
            width: 90,
            align: "right",
          });

        doc.moveDown(0.45);
      });

      if (gapAnalysis?.nationalCompetitorNote) {
        doc.moveDown(0.25);
        doc
          .fillColor("#d97706")
          .fontSize(8)
          .font("Helvetica")
          .text(`🌍  ${gapAnalysis.nationalCompetitorNote}`, MARGIN, (doc as any).y, {
            width: CONTENT_W,
          });
        doc.moveDown(0.4);
      }

      doc.moveDown(0.5);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 4b — GOOGLE MAPS LOCAL PACK
    // ==========================================================================
    if (localPack && localPack.places.length > 0) {
      sectionHeader(doc, "Google Maps Visibility", "📍");

      const inPack = localPack.target.position !== null;
      doc
        .fillColor(inPack ? "#16a34a" : "#dc2626")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(
          inPack
            ? `${targetDomain} appears in the Local Pack at position #${localPack.target.position}`
            : `${targetDomain} does not currently appear in the Google Maps Local Pack for "${localPack.keyword}"`,
          MARGIN,
          (doc as any).y,
          { width: CONTENT_W },
        );
      doc.moveDown(0.4);

      localPack.places.slice(0, 5).forEach((place) => {
        const rowY = (doc as any).y;
        const isTarget = place.title === localPack.target.title && inPack;
        doc
          .fillColor(isTarget ? "#1d4ed8" : "#94a3b8")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(`#${place.position}`, MARGIN + 2, rowY, { width: 30 });
        doc
          .fillColor(isTarget ? "#0f172a" : "#334155")
          .fontSize(9)
          .font(isTarget ? "Helvetica-Bold" : "Helvetica")
          .text(
            isTarget ? `${place.title}  ← Your Site` : place.title,
            MARGIN + 36,
            rowY,
            { width: CONTENT_W - 130 },
          );
        if (place.rating != null) {
          doc
            .fillColor("#d97706")
            .fontSize(8)
            .font("Helvetica")
            .text(`★ ${place.rating}`, PAGE_WIDTH - MARGIN - 60, rowY, {
              width: 60,
              align: "right",
            });
        }
        doc.moveDown(0.45);
      });

      doc.moveDown(0.5);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 5 — KEYWORDS EVALUATED
    // ==========================================================================
    if (keywords.length > 0) {
      sectionHeader(doc, "Keywords Evaluated", "🧩");
      doc
        .fillColor("#334155")
        .fontSize(9)
        .font("Helvetica")
        .text(keywords.slice(0, 8).join("  ·  "), MARGIN, (doc as any).y, {
          width: CONTENT_W,
        });
      doc.moveDown(1);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 6 — KEYWORD PERFORMANCE
    // ==========================================================================
    if (
      summary &&
      (summary.top_search_result || summary.bottom_search_result)
    ) {
      sectionHeader(doc, "Keyword Performance", "🔎");

      if (summary.top_search_result) {
        kvRow(
          doc,
          "Best Ranking Keyword",
          `"${summary.top_search_result.keyword}"  —  Position ${summary.top_search_result.position ?? "N/A"}`,
          "#64748b",
          "#16a34a",
        );
      }
      if (summary.bottom_search_result) {
        kvRow(
          doc,
          "Weakest Keyword",
          `"${summary.bottom_search_result.keyword}"  —  Position ${summary.bottom_search_result.position ?? "N/A"}`,
          "#64748b",
          "#dc2626",
        );
      }
      if (summary.mean_position != null) {
        kvRow(
          doc,
          "Average Position",
          `${Math.round(summary.mean_position)} (across ${summary.measured_keywords ?? 0} keywords)`,
          "#64748b",
          "#0f172a",
        );
      }

      doc.moveDown(0.5);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 7 — PAGE SPEED
    // ==========================================================================
    const pageSpeedFull = (report as any).page_speed_full;
    const pageSpeed = pageSpeedFull ?? (report as any).page_speed;

    if (pageSpeed) {
      sectionHeader(doc, "Page Speed", "⚡");

      const mobile = pageSpeedFull?.mobile ?? pageSpeed?.mobile;
      const desktop = pageSpeedFull?.desktop ?? pageSpeed?.desktop;

      if (mobile) {
        kvRow(
          doc,
          "Mobile LCP",
          mobile.lcp != null ? formatMs(mobile.lcp) : "N/A",
        );
        kvRow(
          doc,
          "Mobile CLS",
          mobile.cls != null ? String(mobile.cls) : "N/A",
        );
        if (pageSpeedFull?.mobile?.categoryScores?.performance?.score != null) {
          kvRow(
            doc,
            "Mobile Performance",
            `${Math.round(pageSpeedFull.mobile.categoryScores.performance.score)}/100`,
          );
        }
      }
      if (desktop) {
        kvRow(
          doc,
          "Desktop LCP",
          desktop.lcp != null ? formatMs(desktop.lcp) : "N/A",
        );
        kvRow(
          doc,
          "Desktop CLS",
          desktop.cls != null ? String(desktop.cls) : "N/A",
        );
      }

      doc.moveDown(0.5);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 8 — OPPORTUNITIES
    // ==========================================================================
    if (opportunities.length > 0) {
      sectionHeader(doc, "Top Opportunities", "💡");

      opportunities.slice(0, 8).forEach((opp: any, i: number) => {
        const title = opp.title ?? opp.description ?? String(opp);
        const impact = opp.impact ?? opp.priority ?? "";
        const impColor =
          impact === "critical" || impact === "high"
            ? "#dc2626"
            : impact === "warning" || impact === "medium"
              ? "#d97706"
              : "#2563eb";

        const rowY = (doc as any).y;
        doc
          .fillColor("#94a3b8")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(`${i + 1}.`, MARGIN, rowY, { width: 18 });
        doc
          .fillColor("#0f172a")
          .fontSize(9)
          .font("Helvetica")
          .text(title, MARGIN + 22, rowY, { width: CONTENT_W - 80 });
        if (impact) {
          doc
            .fillColor(impColor)
            .fontSize(7)
            .font("Helvetica-Bold")
            .text(
              String(impact).toUpperCase(),
              PAGE_WIDTH - MARGIN - 55,
              rowY,
              { width: 55, align: "right" },
            );
        }
        doc.moveDown(0.35);
      });

      doc.moveDown(0.5);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 9 — TECHNICAL ISSUES
    // ==========================================================================
    if (techIssues.length > 0) {
      sectionHeader(doc, "Technical Issues", "🔧");

      techIssues.slice(0, 6).forEach((issue: any) => {
        const desc = issue.description ?? issue.title ?? String(issue);
        const severity = issue.severity ?? issue.impact ?? "";
        const sevColor =
          severity === "critical" || severity === "high"
            ? "#dc2626"
            : "#d97706";

        kvRow(
          doc,
          severity ? String(severity).toUpperCase() : "•",
          desc.slice(0, 90),
          sevColor,
          "#334155",
        );
      });

      doc.moveDown(0.5);
      hr(doc);
      doc.moveDown(0.75);
    }

    // ==========================================================================
    // SECTION 10 — FOOTER
    // ==========================================================================
    doc.moveDown(0.5);

    // CTA box
    const ctaY = (doc as any).y;
    doc.rect(MARGIN, ctaY, CONTENT_W, 52).fillColor("#eff6ff").fill();
    doc
      .fillColor("#1d4ed8")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("View your interactive report online:", MARGIN + 12, ctaY + 8, {
        width: CONTENT_W - 24,
      });
    doc
      .fillColor("#2563eb")
      .fontSize(9)
      .font("Helvetica")
      .text(reportUrl, MARGIN + 12, ctaY + 24, { width: CONTENT_W - 24 });
    doc
      .fillColor("#64748b")
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Log in or create a free account to access the full interactive dashboard.",
        MARGIN + 12,
        ctaY + 38,
        { width: CONTENT_W - 24 },
      );

    (doc as any).y = ctaY + 60;
    doc.moveDown(0.5);

    doc
      .fillColor("#94a3b8")
      .fontSize(7.5)
      .font("Helvetica")
      .text(
        `© ${new Date().getFullYear()} RankedCEO · Twin-Wicks Digital Solutions · Report ID: ${shortId}`,
        MARGIN,
        (doc as any).y,
        { align: "center", width: CONTENT_W },
      );

    // Finalize and collect buffer
    doc.end();
    const buffer = await bufferPromise;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rankedceo-audit-${targetDomain}-${new Date().toISOString().split("T")[0]}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
