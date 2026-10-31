// =============================================================================
// Validation for the lead form on a customer's website (B5)
//
// The visitor is anonymous and the action writes with the service role, which
// bypasses row-level security, so this is the only gate on what reaches the
// database. Every string is cleaned (tags and control characters removed,
// whitespace collapsed) before it is stored or emailed.
// =============================================================================

import { z } from "zod";
import { normalizePhone } from "../services/audit-engine/site-nap";

export const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  message: 2000,
  service: 100,
  pageUrl: 500,
} as const;

/** Strip HTML tags and control characters; collapse whitespace; trim. */
export function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const text = (max: number) =>
  z
    .string()
    .max(max * 2) // reject absurd payloads before cleaning
    .transform(cleanText)
    .refine((v) => v.length <= max, { message: "too long" });

const optionalText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const tenantLeadSchema = z.object({
  tenantId: z.string().uuid(),
  siteToken: z.string().min(10).max(200),
  name: text(LIMITS.name).refine((v) => v.length >= 2, { message: "required" }),
  email: z
    .string()
    .max(LIMITS.email)
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email()),
  phone: optionalText(LIMITS.phone).refine(
    (v) => v === undefined || normalizePhone(v) !== null,
    { message: "invalid phone" },
  ),
  message: optionalText(LIMITS.message),
  service: optionalText(LIMITS.service),
  pageUrl: z
    .string()
    .max(LIMITS.pageUrl)
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:"
          ? `${u.origin}${u.pathname}`
          : undefined;
      } catch {
        return undefined;
      }
    }),
  /** Honeypot: a real visitor never sees or fills this. */
  website: z.string().max(200).optional(),
  /** Client clock when the form was shown (ms since epoch), for the fill-time check. */
  shownAt: z.number().int().optional(),
});

export type TenantLeadInput = z.infer<typeof tenantLeadSchema>;

export type TenantLeadValidation =
  | { ok: true; data: TenantLeadInput }
  | { ok: false; fieldErrors: Record<string, string> };

/** Field names only, never the values (no customer data in logs or errors). */
export function validateTenantLeadInput(input: unknown): TenantLeadValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, fieldErrors: { form: "Invalid submission" } };
  }
  const parsed = tenantLeadSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in fieldErrors)) {
      fieldErrors[key] =
        key === "email"
          ? "Enter a valid email address"
          : key === "name"
            ? "Enter your name"
            : key === "phone"
              ? "Enter a valid phone number"
              : key === "message"
                ? "Your message is too long"
                : "Check this field";
    }
  }
  return { ok: false, fieldErrors };
}
