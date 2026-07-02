"use client";

// =============================================================================
// Email Capture Form
// Gates the PDF download — captures lead before allowing download
// Calls /api/audit/leads, then triggers PDF generation/download
//
// All four fields (name, email, phone, company) are ALWAYS required.
// Phone is auto-formatted to (555) 123-4567 as the user types, and
// validated to ensure it contains at least 10 digits before submission.
// =============================================================================

import { useState } from "react";
import { useOnboardingTheme } from "@/app/get-started/theme-context";

interface EmailCaptureFormProps {
  auditId: string;
  targetDomain: string;
  userEmail?: string;
  userName?: string;
  onCaptured?: (email: string) => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------

/**
 * Strips everything except digits (and a leading +).
 * Used to count raw digits for validation.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Auto-formats a phone string as the user types.
 * Supports US numbers: (555) 123-4567
 * International numbers starting with + are kept as-is (no reformatting).
 *
 * Examples:
 *   '5551234567'   → '(555) 123-4567'
 *   '555123'       → '(555) 123'
 *   '55'           → '(55'
 *   '+442071234567'→ '+442071234567'  (international — left alone)
 */
function formatPhoneDisplay(raw: string): string {
  // International numbers — don't reformat
  if (raw.startsWith("+")) return raw;

  const digits = digitsOnly(raw);

  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;

  // More than 10 digits — keep first 10 formatted, drop extras
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Returns true if the phone value has enough digits to be valid.
 * Accepts US (10 digits) or international (7–15 digits with leading +).
 */
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

export function EmailCaptureForm({
  auditId,
  targetDomain,
  userEmail,
  userName,
  onCaptured,
}: EmailCaptureFormProps) {
  const { theme } = useOnboardingTheme();
  const isLight = theme === "light";

  const [form, setForm] = useState<FormState>({
    name: userName ?? "",
    email: userEmail ?? "",
    phone: "",
    company: "",
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Generic field updater
  function update(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Phone-specific updater — auto-formats as the user types
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhoneDisplay(e.target.value);
    setForm((f) => ({ ...f, phone: formatted }));
    // Clear inline error while the user is still editing
    if (phoneError) setPhoneError(null);
  }

  // Phone blur — show inline error if not yet valid
  function handlePhoneBlur() {
    if (form.phone && !isValidPhone(form.phone)) {
      setPhoneError(
        "Please enter a valid 10-digit phone number, e.g. (555) 123-4567",
      );
    } else {
      setPhoneError(null);
    }
  }

  const phoneIsValid = isValidPhone(form.phone);
  const isDisabled =
    status === "submitting" || !form.email || !phoneIsValid || !form.company;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Final client-side guard
    if (!form.email || !phoneIsValid || !form.company) {
      if (!phoneIsValid) {
        setPhoneError(
          "Please enter a valid 10-digit phone number, e.g. (555) 123-4567",
        );
      }
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const res = await fetch("/api/audit/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: auditId,
          name: form.name,
          email: form.email,
          phone: form.phone, // already formatted by formatPhoneDisplay
          company: form.company,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      setStatus("success");
      onCaptured?.(form.email);

      setTimeout(() => {
        window.open(`/api/audit/${auditId}/pdf`, "_blank");
      }, 800);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div
        style={{
          background: isLight
            ? "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(15,23,42,0.04))"
            : "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(0,0,0,0.3))",
          border: isLight
            ? "1px solid rgba(34,197,94,0.4)"
            : "1px solid rgba(34,197,94,0.35)",
          borderRadius: 14,
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>✅</div>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#22C55E",
            marginBottom: 6,
          }}
        >
          Download Starting…
        </div>
        <div
          style={{
            fontSize: "0.82rem",
            color: isLight ? "rgba(15,23,42,0.68)" : "rgba(255,255,255,0.55)",
            marginBottom: 16,
          }}
        >
          Your PDF report is being prepared. Check your downloads folder.
        </div>
        <a
          href={`/api/audit/${auditId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "rgba(34,197,94,0.2)",
            border: "1px solid rgba(34,197,94,0.4)",
            color: "#22C55E",
            textDecoration: "none",
            borderRadius: 8,
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          📄 Download PDF Report
        </a>
      </div>
    );
  }

  // ── Collapsed trigger ──────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "14px 20px",
          background: isLight
            ? "linear-gradient(135deg, rgba(37,99,235,0.24), rgba(15,23,42,0.08))"
            : "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(0,0,0,0.3))",
          border: isLight
            ? "1px solid rgba(37,99,235,0.5)"
            : "1px solid rgba(37,99,235,0.4)",
          borderRadius: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.3rem" }}>📄</span>
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: isLight ? "#0f172a" : "#ffffff",
                marginBottom: 2,
              }}
            >
              Download Full PDF Report
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: isLight
                  ? "rgba(15,23,42,0.68)"
                  : "rgba(255,255,255,0.45)",
              }}
            >
              Board-ready audit for {targetDomain} — shareable with your team
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "6px 14px",
            background: isLight
              ? "rgba(37,99,235,0.35)"
              : "rgba(37,99,235,0.4)",
            borderRadius: 7,
            fontSize: "0.78rem",
            fontWeight: 600,
            color: isLight ? "#0f172a" : "#93C5FD",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Get PDF →
        </div>
      </button>
    );
  }

  // ── Expanded form ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: isLight
          ? "linear-gradient(135deg, rgba(37,99,235,0.16), rgba(15,23,42,0.06))"
          : "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(0,0,0,0.4))",
        border: isLight
          ? "1px solid rgba(37,99,235,0.45)"
          : "1px solid rgba(37,99,235,0.35)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 14px",
          borderBottom: isLight
            ? "1px solid rgba(15,23,42,0.12)"
            : "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>📄</span>
          <div>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: isLight ? "#0f172a" : "#ffffff",
              }}
            >
              Download Your PDF Report
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: isLight
                  ? "rgba(15,23,42,0.65)"
                  : "rgba(255,255,255,0.4)",
              }}
            >
              Free — no credit card required
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "none",
            border: "none",
            color: isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.35)",
            cursor: "pointer",
            fontSize: "1rem",
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: "18px 20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          {/* Name — pre-filled & locked for logged-in users */}
          <FormField
            label="Full Name *"
            type="text"
            placeholder="John Smith"
            value={form.name}
            onChange={update("name")}
            required
            disabled={!!userName}
            hint={userName ? "(from your account)" : undefined}
          />

          {/* Email — pre-filled & locked for logged-in users */}
          <FormField
            label="Email Address *"
            type="email"
            placeholder="john@acmeplumbing.com"
            value={form.email}
            onChange={update("email")}
            required
            disabled={!!userEmail}
            hint={userEmail ? "(from your account)" : undefined}
          />

          {/* Phone — always required, auto-formatted */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: 600,
                color: phoneError ? "#FCA5A5" : "rgba(255,255,255,0.5)",
                marginBottom: 5,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Phone *
            </label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="(555) 123-4567"
              value={form.phone}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              required
              maxLength={16}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "rgba(255,255,255,0.06)",
                border: phoneError
                  ? "1px solid rgba(239,68,68,0.6)"
                  : "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#ffffff",
                fontSize: "0.85rem",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = phoneError
                  ? "rgba(239,68,68,0.8)"
                  : "rgba(96,165,250,0.6)";
              }}
              onBlurCapture={(e) => {
                e.target.style.borderColor = phoneError
                  ? "rgba(239,68,68,0.6)"
                  : "rgba(255,255,255,0.12)";
              }}
            />
            {phoneError && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.68rem",
                  color: "#FCA5A5",
                }}
              >
                {phoneError}
              </p>
            )}
          </div>

          {/* Company — always required */}
          <FormField
            label="Company *"
            type="text"
            placeholder="Acme Plumbing Co."
            value={form.company}
            onChange={update("company")}
            required
          />
        </div>

        {/* Submission error */}
        {status === "error" && error && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 7,
              fontSize: "0.78rem",
              color: "#FCA5A5",
              marginBottom: 12,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isDisabled}
          style={{
            width: "100%",
            padding: "13px 20px",
            background:
              status === "submitting"
                ? "rgba(37,99,235,0.4)"
                : "linear-gradient(135deg, #2563EB, #1D4ED8)",
            border: "none",
            borderRadius: 10,
            color: "#ffffff",
            fontSize: "0.92rem",
            fontWeight: 700,
            cursor: isDisabled ? "not-allowed" : "pointer",
            boxShadow: isDisabled ? "none" : "0 4px 20px rgba(37,99,235,0.4)",
            transition: "opacity 0.2s",
            opacity: isDisabled ? 0.6 : 1,
          }}
        >
          {status === "submitting"
            ? "⏳ Preparing report…"
            : "📥 Download My PDF Report →"}
        </button>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.3)",
            textAlign: "center",
          }}
        >
          🔒 Your information is private. We never spam — ever.
        </p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic FormField sub-component
// ---------------------------------------------------------------------------

function FormField({
  label,
  type,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  hint,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "0.72rem",
          fontWeight: 600,
          color: disabled ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.5)",
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
        {hint && (
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 400,
              marginLeft: 4,
              opacity: 0.7,
            }}
          >
            {hint}
          </span>
        )}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "9px 12px",
          background: disabled
            ? "rgba(255,255,255,0.03)"
            : "rgba(255,255,255,0.06)",
          border: disabled
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          color: disabled ? "rgba(255,255,255,0.45)" : "#ffffff",
          fontSize: "0.85rem",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
          cursor: disabled ? "not-allowed" : "text",
        }}
        onFocus={(e) => {
          if (!disabled) e.target.style.borderColor = "rgba(96,165,250,0.6)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = disabled
            ? "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.12)";
        }}
      />
    </div>
  );
}
