"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildGetStartedUrl,
  getAuditFunnelProperties,
  getGetStartedBaseUrl,
} from "@/lib/analytics/audit-funnel";
import { trackEvent } from "@/lib/analytics/track-event";
import { useOnboardingTheme } from "@/app/get-started/theme-context";

type Grade = "A" | "B" | "C" | "D" | "F";

interface FixRankingsModalProps {
  auditId: string;
  score: number;
  grade: Grade;
  targetDomain?: string;
  triggerLabel: string;
  triggerStyle: React.CSSProperties;
  triggerClassName?: string;
  ctaName: string;
}

export function FixRankingsModal({
  auditId,
  score,
  grade,
  targetDomain,
  triggerLabel,
  triggerStyle,
  triggerClassName,
  ctaName,
}: FixRankingsModalProps) {
  const router = useRouter();
  const { theme } = useOnboardingTheme();
  const isLight = theme === "light";
  const [open, setOpen] = useState(false);
  const [getStartedUrl, setGetStartedUrl] = useState(
    `/get-started?tier=standard&auditId=${auditId}`,
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setGetStartedUrl(
      buildGetStartedUrl(getGetStartedBaseUrl(), searchParams, {
        tier: "standard",
        auditId,
      }),
    );
  }, [auditId]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  const trackOpen = () => {
    const searchParams = new URLSearchParams(window.location.search);
    trackEvent("audit_fix_rankings_modal_opened", {
      ...getAuditFunnelProperties(searchParams, auditId),
      cta: ctaName,
      score,
      grade,
      targetDomain,
    });
  };

  const chooseNewWebsite = () => {
    const searchParams = new URLSearchParams(window.location.search);
    trackEvent("audit_fix_rankings_path_selected", {
      ...getAuditFunnelProperties(searchParams, auditId),
      cta: ctaName,
      selection: "new_website",
      destination: getStartedUrl,
      score,
      grade,
      targetDomain,
    });
    router.push(getStartedUrl);
  };

  const chooseOptimizeExisting = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const optimizeUrl = `/audit/optimize-existing?auditId=${encodeURIComponent(auditId)}${
      targetDomain ? `&targetDomain=${encodeURIComponent(targetDomain)}` : ""
    }`;

    trackEvent("audit_fix_rankings_path_selected", {
      ...getAuditFunnelProperties(searchParams, auditId),
      cta: ctaName,
      selection: "optimize_existing_site",
      destination: optimizeUrl,
      score,
      grade,
      targetDomain,
    });
    router.push(optimizeUrl);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          trackOpen();
          setOpen(true);
        }}
        className={triggerClassName}
        style={triggerStyle}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose your next step"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: isLight ? "rgba(15,23,42,0.45)" : "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 100%)",
              borderRadius: 16,
              border: isLight
                ? "1px solid rgba(15,23,42,0.12)"
                : "1px solid rgba(255,255,255,0.14)",
              background: isLight
                ? "linear-gradient(160deg, #ffffff 0%, #eef4ff 100%)"
                : "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)",
              boxShadow: isLight
                ? "0 20px 60px rgba(15,23,42,0.25)"
                : "0 20px 60px rgba(2,6,23,0.6)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: isLight
                  ? "1px solid rgba(15,23,42,0.12)"
                  : "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                    color: isLight ? "#1d4ed8" : "#38bdf8",
                  }}
                >
                  Choose Your Path
                </div>
                <h3
                  style={{
                    margin: "6px 0 0",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: isLight ? "#0f172a" : "#ffffff",
                  }}
                >
                  How would you like to improve your rankings?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  color: isLight ? "#0f172a" : "#ffffff",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 20,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 14,
              }}
            >
              <button
                type="button"
                onClick={chooseNewWebsite}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: isLight
                    ? "1px solid rgba(37,99,235,0.25)"
                    : "1px solid rgba(56,189,248,0.28)",
                  background: isLight
                    ? "rgba(37,99,235,0.06)"
                    : "rgba(56,189,248,0.1)",
                  padding: "16px 14px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    color: isLight ? "#1d4ed8" : "#38bdf8",
                    marginBottom: 8,
                  }}
                >
                  1) Build Me a New Website
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: isLight ? "#334155" : "rgba(255,255,255,0.8)",
                    lineHeight: 1.5,
                  }}
                >
                  Start the full RankedCEO onboarding flow and launch your new
                  high-converting website + SEO foundation.
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: isLight ? "#0f172a" : "#ffffff",
                  }}
                >
                  Continue to Get Started →
                </div>
              </button>

              <button
                type="button"
                onClick={chooseOptimizeExisting}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: isLight
                    ? "1px solid rgba(245,158,11,0.3)"
                    : "1px solid rgba(245,158,11,0.35)",
                  background: isLight
                    ? "rgba(245,158,11,0.08)"
                    : "rgba(245,158,11,0.12)",
                  padding: "16px 14px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    color: isLight ? "#b45309" : "#fbbf24",
                    marginBottom: 8,
                  }}
                >
                  2) Optimize My Existing Site
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: isLight ? "#334155" : "rgba(255,255,255,0.8)",
                    lineHeight: 1.5,
                  }}
                >
                  Send a request to RankedCEO admins to improve your current
                  website without migrating platforms.
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: isLight ? "#0f172a" : "#ffffff",
                  }}
                >
                  Request optimization review →
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
