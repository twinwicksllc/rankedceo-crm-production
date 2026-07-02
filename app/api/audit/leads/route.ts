// =============================================================================
// POST /api/audit/leads
// Captures lead email from the audit report page before PDF download.
// Public endpoint — saves to leads table via capture_audit_lead() RPC.
// ALSO: Updates tenant's brand_config with captured contact info.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  updateAuditRecord,
  captureAuditLead,
  createWaasClient,
} from "@/lib/waas/supabase";
import type { WaasAudit, WaasTenant } from "@/lib/waas/types";

// ---------------------------------------------------------------------------
// Phone normalization helper
// Strips formatting, validates digit count, returns a clean E.164-style string
// or the standard US format (555) 123-4567 for storage.
//
// Accepts:
//   '5551234567'       → '(555) 123-4567'
//   '555-123-4567'     → '(555) 123-4567'
//   '(555) 123-4567'   → '(555) 123-4567'
//   '+15551234567'     → '+1 (555) 123-4567'
//   '+442071234567'    → '+44 207 123 4567'  (kept as-is, just trimmed)
// Returns null if the number has fewer than 10 digits.
// ---------------------------------------------------------------------------
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // International numbers (start with +): keep as-is after basic cleanup
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return null;
    return trimmed; // preserve original international format
  }

  // Strip all non-digit characters
  const digits = trimmed.replace(/\D/g, "");

  // US number with country code prefix (1XXXXXXXXXX)
  const usDigits =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (usDigits.length !== 10) return null;

  // Format as (555) 123-4567
  return `(${usDigits.slice(0, 3)}) ${usDigits.slice(3, 6)}-${usDigits.slice(6)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      audit_id,
      name,
      phone,
      company,
      target_url,
      industry,
      location,
      utm_source,
      utm_medium,
      utm_campaign,
      referrer_url,
    } = body;

    // Validate required fields
    if (!email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 },
      );
    }

    if (!audit_id) {
      return NextResponse.json(
        { error: "audit_id is required" },
        { status: 400 },
      );
    }

    if (!phone?.trim()) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    // Normalize and validate phone number before storing
    const normalizedPhone = normalizePhone(String(phone).trim());
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Please enter a valid phone number (at least 10 digits)" },
        { status: 400 },
      );
    }

    if (!company?.trim()) {
      return NextResponse.json(
        { error: "company is required" },
        { status: 400 },
      );
    }

    // Call the Supabase RPC via typed helper (avoids Supabase 2.x ExactMatch issues)
    const { leadId, error } = await captureAuditLead({
      email: String(email).trim().toLowerCase(),
      audit_id: String(audit_id),
      name: name != null ? String(name) : null,
      phone: normalizedPhone,
      company: company != null ? String(company) : null,
      target_url: target_url != null ? String(target_url) : null,
      industry: industry != null ? String(industry) : null,
      location: location != null ? String(location) : null,
      utm_source: utm_source != null ? String(utm_source) : null,
      utm_medium: utm_medium != null ? String(utm_medium) : null,
      utm_campaign: utm_campaign != null ? String(utm_campaign) : null,
      referrer_url: referrer_url != null ? String(referrer_url) : null,
    });

    if (error) {
      console.error("[/api/audit/leads] Capture lead error:", error);
      return NextResponse.json(
        { error: "Failed to save your information" },
        { status: 500 },
      );
    }

    // Link lead_id back to audit
    if (leadId) {
      await updateAuditRecord(String(audit_id), { lead_id: leadId });
    }

    // ──────────────────────────────────────────────────────────────────────
    // UPDATE TENANT'S BRAND_CONFIG WITH CAPTURED CONTACT INFO
    // ──────────────────────────────────────────────────────────────────────
    try {
      const waasClient = createWaasClient();

      // Find tenant by audit
      const { data: audit } = (await waasClient
        .from("audits")
        .select("tenant_id, id")
        .eq("id", String(audit_id))
        .single()) as {
        data: Pick<WaasAudit, "tenant_id" | "id"> | null;
        error: any;
      };

      let tenantId = audit?.tenant_id;

      // If no tenant_id on audit, try to find by source_audit_id
      if (!tenantId) {
        const { data: tenantByAudit } = (await waasClient
          .from("tenants")
          .select("id")
          .eq("source_audit_id", String(audit_id))
          .single()) as { data: Pick<WaasTenant, "id"> | null; error: any };
        tenantId = tenantByAudit?.id;
      }

      // Update tenant's brand_config if found
      if (tenantId) {
        const { data: tenant } = (await waasClient
          .from("tenants")
          .select("brand_config")
          .eq("id", tenantId)
          .single()) as {
          data: Pick<WaasTenant, "brand_config"> | null;
          error: any;
        };

        const currentBrandConfig =
          (tenant as { brand_config: Record<string, unknown> } | null)
            ?.brand_config ?? {};
        const currentContact =
          (currentBrandConfig.contact as Record<string, unknown> | null) ?? {};

        const updatedBrandConfig = {
          ...currentBrandConfig,
          contact: {
            ...currentContact,
            name: name || currentContact.name,
            email: email,
            phone: normalizedPhone || currentContact.phone,
            company: company || currentContact.company,
          },
          pdf_download_at: new Date().toISOString(),
          pdf_downloads:
            ((currentBrandConfig.pdf_downloads as number) ?? 0) + 1,
        };

        await (waasClient.from("tenants") as any)
          .update({
            brand_config: updatedBrandConfig,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);

        console.log(
          "[/api/audit/leads] Updated tenant",
          tenantId,
          "with contact info from PDF download",
        );
      }
    } catch (tenantErr) {
      // Log but don't fail the response
      console.error(
        "[/api/audit/leads] Failed to update tenant brand_config:",
        tenantErr,
      );
    }

    return NextResponse.json(
      {
        success: true,
        lead_id: leadId,
        message: "Report will be sent to your email shortly.",
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[/api/audit/leads] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
