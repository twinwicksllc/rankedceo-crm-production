"use client";

// =============================================================================
// Google Business Profile card (A3)
// Plain-language result of the GBP / NAP / review analysis. Hidden by the
// caller when the audit has no `gbp` (older reports, or the Maps lookup was off).
// =============================================================================

import { useOnboardingTheme } from "@/app/get-started/theme-context";
import type { GbpAnalysis } from "@/lib/waas/services/audit-engine/gbp-analysis";
import { gbpSummaryLines } from "@/lib/waas/services/audit-engine/gbp-summary";

interface GbpCardProps {
  gbp: GbpAnalysis;
}

function scoreColor(score: number | null): string {
  if (score === null) return "#94a3b8";
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function GbpCard({ gbp }: GbpCardProps) {
  const { theme } = useOnboardingTheme();
  const isLight = theme === "light";
  const lines = gbpSummaryLines(gbp);
  const score = gbp.score;

  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        flexWrap: "wrap",
        padding: "16px 18px",
        borderRadius: 12,
        background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
        border: isLight
          ? "1px solid rgba(15,23,42,0.14)"
          : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{ minWidth: 96, textAlign: "center" }}
        aria-label={
          score === null
            ? "Profile score not measured"
            : `Profile score ${score} out of 100`
        }
      >
        <div
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            lineHeight: 1,
            color: scoreColor(score),
          }}
        >
          {score === null ? "—" : score}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: isLight ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.5)",
          }}
        >
          {score === null ? "NOT MEASURED" : "PROFILE SCORE"}
        </div>
      </div>

      <ul
        style={{
          flex: 1,
          minWidth: 220,
          margin: 0,
          paddingLeft: 18,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: "0.9rem",
          color: isLight ? "#1e293b" : "rgba(255,255,255,0.88)",
        }}
      >
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
