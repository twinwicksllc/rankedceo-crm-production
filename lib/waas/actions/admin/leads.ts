"use server";

import { getAdminClient, type ActionResult } from "./_shared";
import type { WaasLead } from "@/lib/waas/supabase";

export interface AdminLeadListItem extends WaasLead {
  audit_status?: string;
}

export async function getAdminLeads(): Promise<ActionResult<AdminLeadListItem[]>> {
  try {
    const supabase = getAdminClient();
    
    // Fetch leads with audit info
    const { data, error } = await supabase
      .from("leads")
      .select(`
        *,
        audits (
          status,
          target_url
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const leads = (data || []).map((lead: any) => ({
      ...lead,
      audit_status: lead.audits?.status,
    }));

    return { success: true, data: leads };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
