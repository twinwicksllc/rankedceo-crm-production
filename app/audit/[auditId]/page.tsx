// =============================================================================
// /audit/[auditId] — Live Audit Report Dashboard
// "Boardroom Ready" — Red vs Green theme, polling, full SEO report
//
// Access (decision D1=A): platform admin, tenant owner, a valid share token
// (`?token=`), or a signed-in user whose email matches the report addressee.
// The share token is a capability link: it opens the report without sign-in,
// which is how the prospect reaches the report right after running the audit
// (before any email is captured).
// =============================================================================

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuditReportClient } from "./client";
import { getWaasAdminClient } from "@/lib/waas/supabase";
import { createClient } from "@/lib/supabase/server";
import { authorizeAuditAccess } from "@/lib/waas/audit-access-server";
import { verifyAuditToken } from "@/lib/waas/audit-share-token";
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
  searchParams: Promise<{ token?: string }>;
}

export default async function AuditReportPage({ params, searchParams }: PageProps) {
  const { auditId: rawAuditParam } = await params;
  const { token } = await searchParams;
  const auditId = extractAuditIdFromRouteParam(rawAuditParam);

  // Backward-compatible: accepts UUID only or slug-UUID path segment.
  if (!auditId) {
    notFound();
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  // A valid share token is a capability: it opens the report without sign-in.
  const hasValidToken = verifyAuditToken(auditId, token);

  if (!user && !hasValidToken) {
    const redirectTo = `/audit/${auditId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    redirect(`/audit/login?redirectTo=${encodeURIComponent(redirectTo)}`);
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

  // Access control: admin, tenant owner, valid token, or matching email.
  const { allowed } = await authorizeAuditAccess({
    auditId,
    token,
    user,
    authClient,
    audit,
  });

  if (!allowed) {
    notFound();
  }

  return (
    <AuditReportClient
      audit={audit}
      userEmail={user?.email ?? undefined}
      userName={user?.user_metadata?.full_name ?? undefined}
      shareToken={hasValidToken ? (token ?? undefined) : undefined}
    />
  );
}
