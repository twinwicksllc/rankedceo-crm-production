// =============================================================================
// components/audit/claim-form-cta.tsx
//
// Premium conversion CTA with lead capture form.
// Appears on audit results page to convert prospects before they leave.
// Captures: name, email, phone, company
// On submission: Creates lead record + redirects to onboarding with context
//
// Key features:
// - Auto-populates from URL params or existing user data
// - Phone auto-formatting with validation
// - Success state with instant redirect to onboarding
// - Tracks conversion funnel events (viewed, attempted, succeeded)
// - Glassmorphism design matching audit page aesthetic
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingTheme } from "@/app/get-started/theme-context";
import {
  buildGetStartedUrl,
  getAuditFunnelProperties,
  getGetStartedBaseUrl,
} from "@/lib/analytics/audit-funnel";
import { trackEvent } from "@/lib/analytics/track-event";

interface ClaimFormCtaProps {
  auditId: string;
  targetDomain: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  userEmail?: string;
  userName?: string;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";
type ClaimChoice = "new_website" | "optimize_existing";

// ---------------------------------------------------------------------------
// Phone formatting helpers
// ---------------------------------------------------------------------------

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function formatPhoneDisplay(raw: string): string {
  if (raw.startsWith("+")) return raw;
  const digits = digitsOnly(raw);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function isValidPhone(value: string): boolean {
  if (!value.trim()) return false;
  if (value.startsWith("+")) {
    const digits = digitsOnly(value);
    return digits.length >= 7 && digits.length <= 15;
  }
  return digitsOnly(value).length === 10;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClaimFormCta({
  auditId,
  targetDomain,
  score,
  grade,
  userEmail,
  userName,
}: ClaimFormCtaProps) {
  const { theme } = useOnboardingTheme();
  const isLight = theme === "light";
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: userName ?? "",
    email: userEmail ?? "",
    phone: "",
    company: "",
  });

  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState("");
  const [cta, setCta] = useState("");
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<ClaimChoice | null>(null);
  const isUrgent = grade === "D" || grade === "F" || grade === "C";

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setCta(
      buildGetStartedUrl(getGetStartedBaseUrl(), searchParams, {
        tier: "standard",
        auditId,
      }),
    );
  }, [auditId]);

  const isFormValid =
    form.name.trim() &&
    form.email.trim() &&
    isValidPhone(form.phone) &&
    form.company.trim();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setForm((prev) => ({
      ...prev,
      phone: formatPhoneDisplay(raw),
    }));
  };

  const submitLead = async (choice: ClaimChoice) => {
    setPendingChoice(choice);
    if (choice === "new_website") {
      setStatus("submitting");
    }
    setError("");

    try {
      const searchParams = new URLSearchParams(window.location.search);

      // Log lead capture event
      trackEvent("audit_claim_form_submitted", {
        ...getAuditFunnelProperties(searchParams, auditId),
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        score,
        grade,
        selection: choice,
      });

      trackEvent("audit_claim_path_selected", {
        ...getAuditFunnelProperties(searchParams, auditId),
        score,
        grade,
        selection: choice,
      });

      if (choice === "optimize_existing") {
        router.push(
          `/audit/optimize-existing?auditId=${encodeURIComponent(auditId)}&targetDomain=${encodeURIComponent(targetDomain)}&name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phone)}&company=${encodeURIComponent(form.company)}`,
        );
        return;
      }

      // Call /api/audit/leads to capture the lead
      const res = await fetch("/api/audit/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: auditId,
          email: form.email,
          name: form.name,
          phone: form.phone,
          company: form.company,
          target_url: targetDomain, // API expects target_url
          optimization_requested: false,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to capture lead");
      }

      if (choice === "new_website") {
        setStatus("success");

        // Auto-redirect to onboarding after 1.5s
        setTimeout(() => {
          router.push(cta);
        }, 1500);
      }
    } catch (err) {
      setStatus("error");
      setError("Could not claim your spot. Please try again.");
      console.error("Claim form error:", err);
    } finally {
      setPendingChoice(null);
      setChoiceModalOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid) return;
    setChoiceModalOpen(true);
  };

  // ── Success state ──────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div
        style={{
          background: isLight
            ? "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(15,23,42,0.95) 100%)"
            : "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(0,0,0,0.6) 100%)",
          border: "1px solid rgba(34,197,94,0.4)",
          borderRadius: 16,
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 8px 40px rgba(34,197,94,0.15)",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>✅</div>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: "1.25rem",
            fontWeight: 800,
            color: isLight ? "#16a34a" : "#86efac",
          }}
        >
          Claim Confirmed!
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: isLight ? "#666" : "rgba(255,255,255,0.6)",
            lineHeight: 1.5,
          }}
        >
          Redirecting you to your personalized onboarding journey...
        </p>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: isLight
          ? "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(219,234,254,0.92) 100%)"
          : "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(15,15,20,0.95) 60%, rgba(239,68,68,0.08) 100%)",
        border: isLight
          ? "1px solid rgba(37,99,235,0.2)"
          : "1px solid rgba(37,99,235,0.35)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: isLight
          ? "0 8px 34px rgba(15,23,42,0.12)"
          : "0 8px 40px rgba(37,99,235,0.2), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Top urgency bar */}
      {isUrgent && (
        <div
          style={{
            padding: "10px 20px",
            background:
              "linear-gradient(90deg, rgba(239,68,68,0.8), rgba(220,38,38,0.6))",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          🚨 LIMITED SPOTS AVAILABLE — Claim yours now before onboarding closes
          for the month
        </div>
      )}

      <div style={{ padding: "28px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: "0.7rem",
              color: isLight ? "#0369a1" : "#06b6d4",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            🏆 CLAIM YOUR SPOT
          </div>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "clamp(1.1rem, 3vw, 1.4rem)",
              fontWeight: 800,
              color: isLight ? "#0f172a" : "#ffffff",
              lineHeight: 1.25,
            }}
          >
            Ready to Dominate Your Local Market?
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.88rem",
              color: isLight ? "#334155" : "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
            }}
          >
            Based on your audit score of{" "}
            <strong>
              {score}/100 ({grade})
            </strong>
            , you qualify for a personalized website build + SEO strategy. Claim
            your spot now.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {/* Name */}
            <input
              type="text"
              placeholder="Full Name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              style={{
                padding: "12px 16px",
                background: isLight ? "#ffffff" : "rgba(255,255,255,0.08)",
                border: isLight
                  ? "1px solid #e0e0e0"
                  : "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                fontSize: "0.9rem",
                color: isLight ? "#333" : "#ffffff",
                outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#2563EB";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = isLight
                  ? "#e0e0e0"
                  : "rgba(255,255,255,0.15)";
              }}
              disabled={status === "submitting"}
            />

            {/* Email */}
            <input
              type="email"
              placeholder="Work Email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              style={{
                padding: "12px 16px",
                background: isLight ? "#ffffff" : "rgba(255,255,255,0.08)",
                border: isLight
                  ? "1px solid #e0e0e0"
                  : "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                fontSize: "0.9rem",
                color: isLight ? "#333" : "#ffffff",
                outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#2563EB";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = isLight
                  ? "#e0e0e0"
                  : "rgba(255,255,255,0.15)";
              }}
              disabled={status === "submitting"}
            />

            {/* Phone */}
            <input
              type="tel"
              placeholder="Phone (555) 123-4567"
              value={form.phone}
              onChange={handlePhoneChange}
              style={{
                padding: "12px 16px",
                background: isLight ? "#ffffff" : "rgba(255,255,255,0.08)",
                border: isLight
                  ? "1px solid #e0e0e0"
                  : "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                fontSize: "0.9rem",
                color: isLight ? "#333" : "#ffffff",
                outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#2563EB";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = isLight
                  ? "#e0e0e0"
                  : "rgba(255,255,255,0.15)";
              }}
              disabled={status === "submitting"}
            />

            {/* Company */}
            <input
              type="text"
              placeholder="Company / Business Name"
              value={form.company}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, company: e.target.value }))
              }
              style={{
                padding: "12px 16px",
                background: isLight ? "#ffffff" : "rgba(255,255,255,0.08)",
                border: isLight
                  ? "1px solid #e0e0e0"
                  : "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                fontSize: "0.9rem",
                color: isLight ? "#333" : "#ffffff",
                outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#2563EB";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = isLight
                  ? "#e0e0e0"
                  : "rgba(255,255,255,0.15)";
              }}
              disabled={status === "submitting"}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 6,
                fontSize: "0.8rem",
                color: isLight ? "#991b1b" : "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isFormValid || status === "submitting"}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "14px 20px",
              background: isUrgent
                ? "linear-gradient(135deg, #dc2626, #991b1b)"
                : "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor:
                isFormValid && status !== "submitting"
                  ? "pointer"
                  : "not-allowed",
              opacity: isFormValid && status !== "submitting" ? 1 : 0.6,
              transition: "all 0.2s ease",
              boxShadow: isUrgent
                ? "0 4px 20px rgba(220,38,38,0.35)"
                : "0 4px 20px rgba(37,99,235,0.35)",
            }}
            onMouseEnter={(e) => {
              if (isFormValid && status !== "submitting") {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = isUrgent
                  ? "0 8px 30px rgba(220,38,38,0.45)"
                  : "0 8px 30px rgba(37,99,235,0.45)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = isUrgent
                ? "0 4px 20px rgba(220,38,38,0.35)"
                : "0 4px 20px rgba(37,99,235,0.35)";
            }}
          >
            {status === "submitting"
              ? "⏳ Claiming your spot..."
              : "🎯 Claim My Free Website Review"}
          </button>
        </form>

        {choiceModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose your next step"
            onClick={() => setChoiceModalOpen(false)}
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
                    Do you want a new website or to optimize your existing one?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setChoiceModalOpen(false)}
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
                  x
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
                  disabled={pendingChoice !== null}
                  onClick={() => {
                    void submitLead("new_website");
                  }}
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
                    opacity: pendingChoice ? 0.75 : 1,
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
                    Continue to onboarding and launch your new RankedCEO site.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={pendingChoice !== null}
                  onClick={() => {
                    void submitLead("optimize_existing");
                  }}
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
                    opacity: pendingChoice ? 0.75 : 1,
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
                    Send a direct optimization request to admins for your current site.
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trust signals */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            fontSize: "0.75rem",
            color: isLight ? "#475569" : "rgba(255,255,255,0.4)",
          }}
        >
          <div>✅ Free 30-min Strategy Call</div>
          <div style={{ opacity: 0.3 }}>|</div>
          <div>✅ No Credit Card Required</div>
          <div style={{ opacity: 0.3 }}>|</div>
          <div>✅ Personalized Recommendations</div>
        </div>
      </div>
    </div>
  );
}
