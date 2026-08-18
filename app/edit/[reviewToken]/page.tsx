// =============================================================================
// app/edit/[reviewToken]/page.tsx
// Client self-service editor — server entry point.
//
// Phase 6.1: Added portal home (Overview tab).
// Phase 8.2: Added Billing tab (?tab=billing) + checkout success redirect.
//
//   ?tab=overview  → PortalHome (default when tab is absent or 'overview')
//   ?tab=edit      → EditorShell (full editor)
//   ?tab=history   → EditorShell with history panel open
//   ?tab=billing   → BillingTab (plan, invoices, upgrade)
//
// Resolves the review token, loads the selected variant, builds the editable
// field list, and hands the data to the appropriate shell component.
// =============================================================================

import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import type { ClientEditSession } from "@/lib/waas/client-edit/edit-session";
import { buildEditableFields } from "@/lib/waas/client-edit/editable-fields";
import {
  getTenantPortalData,
  getTenantAuditHistory,
} from "@/lib/waas/actions/client-edit";
import { getTenantBillingStatus } from "@/lib/waas/actions/billing";
import { PortalShell } from "./portal-shell";
import type { SectionConfig } from "@/lib/waas/templates/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ reviewToken: string }>;
  searchParams: Promise<{ tab?: string; checkout?: string; approve?: string }>;
}
// ---------------------------------------------------------------------------
// Server-only helper: load sections_json for the currently-selected variant
// ---------------------------------------------------------------------------

async function loadSelectedVariantSections(
  tenantId: string,
  variantIndex: number | null,
): Promise<SectionConfig[]> {
  if (variantIndex == null) return [];

  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row } = await supabase
    .from("tenant_site_variants")
    .select("sections_json")
    .eq("tenant_id", tenantId)
    .eq("variant_index", variantIndex)
    .single();

  if (!row) return [];

  const sections = (row as { sections_json: unknown }).sections_json;
  return Array.isArray(sections) ? (sections as SectionConfig[]) : [];
}

// ---------------------------------------------------------------------------
// Shared session shape (used in all tab branches)
// ---------------------------------------------------------------------------

function buildSessionShape(session: ClientEditSession) {
  return {
    tenantId: session.tenantId,
    slug: session.slug,
    businessName: session.businessName,
    reviewToken: session.reviewToken,
    selectedVariantIndex: session.selectedVariantIndex,
    selectedTemplateSlug: session.selectedTemplateSlug,
    permissions: session.permissions,
    approvalAt: session.approvalAt,
    approvalLocked: session.approvalLocked,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ClientEditorPage({
  params,
  searchParams,
}: PageProps) {
  const { reviewToken } = await params;
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams?.tab ?? "overview";
  const checkoutSuccess = resolvedSearchParams?.checkout === "success";
  const autoOpenApproval = resolvedSearchParams?.approve === "1";

  const result = await resolveClientEditSession(reviewToken);
  if (!result.ok) {
    console.error("[ClientEditorPage] resolveClientEditSession failed:", {
      reason: result.reason,
      message: result.message,
      tokenPrefix: reviewToken?.slice(0, 8),
      waasUrl: process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL?.slice(0, 40),
      hasServiceKey: !!process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY,
    });
    notFound();
  }

  const session = result.session;
  const sessionShape = buildSessionShape(session);

  // ------------------------------------------------------------------
  // Tab: billing — load billing status and render BillingTab
  // ------------------------------------------------------------------
  if (tab === "billing") {
    const billingResult = await getTenantBillingStatus(session.tenantId);

    return (
      <PortalShell
        session={sessionShape}
        portalData={null}
        activeTab="billing"
        billingStatus={
          billingResult.success ? (billingResult.data ?? null) : null
        }
        checkoutSuccess={checkoutSuccess}
      />
    );
  }

  // ------------------------------------------------------------------
  // Tab: audits — load audit history
  // ------------------------------------------------------------------
  if (tab === "audits") {
    const auditsResult = await getTenantAuditHistory(reviewToken);

    return (
      <PortalShell
        session={sessionShape}
        portalData={null}
        activeTab="audits"
        auditHistory={auditsResult.success ? (auditsResult.data ?? []) : []}
      />
    );
  }

  // ------------------------------------------------------------------
  // Tab: overview — load portal data (lightweight) and show portal home
  // ------------------------------------------------------------------
  if (tab === "overview") {
    const portalResult = await getTenantPortalData(reviewToken);

    return (
      <PortalShell
        session={sessionShape}
        portalData={portalResult.success ? (portalResult.data ?? null) : null}
        activeTab="overview"
      />
    );
  }

  // ------------------------------------------------------------------
  // Tab: edit or history — load sections + billing and show the editor shell
  // ------------------------------------------------------------------
  const [sections, billingResult] = await Promise.all([
    loadSelectedVariantSections(session.tenantId, session.selectedVariantIndex),
    getTenantBillingStatus(session.tenantId),
  ]);

  const editableFields = buildEditableFields({
    sections,
    brandConfig: session.brandConfig,
  });

  return (
    <PortalShell
      session={sessionShape}
      portalData={null}
      activeTab={tab === "history" ? "history" : "edit"}
      billingStatus={
        billingResult.success ? (billingResult.data ?? null) : null
      }
      autoOpenApproval={autoOpenApproval}
      editorProps={{ initialFields: editableFields }}
    />
  );
}
