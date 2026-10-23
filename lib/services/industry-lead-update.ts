import { toLeadUpdatePatch } from "./industry-lead-row";
import type { UpdateLeadInput } from "../validations/industry-lead";

// ============================================================
// Operator update of an industry lead, safe against a concurrent edit
// ============================================================
// problem_description and metadata are jsonb, and a plain update replaces the
// whole value. Two operators who read the same row would each write back a
// merge of the OLD value, and the later write would silently drop the earlier
// one. The write is therefore conditional on the updated_at that was read: if
// another update landed in between, no row matches, nothing is written, and the
// caller is told to reload. updated_at has microsecond precision, so two
// updates that both read the same value cannot both match.
//
// Kept out of the "use server" file so it can be tested with a fake client.
// ============================================================

export const LEAD_CHANGED_ERROR =
  "This lead was changed by someone else. Reload and try again.";

interface QueryResult<T> {
  data: T | null;
  error: { code?: string } | null;
}

/** The slice of the Supabase client this function uses. */
export interface LeadUpdateClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): unknown;
    } & Record<string, unknown>;
    update(patch: Record<string, unknown>): {
      eq(column: string, value: unknown): unknown;
    } & Record<string, unknown>;
  };
}

type Chain = {
  eq(column: string, value: unknown): Chain;
  maybeSingle(): PromiseLike<
    QueryResult<{
      problem_description: unknown;
      metadata: unknown;
      updated_at: string;
    }>
  >;
  select(): PromiseLike<QueryResult<Array<{ id: string }>>>;
};

export async function applyLeadUpdate(
  client: LeadUpdateClient,
  leadId: string,
  accountId: string,
  updates: UpdateLeadInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const read = (
    client
      .from("industry_leads")
      .select("problem_description, metadata, updated_at") as Chain
  )
    .eq("id", leadId)
    .eq("account_id", accountId)
    .maybeSingle();
  const { data: existing, error: readError } = await read;

  if (readError) return { success: false, error: "Failed to update lead" };
  if (!existing) return { success: false, error: "Lead not found" };

  const write = (
    client.from("industry_leads").update({
      ...toLeadUpdatePatch(existing, updates),
      updated_at: new Date().toISOString(),
    }) as Chain
  )
    .eq("id", leadId)
    .eq("account_id", accountId)
    .eq("updated_at", existing.updated_at)
    .select();
  const { data: written, error: writeError } = await write;

  if (writeError) return { success: false, error: "Failed to update lead" };
  if (!written || written.length === 0) {
    return { success: false, error: LEAD_CHANGED_ERROR };
  }
  return { success: true };
}
