"use server";

import type {
  OnboardingStep1Data,
  OnboardingStep2Data,
  DomainWishlistItem,
} from "@/lib/waas/types";
import {
  getRawClient,
  updateTenantWithFallback,
  insertTenantWithFallback,
  isMissingSchemaTable,
} from "./_shared";
import type { ActionResult } from "./_shared";
import { extractAuditDataForPreFill } from "./audit";

// ---------------------------------------------------------------------------
// Step 1: Save Business Identity
// ---------------------------------------------------------------------------

export async function saveOnboardingStep1(
  tenantId: string | null,
  data: OnboardingStep1Data,
  auditId?: string | null,
  email?: string | null,
): Promise<ActionResult<{ tenantId: string }>> {
  try {
    const supabase = getRawClient();

    // Generate a slug from the legal name
    const slug =
      data.legal_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50) +
      "-" +
      Math.random().toString(36).substring(2, 7);

    const locationLabel = `${data.city}, ${data.state}`;

    // Extract audit data to pre-fill builder fields
    const { audit_enhancements } = await extractAuditDataForPreFill(auditId);

    const baseBrandConfig = {
      business_name: data.legal_name,
      tagline: data.tagline || null,
      colors: {
        primary: "#2563EB",
        secondary: "#1E40AF",
        accent: "#DBEAFE",
        background: "#FFFFFF",
        text: "#111827",
      },
      contact: {
        email: email ?? null,
        phone: data.phone || null,
        address: data.physical_address,
        city: data.city,
        state: data.state,
        zip: data.zip,
      },
      intake_profile: {
        business_type: data.business_type || null,
        services_offered: data.services_offered || null,
        business_hours: data.business_hours || null,
        target_audience: data.target_audience || null,
        primary_trade: data.primary_trade,
      },
    };

    // Merge audit enhancements if available
    const brand_config = audit_enhancements
      ? { ...baseBrandConfig, ...audit_enhancements }
      : baseBrandConfig;

    const payload = {
      legal_name: data.legal_name,
      physical_address: data.physical_address,
      primary_trade: data.primary_trade,
      target_industry: data.primary_trade,
      target_location: locationLabel,
      source_audit_id: auditId ?? null,
      submitted_by_email: email ?? null,
      status: "onboarding",
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
      brand_config,
    };

    if (tenantId) {
      // Update existing tenant
      const { error } = await updateTenantWithFallback(
        supabase,
        tenantId,
        payload,
      );
      if (error) return { success: false, error: error.message };
      return { success: true, data: { tenantId } };
    } else {
      // Create new tenant
      const { id, error } = await insertTenantWithFallback(supabase, {
        ...payload,
        slug,
        package_tier: "standard",
      });
      if (error || !id)
        return {
          success: false,
          error: error?.message ?? "Tenant insert failed",
        };
      return { success: true, data: { tenantId: id } };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Save Domain Wishlist
// ---------------------------------------------------------------------------

export async function saveOnboardingStep2(
  tenantId: string,
  data: OnboardingStep2Data,
): Promise<ActionResult> {
  try {
    const supabase = getRawClient();

    // Always persist wishlist in tenant config so onboarding works even when
    // optional domain_requests migration has not been applied in an environment.
    const { data: tenantSnapshot } = await supabase
      .from("tenants")
      .select("brand_config")
      .eq("id", tenantId)
      .single();

    const existingBrandConfig =
      (tenantSnapshot as { brand_config: Record<string, unknown> } | null)
        ?.brand_config ?? {};
    const normalizedWishlist = data.domains.map((d: DomainWishlistItem) => ({
      domain_name: d.domain_name,
      extension: d.extension,
      priority: d.priority,
      full_domain: `${d.domain_name}${d.extension}`,
      status: "requested",
    }));

    const { error: wishlistPersistError } = await updateTenantWithFallback(
      supabase,
      tenantId,
      {
        brand_config: {
          ...existingBrandConfig,
          domain_wishlist: normalizedWishlist,
        },
        updated_at: new Date().toISOString(),
      },
    );

    if (wishlistPersistError) {
      return { success: false, error: wishlistPersistError.message };
    }

    // Delete existing domain requests for this tenant (in case of re-submission)
    const { error: deleteError } = await supabase
      .from("domain_requests")
      .delete()
      .eq("tenant_id", tenantId);
    if (
      deleteError &&
      !isMissingSchemaTable(deleteError.message, "domain_requests")
    ) {
      return { success: false, error: deleteError.message };
    }

    // Insert new domain requests
    const requests = data.domains.map((d: DomainWishlistItem) => ({
      tenant_id: tenantId,
      domain_name: d.domain_name,
      extension: d.extension,
      priority: d.priority,
      status: "requested",
    }));

    if (requests.length > 0) {
      const { error } = await supabase.from("domain_requests").insert(requests);
      if (error && !isMissingSchemaTable(error.message, "domain_requests")) {
        return { success: false, error: error.message };
      }
    }

    // Advance onboarding step
    const { error: tenantUpdateError } = await updateTenantWithFallback(
      supabase,
      tenantId,
      {
        onboarding_step: 3,
        updated_at: new Date().toISOString(),
      },
    );

    if (tenantUpdateError) {
      return { success: false, error: tenantUpdateError.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Step 3: Save Brand Identity (colors + logo URL after client-side upload)
// ---------------------------------------------------------------------------

export async function saveOnboardingStep3(
  tenantId: string,
  primaryColor: string,
  secondaryColor: string,
  textColor: string,
  logoUrl: string | null,
  businessName: string,
): Promise<ActionResult> {
  try {
    const supabase = getRawClient();

    // Fetch existing brand_config to merge
    const { data: tenant } = await supabase
      .from("tenants")
      .select("brand_config")
      .eq("id", tenantId)
      .single();

    const existingConfig =
      (tenant as { brand_config: Record<string, unknown> } | null)
        ?.brand_config ?? {};

    const updatedBrandConfig = {
      ...existingConfig,
      business_name: businessName,
      logo_url: logoUrl,
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        accent: primaryColor + "33", // 20% opacity version of primary
        background: "#FFFFFF",
        text: textColor,
      },
    };

    const { error } = await updateTenantWithFallback(supabase, tenantId, {
      brand_config: updatedBrandConfig,
      onboarding_step: 4,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
