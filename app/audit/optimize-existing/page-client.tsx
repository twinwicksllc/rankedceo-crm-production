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
        padding: "32px 16px 56px",
        background: isLight
          ? "radial-gradient(circle at 10% 0%, rgba(59,130,246,0.14), transparent 35%), radial-gradient(circle at 100% 20%, rgba(245,158,11,0.16), transparent 40%), linear-gradient(180deg, #f1f5f9 0%, #e8eefc 100%)"
          : "radial-gradient(circle at 10% 0%, rgba(56,189,248,0.15), transparent 35%), radial-gradient(circle at 100% 20%, rgba(245,158,11,0.18), transparent 40%), linear-gradient(180deg, #020617 0%, #111827 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1140,
          margin: "0 auto",
          display: "grid",
          gap: 18,
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
            padding: "22px 22px 18px",
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
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 760 }}>
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "clamp(1.4rem, 2.7vw, 2rem)",
                  fontWeight: 850,
                  color: isLight ? "#0f172a" : "#ffffff",
                  lineHeight: 1.2,
                }}
              >
                Keep your current site. Let RankedCEO optimize it.
              </h1>
              <p
                style={{
                  margin: 0,
                  color: isLight ? "#334155" : "rgba(255,255,255,0.82)",
                  lineHeight: 1.55,
                  fontSize: "0.96rem",
                }}
              >
                We will review your audit and build a focused optimization plan
                for {targetDomain} across speed, technical SEO, and conversion
                performance.
              </p>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                padding: "8px 12px",
                background: isLight
                  ? "rgba(14,165,233,0.1)"
                  : "rgba(14,165,233,0.16)",
                border: isLight
                  ? "1px solid rgba(14,165,233,0.26)"
                  : "1px solid rgba(14,165,233,0.34)",
                color: isLight ? "#0f172a" : "#dbeafe",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              <span>Site:</span>
              <span>{targetDomain}</span>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
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
              padding: 20,
              boxShadow: isLight
                ? "0 16px 45px rgba(15,23,42,0.12)"
                : "0 16px 45px rgba(2,6,23,0.5)",
              display: "grid",
              gap: 16,
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
                  marginBottom: 8,
                }}
              >
                What Happens Next
              </div>
              <div style={{ display: "grid", gap: 10 }}>
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
                      gap: 9,
                      fontSize: "0.89rem",
                      color: isLight ? "#334155" : "rgba(255,255,255,0.82)",
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: isLight ? "#16a34a" : "#4ade80" }}>
                      ✓
                    </span>
                    <span>{item}</span>
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
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  marginBottom: 8,
                  color: isLight ? "#0f172a" : "#ffffff",
                }}
              >
                Fast Intake
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {[
                  { label: "Request", value: "1 min" },
                  { label: "Review", value: "24 hrs" },
                  { label: "Plan", value: "Actionable" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      borderRadius: 10,
                      padding: "10px 8px",
                      textAlign: "center",
                      background: isLight
                        ? "rgba(219,234,254,0.5)"
                        : "rgba(30,41,59,0.7)",
                      border: isLight
                        ? "1px solid rgba(37,99,235,0.16)"
                        : "1px solid rgba(125,211,252,0.2)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.82rem",
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
                        marginTop: 2,
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
              padding: 20,
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
              style={{
                margin: "0 0 6px",
                fontSize: "clamp(1.15rem, 2.2vw, 1.45rem)",
                fontWeight: 800,
                color: isLight ? "#0f172a" : "#ffffff",
              }}
            >
              Request RankedCEO to fix your current site
            </h2>
            <p
              style={{
                margin: "0 0 18px",
                color: isLight ? "#475569" : "rgba(255,255,255,0.78)",
                lineHeight: 1.5,
                fontSize: "0.92rem",
              }}
            >
              Fill this out and we will contact you with your optimization plan.
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
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    style={inputStyle(isLight)}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    style={inputStyle(isLight)}
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    style={inputStyle(isLight)}
                  />
                  <input
                    type="text"
                    placeholder="Company"
                    value={form.company}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, company: e.target.value }))
                    }
                    style={inputStyle(isLight)}
                  />
                </div>

                <textarea
                  placeholder="Any specific issues you want fixed? (optional)"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
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
                    background:
                      "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
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
        </section>
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
