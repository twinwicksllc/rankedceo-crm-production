"use client";

// =============================================================================
// BookingForm (B5): the contact form on a customer's website.
//
// Posts to the submitTenantLead server action. The server decides whether the
// submission is accepted (signed tenant token, live site, rate limit); this
// component only collects and displays. In "preview" mode (the owner looking at
// a site that is not live yet) it renders the form but cannot send.
// =============================================================================

import { useEffect, useRef, useState, type FormEvent } from "react";
import { submitTenantLead } from "@/lib/waas/actions/tenant-lead";
import type { BookingFormSettings } from "@/lib/waas/booking-form-config";

interface BookingFormProps {
  tenantId: string;
  /** Signed by the server; null only in preview mode. */
  siteToken: string | null;
  mode: "live" | "preview";
  settings: BookingFormSettings;
  /** Shown as a fallback when sending fails. */
  phone?: string | null;
  /** Heading level context: the form sits under the section's own h2. */
  headingId: string;
}

type Status = "idle" | "sending" | "sent" | "error";

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-base outline-none transition focus:ring-2";

export function BookingForm({
  tenantId,
  siteToken,
  mode,
  settings,
  phone,
  headingId,
}: BookingFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set after mount so a script that submits instantly has no valid time.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const isPreview = mode === "preview";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPreview || status === "sending") return;
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");

    setStatus("sending");
    setError("");
    setFieldErrors({});

    let result;
    try {
      result = await submitTenantLead({
        tenantId,
        siteToken,
        name: text("name"),
        email: text("email"),
        phone: text("phone") || undefined,
        message: text("message") || undefined,
        service: text("service") || undefined,
        pageUrl: window.location.href,
        website: text("website"),
        shownAt: shownAt.current,
      });
    } catch {
      result = {
        ok: false as const,
        error: "We could not send your message. Please call us instead.",
        fieldErrors: undefined,
      };
    }

    if (result.ok) {
      setStatus("sent");
      return;
    }
    setStatus("error");
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border p-8 text-center font-brand-body"
        style={{
          borderColor: "var(--brand-accent)",
          backgroundColor: "var(--brand-background)",
          color: "var(--brand-text)",
        }}
      >
        <p className="text-2xl mb-2" aria-hidden="true">
          ✅
        </p>
        <p className="text-lg font-semibold">{settings.successMessage}</p>
      </div>
    );
  }

  const field = (name: string) => ({
    id: `lead-${name}`,
    name,
    disabled: isPreview || status === "sending",
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `lead-${name}-error` : undefined,
    className: inputClass,
    style: {
      borderColor: "var(--brand-accent)",
      backgroundColor: "var(--brand-background)",
      color: "var(--brand-text)",
    } as const,
  });
  const label = (name: string, text: string, required = false) => (
    <label
      htmlFor={`lead-${name}`}
      className="mb-1 block text-sm font-semibold"
      style={{ color: "var(--brand-text)" }}
    >
      {text}
      {required ? <span aria-hidden="true"> *</span> : null}
    </label>
  );
  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p
        id={`lead-${name}-error`}
        role="alert"
        className="mt-1 text-sm"
        style={{ color: "#b91c1c" }}
      >
        {fieldErrors[name]}
      </p>
    ) : null;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={headingId}
      className="space-y-4 rounded-2xl border p-6 sm:p-8 font-brand-body"
      style={{
        borderColor: "var(--brand-accent)",
        backgroundColor: "var(--brand-background)",
      }}
    >
      <h3
        id={headingId}
        className="font-brand-heading text-2xl font-bold"
        style={{ color: "var(--brand-text)" }}
      >
        {settings.heading}
      </h3>

      {isPreview ? (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            backgroundColor: "var(--brand-accent)",
            color: "var(--brand-text)",
          }}
        >
          Preview only. This form starts working when your site goes live.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {label("name", "Your name", true)}
          <input {...field("name")} type="text" autoComplete="name" required maxLength={100} />
          {fieldError("name")}
        </div>
        <div>
          {label("email", "Email", true)}
          <input {...field("email")} type="email" autoComplete="email" required maxLength={254} />
          {fieldError("email")}
        </div>
        <div>
          {label("phone", "Phone")}
          <input {...field("phone")} type="tel" autoComplete="tel" maxLength={30} />
          {fieldError("phone")}
        </div>
        {settings.services.length > 0 ? (
          <div>
            {label("service", "What do you need?")}
            <select {...field("service")} defaultValue="">
              <option value="">Choose one</option>
              {settings.services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div>
        {label("message", "How can we help?")}
        <textarea {...field("message")} rows={4} maxLength={2000} />
        {fieldError("message")}
      </div>

      {/* Honeypot: invisible to people, tempting to bots. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
      >
        <label htmlFor="lead-website">Leave this field empty</label>
        <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error ? (
        <div role="alert" className="text-sm" style={{ color: "#b91c1c" }}>
          <p>{error}</p>
          {phone ? (
            <p className="mt-1">
              <a href={`tel:${phone.replace(/\D/g, "")}`} className="underline font-semibold">
                Call {phone}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPreview || status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-xl px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {status === "sending" ? "Sending…" : settings.buttonLabel}
      </button>
    </form>
  );
}
