// =============================================================================
// WaaS API: Audit Status Polling
// GET /api/waas/audits/[id]/status — polling endpoint used by the report client.
//
// Access (decision D1=A): the response includes report_data, so it is not
// public. A valid share token (`?token=`) opens it without sign-in; otherwise a
// platform admin, tenant owner, or the signed-in report addressee is required.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getAuditStatus } from "@/lib/waas/supabase";
import { createClient } from "@/lib/supabase/server";
import { authorizeAuditAccess } from "@/lib/waas/audit-access-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Audit ID is required" },
        { status: 400 },
      );
    }

    const token = req.nextUrl.searchParams.get("token");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    const access = await authorizeAuditAccess({
      auditId: id,
      token,
      user,
      authClient,
    });

    if (!access.audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await getAuditStatus(id);

    if (!result) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    // Set cache headers based on status
    const headers: Record<string, string> = {};

    if (result.status === "completed") {
      // Cache completed audits for 5 minutes (they don't change)
      headers["Cache-Control"] =
        "public, max-age=300, stale-while-revalidate=600";
    } else if (result.status === "pending" || result.status === "running") {
      // Don't cache in-progress audits — client is polling
      headers["Cache-Control"] = "no-store";
    } else {
      headers["Cache-Control"] = "public, max-age=60";
    }

    return NextResponse.json(result, { headers });
  } catch (err) {
    console.error("[WaaS API] GET /audits/[id]/status exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
