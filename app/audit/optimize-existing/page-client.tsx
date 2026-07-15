"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOnboardingTheme } from "@/app/get-started/theme-context";

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export function OptimizeExistingSiteClient() {
  const searchParams = useSearchParams();
  const { theme } = useOnboardingTheme();
  const isLight = theme === "light";

  const auditId = searchParams.get("auditId") ?? "";
  const targetDomain = searchParams.get("targetDomain") ?? "your-site";
  const prefillName = searchParams.get("name") ?? "";
  const prefillEmail = searchParams.get("email") ?? "";
  const prefillPhone = searchParams.get("phone") ?? "";
  const prefillCompany = searchParams.get("company") ?? "";

  const [form, setForm] = useState<FormState>({
    name: prefillName,
    email: prefillEmail,
    phone: prefillPhone,
    company: prefillCompany,
    notes: "",
  });
  const [status, setStatus] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return (
      Boolean(auditId) &&
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.phone.trim().length > 0 &&
      form.company.trim().length > 0
    );
  }, [auditId, form]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("submitting");
    setError("");

    try {
      const res = await fetch("/api/audit/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: auditId,
          email: form.email,
          name: form.name,
          phone: form.phone,
          company: form.company,
          target_url: targetDomain,
          optimization_requested: true,
          referrer_url:
            typeof window !== "undefined" ? window.location.href : null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit optimization request");
      }

      setStatus("success");
    } catch (err) {
      console.error("Optimize existing site lead capture error:", err);
      setStatus("error");
      setError("Could not submit your request. Please try again.");
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 16px",
        background: isLight
          ? "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)"
          : "linear-gradient(180deg, #020617 0%, #111827 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          borderRadius: 16,
          border: isLight
            ? "1px solid rgba(15,23,42,0.12)"
            : "1px solid rgba(255,255,255,0.12)",
          background: isLight
            ? "rgba(255,255,255,0.92)"
            : "rgba(15,23,42,0.84)",
          padding: 24,
          boxShadow: isLight
            ? "0 16px 45px rgba(15,23,42,0.13)"
            : "0 16px 45px rgba(2,6,23,0.5)",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 700,
            color: isLight ? "#1d4ed8" : "#38bdf8",
            marginBottom: 8,
          }}
        >
          Optimize Existing Site Request
        </div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
            fontWeight: 800,
            color: isLight ? "#0f172a" : "#ffffff",
          }}
        >
          Request RankedCEO to fix your current site
        </h1>
        <p
          style={{
            margin: "0 0 22px",
            color: isLight ? "#475569" : "rgba(255,255,255,0.8)",
            lineHeight: 1.55,
            fontSize: "0.95rem",
          }}
        >
          We will review your audit and contact you with a focused optimization
          plan for {targetDomain}. This request goes directly to our admin team.
        </p>

        {status === "success" ? (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.1)",
              padding: 16,
              color: isLight ? "#166534" : "#86efac",
              fontWeight: 600,
            }}
          >
            Your optimization request was sent successfully. A strategist will
            reach out shortly.
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                style={inputStyle(isLight)}
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                style={inputStyle(isLight)}
              />
              <input
                type="text"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                style={inputStyle(isLight)}
              />
              <input
                type="text"
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                style={inputStyle(isLight)}
              />
            </div>

            <textarea
              placeholder="Any specific issues you want fixed? (optional)"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={4}
              style={{
                ...inputStyle(isLight),
                width: "100%",
                marginTop: 12,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            {error && (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.1)",
                  color: isLight ? "#991b1b" : "#fecaca",
                  padding: 10,
                  fontSize: "0.9rem",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || status === "submitting"}
              style={{
                marginTop: 14,
                width: "100%",
                border: "none",
                borderRadius: 10,
                padding: "13px 14px",
                fontWeight: 800,
                color: "#ffffff",
                background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: canSubmit ? 1 : 0.55,
              }}
            >
              {status === "submitting"
                ? "Sending request..."
                : "Request Optimization Review"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function inputStyle(isLight: boolean): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 10,
    border: isLight
      ? "1px solid rgba(15,23,42,0.16)"
      : "1px solid rgba(255,255,255,0.22)",
    background: isLight ? "#ffffff" : "rgba(15,23,42,0.75)",
    color: isLight ? "#0f172a" : "#ffffff",
    padding: "11px 12px",
    fontSize: "0.92rem",
    outline: "none",
  };
}
