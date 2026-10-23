import {
  electricalLeadSchema,
  hvacLeadSchema,
  plumbingLeadSchema,
} from "../validations/industry-lead";
import type { SubmitLeadInput } from "../types/industry-lead";

// ============================================================
// Server-side validation of a public lead submission
// ============================================================
// submitIndustryLead writes with the admin client, which bypasses row-level
// security, so nothing in the database limits what a caller can send. The
// industry's own zod schema runs first; only a parsed value is written.
//
// The message names the failed fields' paths, never their values, so no
// customer data reaches a log line.
// ============================================================

export type LeadValidation =
  | { ok: true; data: SubmitLeadInput }
  | { ok: false; error: string };

const SCHEMAS = {
  hvac: hvacLeadSchema,
  plumbing: plumbingLeadSchema,
  electrical: electricalLeadSchema,
} as const;

export function validateLeadInput(input: unknown): LeadValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Invalid lead submission" };
  }
  const industry = (input as { industry?: unknown }).industry;
  if (
    industry !== "hvac" &&
    industry !== "plumbing" &&
    industry !== "electrical"
  ) {
    return { ok: false, error: "Invalid lead submission: industry" };
  }
  const parsed = SCHEMAS[industry].safeParse(input);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(root)")),
    ];
    return {
      ok: false,
      error: `Invalid lead submission: ${fields.join(", ")}`,
    };
  }
  return { ok: true, data: parsed.data as SubmitLeadInput };
}
