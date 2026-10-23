import type {
  IndustryLead,
  IndustryType,
  LeadStatus,
  PreferredContactMethod,
  ServiceUrgency,
  SubmitLeadInput,
} from "../types/industry-lead";
import type { UpdateLeadInput } from "../validations/industry-lead";

// ============================================================
// How an industry lead is stored, and how it is read back
// ============================================================
// The live CRM industry_leads table (and the CREATE TABLE in waas/030) has only:
//   id, created_at, updated_at, account_id, auth_user_id, industry,
//   lead_name, lead_email, lead_phone, urgency, status,
//   problem_description (jsonb), metadata (jsonb).
//
// Everything else lives in jsonb:
//   problem_description  what the customer submitted (LeadDetails)
//   metadata             what the operator adds later (LeadMeta)
//
// Every writer builds its row here, and every reader maps through
// fromLeadRow, so no caller names a column the table lacks and the lead card
// always receives the shape it renders.
// ============================================================

/** Columns that exist on the table. Tests assert writers use no others. */
export const LEAD_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "account_id",
  "auth_user_id",
  "industry",
  "lead_name",
  "lead_email",
  "lead_phone",
  "urgency",
  "status",
  "problem_description",
  "metadata",
] as const;

/** problem_description: what the customer submitted. All keys optional. */
export interface LeadDetails {
  service_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  preferred_contact_method?: PreferredContactMethod | null;
  preferred_time?: string | null;
  notes?: string | null;
  service_details?: Record<string, unknown>;
}

/** metadata: what the operator adds after the lead arrives. */
export interface LeadMeta {
  estimated_value?: number | null;
  assigned_to?: string | null;
}

/** A row as read from the table. Fields are loose because jsonb is untyped. */
export interface LeadRow {
  id: string;
  created_at: string;
  updated_at?: string | null;
  account_id: string;
  auth_user_id: string | null;
  industry: string;
  lead_name?: string | null;
  lead_email?: string | null;
  lead_phone?: string | null;
  urgency?: string | null;
  status?: string | null;
  problem_description?: unknown;
  metadata?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** jsonb can hold a string, an array or null (older rows); treat those as {}. */
function asObject(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** The insert row for a submitted lead. Only live columns appear. */
export function toLeadInsertRow(
  accountId: string,
  authUserId: string | null,
  input: SubmitLeadInput,
) {
  const details: LeadDetails = {
    service_address: input.service_address || null,
    city: input.city || null,
    state: input.state || null,
    zip_code: input.zip_code || null,
    preferred_contact_method: input.preferred_contact_method || "phone",
    preferred_time: input.preferred_time || null,
    notes: input.notes || null,
    service_details: input.service_details || {},
  };
  return {
    account_id: accountId,
    auth_user_id: authUserId,
    industry: input.industry,
    lead_name: input.customer_name,
    lead_email: input.customer_email.toLowerCase(),
    lead_phone: input.customer_phone,
    urgency: input.urgency,
    status: "new",
    problem_description: details,
    metadata: {} as LeadMeta,
  };
}

/**
 * A stored row as the shape the lead card and dashboards render. Never throws
 * on a missing or oddly typed jsonb field: leads created by the chat agent or
 * the landing quote form carry only part of the details.
 */
export function fromLeadRow(row: LeadRow): IndustryLead {
  const details = asObject(row.problem_description);
  const meta = asObject(row.metadata);
  const estimated = meta.estimated_value;
  return {
    id: row.id,
    account_id: row.account_id,
    auth_user_id: row.auth_user_id,
    industry: row.industry as IndustryType,
    customer_name: row.lead_name ?? "",
    customer_email: row.lead_email ?? "",
    customer_phone: row.lead_phone ?? "",
    service_address: str(details.service_address),
    city: str(details.city),
    state: str(details.state),
    zip_code: str(details.zip_code),
    urgency: (row.urgency ?? "scheduled") as ServiceUrgency,
    preferred_contact_method: (str(details.preferred_contact_method) ??
      "phone") as PreferredContactMethod,
    preferred_time: str(details.preferred_time),
    notes: str(details.notes),
    service_details: asObject(details.service_details),
    status: (row.status ?? "new") as LeadStatus,
    estimated_value: typeof estimated === "number" ? estimated : null,
    assigned_to: str(meta.assigned_to),
    submitted_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

/**
 * The columns to write for an operator update. status is a real column;
 * notes belong to problem_description and estimated_value / assigned_to to
 * metadata, so the existing jsonb is merged, never replaced.
 */
export function toLeadUpdatePatch(
  existing: Pick<LeadRow, "problem_description" | "metadata">,
  updates: UpdateLeadInput,
) {
  const patch: {
    status?: LeadStatus;
    problem_description?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  } = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.notes !== undefined) {
    patch.problem_description = {
      ...asObject(existing.problem_description),
      notes: updates.notes,
    };
  }
  if (
    updates.estimated_value !== undefined ||
    updates.assigned_to !== undefined
  ) {
    const meta = { ...asObject(existing.metadata) };
    if (updates.estimated_value !== undefined)
      meta.estimated_value = updates.estimated_value;
    if (updates.assigned_to !== undefined)
      meta.assigned_to = updates.assigned_to;
    patch.metadata = meta;
  }
  return patch;
}
