"use server";

import { getAdminClient, type ActionResult } from "./_shared";
import type { WaasLead } from "@/lib/waas/supabase";

export interface AdminLeadListItem extends WaasLead {
  audit_status?: string;
  /** Business the lead was sent to (tenant_site leads). */
  tenant_name?: string;
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
        ),
        tenants (
          legal_name,
          brand_config
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const leads = (data || []).map((lead) => {
      const brand = (lead.tenants?.brand_config ?? {}) as {
        business_name?: string;
      };
      return {
        ...lead,
        audit_status: lead.audits?.status,
        tenant_name:
          brand.business_name ?? lead.tenants?.legal_name ?? undefined,
      };
    });

    return { success: true, data: leads };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
