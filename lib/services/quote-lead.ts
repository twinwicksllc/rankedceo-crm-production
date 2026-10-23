import type { PoolIndustry } from "../data/pool-accounts";

// ============================================================
// Map a landing-page quote submission onto industry_leads
// ============================================================
// The live CRM table and the CREATE TABLE in waas/030 have only the lead_*
// contact columns plus two jsonb columns, problem_description and metadata.
// The quote form's other fields have no column of their own, so they are kept
// in problem_description.
// ============================================================

export interface QuoteFields {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  zipcode: string;
  notes?: string;
  urgency?: string;
  preferred_contact_method?: string;
}

export function buildQuoteLeadRow(
  accountId: string,
  industry: PoolIndustry,
  fields: QuoteFields,
) {
  return {
    account_id: accountId,
    industry,
    lead_name: `${fields.firstname} ${fields.lastname}`.trim(),
    lead_email: fields.email.toLowerCase(),
    lead_phone: fields.phone,
    urgency: fields.urgency || "scheduled",
    status: "new",
    problem_description: {
      zip_code: fields.zipcode,
      preferred_contact_method: fields.preferred_contact_method || "phone",
      notes: fields.notes || null,
    },
  };
}
