// =============================================================================
// /audit/[auditId] — Live Audit Report Dashboard
// "Boardroom Ready" — Red vs Green theme, polling, full SEO report
// Auth Required: platform admin, tenant owner, the report addressee, or an
// anonymous prospect audit (reached via its unguessable id).
// =============================================================================

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuditReportClient } from "./client";
import { getWaasAdminClient } from "@/lib/waas/supabase";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { canViewAudit } from "@/lib/waas/audit-access";
import type { WaasAuditRow as WaasAudit } from "@/lib/waas/supabase";
import { extractAuditIdFromRouteParam } from "@/lib/waas/utils/audit-report-url";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Your SEO Audit Report | RankedCEO",
  description:
    "See how your site ranks against competitors. Full Google ranking analysis, PageSpeed scores, and gap analysis — powered by RankedCEO.",
  robots: "noindex, nofollow", // private audit reports should not be indexed
};

// ---------------------------------------------------------------------------
// Page (server component — initial data fetch)
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ auditId: string }>;
}

export default async function AuditReportPage({ params }: PageProps) {
  const { auditId: rawAuditParam } = await params;
  const auditId = extractAuditIdFromRouteParam(rawAuditParam);

  // Backward-compatible: accepts UUID only or slug-UUID path segment.
  if (!auditId) {
    notFound();
  }

  // Check authentication
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect(`/audit/login?redirectTo=/audit/${auditId}`);
  }

  // Fetch audit from Supabase. Use the service-role client: the anon role no
  // longer has SELECT on audits (the audits_anon_read_own policy is dropped),
  // so server reads must bypass RLS. Access is enforced below.
  const waasClient = getWaasAdminClient();
  const { data, error } = await waasClient
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .single();

  if (error || !data) {
    notFound();
  }

  const audit = data as WaasAudit;

  // Access control: platform admins, tenant owners, the report addressee, or an
  // anonymous prospect audit reached via its unguessable id.
  const isAdmin = await isPlatformAdmin(authClient, user);

  let ownsTenant = false;
  if (audit.tenant_id && user.email) {
    // If the audit is linked to a tenant, verify the user is associated with it.
    const { data: tenant } = await waasClient
      .from("tenants")
      .select("id")
      .eq("id", audit.tenant_id)
      .eq("submitted_by_email", user.email)
      .maybeSingle();

    ownsTenant = Boolean(tenant);
  }

  if (!canViewAudit(audit, user, { isAdmin, ownsTenant })) {
    notFound();
  }

  return (
    <AuditReportClient
      audit={audit}
      userEmail={user.email ?? undefined}
      userName={user.user_metadata?.full_name ?? undefined}
    />
  );
}
