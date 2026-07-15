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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid) return;

    setStatus("submitting");
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
      });

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
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to capture lead");
      }

      setStatus("success");

      // Auto-redirect to onboarding after 1.5s
      setTimeout(() => {
        router.push(cta);
      }, 1500);
    } catch (err) {
      setStatus("error");
      setError("Could not claim your spot. Please try again.");
      console.error("Claim form error:", err);
    }
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
          ? "linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(15,23,42,0.95) 60%, rgba(239,68,68,0.05) 100%)"
          : "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(15,15,20,0.95) 60%, rgba(239,68,68,0.08) 100%)",
        border: isLight
          ? "1px solid rgba(37,99,235,0.3)"
          : "1px solid rgba(37,99,235,0.35)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: isLight
          ? "0 8px 40px rgba(37,99,235,0.12)"
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
              color: isLight ? "#666" : "rgba(255,255,255,0.6)",
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

        {/* Trust signals */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            fontSize: "0.75rem",
            color: isLight ? "#999" : "rgba(255,255,255,0.4)",
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
