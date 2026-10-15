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
import { auditStatusCacheControl } from "@/lib/waas/audit-http";

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

    // The response carries report_data and is authorized per caller (a share
    // token or a signed-in matching email), so it must never be stored by a
    // shared cache. A `public` directive here would let one caller's report be
    // served to another.
    const headers: Record<string, string> = {
      "Cache-Control": auditStatusCacheControl(),
    };

    return NextResponse.json(result, { headers });
  } catch (err) {
    console.error("[WaaS API] GET /audits/[id]/status exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
