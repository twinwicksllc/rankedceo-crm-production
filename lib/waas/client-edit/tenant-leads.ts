// =============================================================================
// Leads from the contact form on a tenant's website, for the tenant portal (B5).
//
// Pure helpers (no Next.js / Supabase imports) so the scoping rules can be
// tested: a tenant sees ONLY its own website-form leads, and never the
// internal columns (ip_hash, audit linkage, notes).
// =============================================================================

export interface TenantLeadItem {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  service: string | null;
  pageUrl: string | null;
  createdAt: string;
}

/** The only columns the portal reads. ip_hash and notes are deliberately absent. */
export const TENANT_LEAD_COLUMNS =
  "id, name, email, phone, message, service_requested, page_url, created_at";

export const TENANT_LEADS_LIMIT = 100;

interface RawTenantLeadRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  service_requested: string | null;
  page_url: string | null;
  created_at: string;
}

export function toTenantLeadItem(row: RawTenantLeadRow): TenantLeadItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    service: row.service_requested,
    pageUrl: row.page_url,
    createdAt: row.created_at,
  };
}

/** The slice of the Supabase query builder this loader uses (lets tests fake it). */
export interface TenantLeadsQueryClient {
  from(table: "leads"): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          order(
            column: string,
            opts: { ascending: boolean },
          ): {
            limit(
              n: number,
            ): PromiseLike<{
              data: unknown[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
}

export async function loadTenantLeads(
  client: TenantLeadsQueryClient,
  tenantId: string,
): Promise<{ items: TenantLeadItem[]; error: string | null }> {
  const { data, error } = await client
    .from("leads")
    .select(TENANT_LEAD_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("source", "tenant_site")
    .order("created_at", { ascending: false })
    .limit(TENANT_LEADS_LIMIT);
  if (error) return { items: [], error: error.message };
  return {
    items: ((data ?? []) as RawTenantLeadRow[]).map(toTenantLeadItem),
    error: null,
  };
}
