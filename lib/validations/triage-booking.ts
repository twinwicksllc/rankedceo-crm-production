import { z } from "zod";

const appointmentSourceSchema = z.enum([
  "manual",
  "ai_agent",
  "hvac",
  "plumbing",
  "electrical",
  "smile",
  "crm",
]);

const providerSchema = z.enum(["calendly", "google", "outlook"]);
const severitySchema = z.enum(["critical", "urgent", "moderate", "estimate"]);

export const triageSlotValidationSchema = z.object({
  accountId: z.string().uuid(),
  source: appointmentSourceSchema,
  severity: severitySchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().min(1).default("UTC"),
  preferredProvider: providerSchema.optional(),
  eventTypeUri: z.string().optional(),
});

export const triageBookSchema = triageSlotValidationSchema.extend({
  contact: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  issueId: z.string().min(1),
  issueLabel: z.string().min(1),
  title: z.string().min(1).max(180).optional(),
  description: z.string().max(4000).optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TriageSlotValidationInput = z.infer<
  typeof triageSlotValidationSchema
>;
export type TriageBookInput = z.infer<typeof triageBookSchema>;
export type CalendarProvider = z.infer<typeof providerSchema>;
export type TriageSeverity = z.infer<typeof severitySchema>;
