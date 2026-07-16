"use client";

// =============================================================================
// Local Pack Panel
// Shows Google Maps "3-pack" visibility for the target + competitors
// =============================================================================

import { useOnboardingTheme } from "@/app/get-started/theme-context";

interface LocalPackPlace {
  position: number;
  title: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
}

interface LocalPackCompetitor {
  url: string;
  domain: string;
  position: number | null;
  title: string | null;
}

interface LocalPackData {
  keyword: string;
  location: string;
  places: LocalPackPlace[];
  target: { position: number | null; title: string | null };
  competitors: LocalPackCompetitor[];
}

interface LocalPackPanelProps {
  localPack: LocalPackData;
  targetDomain: string;
}

export function LocalPackPanel({ localPack, targetDomain }: LocalPackPanelProps) {
  const { theme } = useOnboardingTheme();
  const isLight = theme === "light";
  const inPack = localPack.target.position !== null;

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          padding: "10px 16px",
          background: isLight
            ? "rgba(15,23,42,0.04)"
            : "rgba(255,255,255,0.04)",
          borderRadius: 8,
          border: isLight
            ? "1px solid rgba(15,23,42,0.14)"
            : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.82rem",
            color: isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.5)",
          }}
        >
          Google Maps "3-pack" for
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: isLight ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.9)",
          }}
        >
          "{localPack.keyword}" · {localPack.location}
        </p>
      </div>

      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: inPack
            ? "rgba(34,197,94,0.10)"
            : "rgba(239,68,68,0.10)",
          border: inPack
            ? "1px solid rgba(34,197,94,0.3)"
            : "1px solid rgba(239,68,68,0.3)",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.82rem",
            fontWeight: 600,
            color: inPack ? "#16A34A" : "#EF4444",
          }}
        >
          {inPack
            ? `${targetDomain} appears in the Local Pack at position #${localPack.target.position}`
            : `${targetDomain} does not currently appear in the Google Maps Local Pack for this search`}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {localPack.places.map((place, i) => {
          const isTarget = place.title === localPack.target.title && inPack;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: isTarget
                  ? "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))"
                  : isLight
                    ? "rgba(15,23,42,0.03)"
                    : "rgba(255,255,255,0.03)",
                border: isTarget
                  ? "1px solid rgba(239,68,68,0.3)"
                  : isLight
                    ? "1px solid rgba(15,23,42,0.08)"
                    : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: isTarget ? "#EF4444" : "#94A3B8",
                  minWidth: 24,
                }}
              >
                #{place.position}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: isTarget ? 700 : 600,
                    color: isLight
                      ? "rgba(15,23,42,0.9)"
                      : "rgba(255,255,255,0.9)",
                  }}
                >
                  {place.title}
                  {isTarget && " ← Your Site"}
                </div>
                {place.address && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: isLight
                        ? "rgba(15,23,42,0.55)"
                        : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {place.address}
                  </div>
                )}
              </div>
              {place.rating != null && (
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "#F59E0B",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⭐ {place.rating}
                  {place.ratingCount != null && ` (${place.ratingCount})`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {localPack.places.length === 0 && (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: isLight ? "rgba(15,23,42,0.58)" : "rgba(255,255,255,0.48)",
            fontSize: "0.85rem",
          }}
        >
          No Google Maps Local Pack results found for this search.
        </div>
      )}
    </div>
  );
}
