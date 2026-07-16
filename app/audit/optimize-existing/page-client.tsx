"use client";

import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useOnboardingTheme } from "@/app/get-started/theme-context";

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

// Validation helpers
const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePhone = (phone: string): boolean => {
  return /^[\d\-\+\(\)\s]{7,}$/.test(phone.trim());
};

const validateForm = (form: FormState): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!form.name.trim()) errors.name = "Please enter your full name";
  if (!form.email.trim()) errors.email = "Please enter your email";
  else if (!validateEmail(form.email)) errors.email = "Please enter a valid email";
  if (!form.phone.trim()) errors.phone = "Please enter your phone number";
  else if (!validatePhone(form.phone)) errors.phone = "Please enter a valid phone number";
  if (!form.company.trim()) errors.company = "Please enter your company name";
  return errors;
};

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
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [focusedField, setFocusedField] = useState<keyof FormState | null>(null);

  const canSubmit = useMemo(() => {
    const errors = validateForm(form);
    return Boolean(auditId) && Object.keys(errors).length === 0;
  }, [auditId, form]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm(form);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0 || !auditId) return;

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

  const handleFieldChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((p) => ({ ...p, [field]: value }));
      // Clear validation error for this field when user starts typing
      if (validationErrors[field]) {
        setValidationErrors((p) => ({ ...p, [field]: undefined }));
      }
    },
    [validationErrors]
  );

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .optimize-main-container {
            padding: 24px 16px 48px;
          }
          .optimize-hero-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .optimize-hero-badge {
            align-self: flex-start;
            margin-top: 12px;
          }
          .optimize-cards-grid {
            grid-template-columns: 1fr;
          }
          .optimize-form-inputs {
            grid-template-columns: 1fr;
          }
          .optimize-fast-intake-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (min-width: 768px) and (max-width: 1279px) {
          .optimize-main-container {
            padding: 28px 20px 52px;
          }
          .optimize-form-inputs {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1280px) {
          .optimize-main-container {
            padding: 32px 16px 56px;
          }
          .optimize-form-inputs {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        input:focus, textarea:focus {
          outline: none;
        }

        .optimize-input-wrapper:has(input:focus) input,
        .optimize-input-wrapper:has(textarea:focus) textarea {
          box-shadow: 0 0 0 3px ${isLight ? "rgba(59, 130, 246, 0.1)" : "rgba(56, 189, 248, 0.2)"};
        }

        .optimize-fast-intake-tile {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .optimize-fast-intake-tile:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px ${isLight ? "rgba(59, 130, 246, 0.15)" : "rgba(56, 189, 248, 0.2)"};
        }

        .optimize-submit-button {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .optimize-submit-button:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(217, 119, 6, 0.3);
        }

        .optimize-submit-button:disabled {
          cursor: not-allowed;
        }

        .optimize-text-balance {
          text-wrap: balance;
        }
      `}</style>
      <main
        className="optimize-main-container"
        style={{
          minHeight: "100vh",
          background: isLight
            ? "radial-gradient(circle at 10% 0%, rgba(59,130,246,0.14), transparent 35%), radial-gradient(circle at 100% 20%, rgba(245,158,11,0.16), transparent 40%), linear-gradient(180deg, #f1f5f9 0%, #e8eefc 100%)"
            : "radial-gradient(circle at 10% 0%, rgba(56,189,248,0.15), transparent 35%), radial-gradient(circle at 100% 20%, rgba(245,158,11,0.18), transparent 40%), linear-gradient(180deg, #020617 0%, #111827 100%)",
        }}
      >
        <div
          className="optimize-cards-grid"
          style={{
            maxWidth: 1140,
            margin: "0 auto",
            display: "grid",
            gap: "clamp(16px, 2vw, 24px)",
          }}
        >
        <section
          style={{
            borderRadius: 18,
            border: isLight
              ? "1px solid rgba(15,23,42,0.12)"
              : "1px solid rgba(255,255,255,0.12)",
            background: isLight
              ? "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))"
              : "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.86))",
            padding: "clamp(18px, 4vw, 28px)",
            boxShadow: isLight
              ? "0 16px 45px rgba(15,23,42,0.12)"
              : "0 16px 45px rgba(2,6,23,0.5)",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 800,
              color: isLight ? "#1d4ed8" : "#38bdf8",
              marginBottom: 10,
            }}
          >
            Optimization Request
          </div>
          <div
            className="optimize-hero-header"
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "clamp(12px, 3vw, 20px)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: "min(100%, 680px)", flex: 1, minWidth: 0 }}>
              <h1
                className="optimize-text-balance"
                style={{
                  margin: "0 0 12px",
                  fontSize: "clamp(1.4rem, 2.7vw, 2rem)",
                  fontWeight: 850,
                  color: isLight ? "#0f172a" : "#ffffff",
                  lineHeight: 1.2,
                }}
              >
                Keep your current site. Let <span style={{ color: isLight ? "#1d4ed8" : "#38bdf8" }}>RankedCEO</span> optimize it.
              </h1>
              <p
                className="optimize-text-balance"
                style={{
                  margin: 0,
                  color: isLight ? "#334155" : "rgba(255,255,255,0.82)",
                  lineHeight: 1.6,
                  fontSize: "clamp(0.9rem, 1.2vw, 0.96rem)",
                  maxWidth: "70ch",
                }}
              >
                We'll review your audit and build a focused optimization plan for <span style={{ fontWeight: 700, color: isLight ? "#1d4ed8" : "#38bdf8" }}>{targetDomain}</span> across speed, technical SEO, and conversion performance.
              </p>
            </div>
            <div
              className="optimize-hero-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                padding: "8px 14px",
                background: isLight
                  ? "rgba(14,165,233,0.1)"
                  : "rgba(14,165,233,0.16)",
                border: isLight
                  ? "1px solid rgba(14,165,233,0.26)"
                  : "1px solid rgba(14,165,233,0.34)",
                color: isLight ? "#0f172a" : "#dbeafe",
                fontSize: "0.78rem",
                fontWeight: 700,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span>Site:</span>
              <span style={{ fontWeight: 800, color: isLight ? "#1d4ed8" : "#38bdf8" }}>{targetDomain}</span>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "clamp(16px, 2vw, 24px)",
          }}
        >
          <aside
            style={{
              borderRadius: 16,
              border: isLight
                ? "1px solid rgba(15,23,42,0.12)"
                : "1px solid rgba(255,255,255,0.12)",
              background: isLight
                ? "rgba(255,255,255,0.9)"
                : "rgba(15,23,42,0.84)",
              padding: "clamp(16px, 3vw, 24px)",
              boxShadow: isLight
                ? "0 16px 45px rgba(15,23,42,0.12)"
                : "0 16px 45px rgba(2,6,23,0.5)",
              display: "grid",
              gap: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: isLight ? "#0284c7" : "#7dd3fc",
                  marginBottom: 12,
                }}
              >
                What Happens Next
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  "A strategist reviews your audit report and current stack",
                  "We map priority fixes for rankings, speed, and UX",
                  "You receive a recommended optimization roadmap",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: "clamp(0.88rem, 1vw, 0.89rem)",
                      color: isLight ? "#334155" : "rgba(255,255,255,0.82)",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        color: isLight ? "#16a34a" : "#4ade80",
                        fontWeight: 800,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span style={{ maxWidth: "60ch" }} className="optimize-text-balance">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                borderRadius: 12,
                border: isLight
                  ? "1px solid rgba(15,23,42,0.1)"
                  : "1px solid rgba(255,255,255,0.12)",
                background: isLight
                  ? "rgba(248,250,252,0.95)"
                  : "rgba(2,6,23,0.45)",
                padding: "clamp(12px, 2vw, 16px)",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  marginBottom: 12,
                  color: isLight ? "#0f172a" : "#ffffff",
                }}
              >
                Fast Intake
              </div>
              <div
                className="optimize-fast-intake-grid"
                style={{
                  display: "flex",
                  gap: "clamp(8px, 2vw, 12px)",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                }}
              >
                {[
                  { label: "Request", value: "1 min" },
                  { label: "Review", value: "24 hrs" },
                  { label: "Plan", value: "Actionable" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="optimize-fast-intake-tile"
                    style={{
                      flex: "1 1 calc(33.333% - 8px)",
                      minWidth: "100px",
                      borderRadius: 10,
                      padding: "clamp(10px, 2vw, 12px)",
                      textAlign: "center",
                      background: isLight
                        ? "rgba(219,234,254,0.5)"
                        : "rgba(30,41,59,0.7)",
                      border: isLight
                        ? "1px solid rgba(37,99,235,0.16)"
                        : "1px solid rgba(125,211,252,0.2)",
                      cursor: "default",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "clamp(0.8rem, 1.2vw, 0.82rem)",
                        fontWeight: 800,
                        color: isLight ? "#1e3a8a" : "#e0f2fe",
                      }}
                    >
                      {s.value}
                    </div>
                    <div
                      style={{
                        fontSize: "0.67rem",
                        color: isLight ? "#475569" : "rgba(255,255,255,0.6)",
                        marginTop: 4,
                        fontWeight: 600,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div
            style={{
              borderRadius: 16,
              border: isLight
                ? "1px solid rgba(15,23,42,0.12)"
                : "1px solid rgba(255,255,255,0.12)",
              background: isLight
                ? "rgba(255,255,255,0.92)"
                : "rgba(15,23,42,0.84)",
              padding: "clamp(16px, 3vw, 28px)",
              boxShadow: isLight
                ? "0 16px 45px rgba(15,23,42,0.12)"
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
            <h2
              className="optimize-text-balance"
              style={{
                margin: "0 0 8px",
                fontSize: "clamp(1.15rem, 2.2vw, 1.45rem)",
                fontWeight: 800,
                color: isLight ? "#0f172a" : "#ffffff",
              }}
            >
              Request RankedCEO to fix your current site
            </h2>
            <p
              className="optimize-text-balance"
              style={{
                margin: "0 0 20px",
                color: isLight ? "#475569" : "rgba(255,255,255,0.78)",
                lineHeight: 1.6,
                fontSize: "clamp(0.88rem, 1vw, 0.92rem)",
                maxWidth: "65ch",
              }}
            >
              Fill out this form and we'll contact you with a personalized optimization roadmap for your site.
            </p>

            {status === "success" ? (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(34,197,94,0.4)",
                  background: "rgba(34,197,94,0.1)",
                  padding: "16px 18px",
                  color: isLight ? "#166534" : "#86efac",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                }}
              >
                ✓ Your optimization request was sent successfully. A strategist will reach out shortly.
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div
                  className="optimize-form-inputs"
                  style={{
                    display: "grid",
                    gap: "clamp(12px, 1.5vw, 14px)",
                  }}
                >
                  {/* Name field */}
                  <div className="optimize-input-wrapper" style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={form.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      aria-label="Full name"
                      aria-invalid={!!validationErrors.name}
                      style={{
                        ...inputStyle(isLight),
                        borderColor: validationErrors.name
                          ? isLight
                            ? "#dc2626"
                            : "#f87171"
                          : undefined,
                      }}
                    />
                    {validationErrors.name && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: isLight ? "#dc2626" : "#fca5a5",
                          marginTop: 4,
                          fontWeight: 500,
                        }}
                      >
                        {validationErrors.name}
                      </div>
                    )}
                  </div>

                  {/* Email field */}
                  <div className="optimize-input-wrapper" style={{ position: "relative" }}>
                    <input
                      type="email"
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      aria-label="Email address"
                      aria-invalid={!!validationErrors.email}
                      style={{
                        ...inputStyle(isLight),
                        borderColor: validationErrors.email
                          ? isLight
                            ? "#dc2626"
                            : "#f87171"
                          : undefined,
                      }}
                    />
                    {validationErrors.email && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: isLight ? "#dc2626" : "#fca5a5",
                          marginTop: 4,
                          fontWeight: 500,
                        }}
                      >
                        {validationErrors.email}
                      </div>
                    )}
                  </div>

                  {/* Phone field */}
                  <div className="optimize-input-wrapper" style={{ position: "relative" }}>
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      onFocus={() => setFocusedField("phone")}
                      onBlur={() => setFocusedField(null)}
                      aria-label="Phone number"
                      aria-invalid={!!validationErrors.phone}
                      style={{
                        ...inputStyle(isLight),
                        borderColor: validationErrors.phone
                          ? isLight
                            ? "#dc2626"
                            : "#f87171"
                          : undefined,
                      }}
                    />
                    {validationErrors.phone && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: isLight ? "#dc2626" : "#fca5a5",
                          marginTop: 4,
                          fontWeight: 500,
                        }}
                      >
                        {validationErrors.phone}
                      </div>
                    )}
                  </div>

                  {/* Company field */}
                  <div className="optimize-input-wrapper" style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Company"
                      value={form.company}
                      onChange={(e) => handleFieldChange("company", e.target.value)}
                      onFocus={() => setFocusedField("company")}
                      onBlur={() => setFocusedField(null)}
                      aria-label="Company name"
                      aria-invalid={!!validationErrors.company}
                      style={{
                        ...inputStyle(isLight),
                        borderColor: validationErrors.company
                          ? isLight
                            ? "#dc2626"
                            : "#f87171"
                          : undefined,
                      }}
                    />
                    {validationErrors.company && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: isLight ? "#dc2626" : "#fca5a5",
                          marginTop: 4,
                          fontWeight: 500,
                        }}
                      >
                        {validationErrors.company}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes textarea - full width */}
                <div className="optimize-input-wrapper" style={{ marginTop: "clamp(12px, 2vw, 16px)", position: "relative" }}>
                  <textarea
                    placeholder="Any specific issues you want fixed? (optional)"
                    value={form.notes}
                    onChange={(e) => handleFieldChange("notes", e.target.value)}
                    onFocus={() => setFocusedField("notes")}
                    onBlur={() => setFocusedField(null)}
                    rows={4}
                    aria-label="Additional notes (optional)"
                    style={{
                      ...inputStyle(isLight),
                      width: "100%",
                      resize: "vertical",
                      fontFamily: "inherit",
                      minHeight: "104px",
                    }}
                  />
                </div>

                {/* Error message */}
                {error && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 12,
                      borderRadius: 10,
                      border: "1px solid rgba(239,68,68,0.4)",
                      background: "rgba(239,68,68,0.1)",
                      color: isLight ? "#991b1b" : "#fecaca",
                      padding: "12px 14px",
                      fontSize: "0.9rem",
                      fontWeight: 500,
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!canSubmit || status === "submitting"}
                  className="optimize-submit-button"
                  aria-busy={status === "submitting"}
                  style={{
                    marginTop: "clamp(16px, 2vw, 20px)",
                    width: "100%",
                    border: "none",
                    borderRadius: 10,
                    padding: "13px 16px",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    color: "#ffffff",
                    background: canSubmit
                      ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
                      : "linear-gradient(135deg, #9a3412 0%, #7c2d12 100%)",
                    cursor: canSubmit && status !== "submitting" ? "pointer" : "not-allowed",
                    opacity: canSubmit ? 1 : 0.6,
                  }}
                >
                  {status === "submitting"
                    ? "Sending request..."
                    : "Request Optimization Review"}
                </button>

                {/* Privacy reassurance */}
                <p
                  style={{
                    marginTop: 12,
                    fontSize: "0.78rem",
                    color: isLight ? "#64748b" : "rgba(255,255,255,0.64)",
                    textAlign: "center",
                    fontWeight: 500,
                  }}
                >
                  🔒 We never share your information with third parties.
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
    </>
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
    padding: "11px 14px",
    fontSize: "clamp(0.88rem, 1vw, 0.92rem)",
    outline: "none",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  };
}
