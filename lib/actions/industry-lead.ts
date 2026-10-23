"use server";

import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { resolveAccountId } from "@/lib/services/account-context";
import {
  fromLeadRow,
  toLeadInsertRow,
  toLeadUpdatePatch,
  type LeadRow,
} from "@/lib/services/industry-lead-row";
import {
  buildSearchFilter,
  computeLeadStats,
} from "@/lib/services/industry-lead-query";
import {
  LEAD_CHANGED_ERROR,
  applyLeadUpdate,
} from "@/lib/services/industry-lead-update";
import { revalidatePath } from "next/cache";
import { POOL_ACCOUNTS } from "@/lib/data/pool-accounts";
import type {
  IndustryType,
  IndustryLead,
  LeadStats,
  LeadFilters,
  SubmitLeadInput,
  SubmitLeadResult,
  GetLeadsResult,
  UpdateLeadResult,
} from "@/lib/types/industry-lead";
import type { UpdateLeadInput } from "@/lib/validations/industry-lead";

// ---------------------------------------------------------------------------
// Submit Lead (public — no auth required)
// ---------------------------------------------------------------------------
// Called from the public lead form on each industry subdomain.
// If operator_id is provided, looks up their account_id.
// If not, falls back to the industry pool account.
// ---------------------------------------------------------------------------

export async function submitIndustryLead(
  data: SubmitLeadInput,
): Promise<SubmitLeadResult> {
  try {
    const supabase = await createClient();

    let accountId: string;
    let authUserId: string | null = null;

    if (data.operator_id) {
      // Attributed lead — look up operator's account
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("account_id")
        .eq("id", data.operator_id)
        .single();

      if (userError || !userData) {
        // Operator not found — fall back to pool rather than failing
        console.error(
          "[IndustryLead] Operator not found, falling back to pool:",
          data.operator_id,
        );
        accountId = POOL_ACCOUNTS[data.industry];
      } else {
        accountId = userData.account_id;
        authUserId = data.operator_id;
      }
    } else {
      // Unattributed lead — use pool account
      accountId = POOL_ACCOUNTS[data.industry];
    }

    // The insert goes through a session-less client: "Public lead intake" is
    // TO anon, and the cookie client runs as authenticated for a signed-in
    // visitor. anon has no SELECT policy, so the id is generated here instead
    // of read back with a returning select.
    const leadId = crypto.randomUUID();
    const { error: insertError } = await createAnonClient()
      .from("industry_leads")
      .insert({ id: leadId, ...toLeadInsertRow(accountId, authUserId, data) });

    if (insertError) {
      console.error(
        "[IndustryLead] Insert failed:",
        insertError.code,
        insertError.message,
      );
      return {
        success: false,
        error: "Failed to submit your request. Please try again.",
      };
    }

    // Revalidate the operator's dashboard
    revalidatePath(`/${data.industry}`);

    return { success: true, leadId };
  } catch (err) {
    console.error("[IndustryLead] Unexpected error during submission:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Get Leads (authenticated — operator dashboard)
// ---------------------------------------------------------------------------

export async function getIndustryLeads(
  industry: IndustryType,
  filters?: LeadFilters,
): Promise<GetLeadsResult> {
  try {
    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    // users.id IS the auth uid; resolveAccountId also covers a legacy profile
    // whose id is not the auth id.
    let accountId: string;
    try {
      accountId = await resolveAccountId(supabase, user);
    } catch {
      return { success: false, data: [], error: "Account not found" };
    }

    // Build query
    let query = supabase
      .from("industry_leads")
      .select("*")
      .eq("account_id", accountId)
      .eq("industry", industry)
      .order("created_at", { ascending: false });

    // Apply optional filters
    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters?.urgency && filters.urgency !== "all") {
      query = query.eq("urgency", filters.urgency);
    }
    const searchFilter = buildSearchFilter(filters?.search);
    if (searchFilter) {
      query = query.or(searchFilter);
    }
    if (filters?.date_from) {
      query = query.gte("created_at", filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte("created_at", filters.date_to);
    }

    const { data: leads, error: fetchError } = await query;

    if (fetchError) {
      console.error("[IndustryLead] Fetch failed:", fetchError.code);
      return { success: false, data: [], error: "Failed to load leads" };
    }

    return {
      success: true,
      data: ((leads as LeadRow[] | null) ?? []).map(fromLeadRow),
    };
  } catch {
    console.error("[IndustryLead] Unexpected error fetching leads");
    return { success: false, data: [], error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Get Single Lead
// ---------------------------------------------------------------------------

export async function getIndustryLead(
  leadId: string,
): Promise<{ success: boolean; data: IndustryLead | null; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, data: null, error: "Not authenticated" };
    }

    let accountId: string;
    try {
      accountId = await resolveAccountId(supabase, user);
    } catch {
      return { success: false, data: null, error: "Account not found" };
    }

    // Scoped to the caller's account here as well as by RLS.
    const { data: lead, error: fetchError } = await supabase
      .from("industry_leads")
      .select("*")
      .eq("id", leadId)
      .eq("account_id", accountId)
      .single();

    if (fetchError || !lead) {
      return { success: false, data: null, error: "Lead not found" };
    }

    return { success: true, data: fromLeadRow(lead as LeadRow) };
  } catch {
    console.error("[IndustryLead] Unexpected error fetching lead");
    return { success: false, data: null, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Update Lead Status (operator dashboard action)
// ---------------------------------------------------------------------------

export async function updateIndustryLead(
  leadId: string,
  updates: UpdateLeadInput,
): Promise<UpdateLeadResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    let accountId: string;
    try {
      accountId = await resolveAccountId(supabase, user);
    } catch {
      return { success: false, error: "Account not found" };
    }

    // Reads the row scoped to the caller's account, merges the jsonb columns and
    // writes only if no one else updated it in between (see industry-lead-update).
    const result = await applyLeadUpdate(supabase, leadId, accountId, updates);
    if (!result.success) {
      // A conflict is expected under concurrent edits; only real failures log.
      if (result.error !== LEAD_CHANGED_ERROR) {
        console.error("[IndustryLead] Update failed:", result.error);
      }
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch {
    console.error("[IndustryLead] Unexpected error updating lead");
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Get Lead Stats (operator dashboard)
// ---------------------------------------------------------------------------

export async function getIndustryLeadStats(
  industry: IndustryType,
): Promise<{ success: boolean; data: LeadStats | null; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, data: null, error: "Not authenticated" };
    }

    // users.id IS the auth uid; resolveAccountId also covers a legacy profile
    // whose id is not the auth id.
    let accountId: string;
    try {
      accountId = await resolveAccountId(supabase, user);
    } catch {
      return { success: false, data: null, error: "Account not found" };
    }

    // Fetch all leads for stats calculation
    const { data: leads, error: fetchError } = await supabase
      .from("industry_leads")
      .select("status, urgency, metadata")
      .eq("account_id", accountId)
      .eq("industry", industry);

    if (fetchError) {
      return { success: false, data: null, error: "Failed to load stats" };
    }

    const stats: LeadStats = computeLeadStats(leads || []);

    return { success: true, data: stats };
  } catch {
    console.error("[IndustryLead] Unexpected error fetching stats");
    return { success: false, data: null, error: "Unexpected error" };
  }
}
