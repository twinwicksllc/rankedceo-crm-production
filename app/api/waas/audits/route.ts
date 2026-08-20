// =============================================================================
// WaaS API: Audits
// GET  /api/waas/audits        — List audits (admin: all, public: by email token)
//
// Initiative 3 (docs/waas/AUDIT_TO_WEBSITE_FLOW_RECOMMENDATIONS.md): the
// POST handler that used to live here was dormant — it created an audit
// record but never triggered the SEO engine (a `// TODO (Phase 2)` that was
// never picked up). The live, working audit-creation path is
// /api/audit/run/route.ts, and prospect->tenant conversion now goes through
// /api/audit/[auditId]/create-tenant/route.ts. Removed rather than finished:
// grepped the repo for any caller of POST /api/waas/audits and found none —
// only this doc history and the GET-based status polling route reference
// the path. Two working audit-creation endpoints were confusing; now there
// is exactly one.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getWaasAdminClient } from "@/lib/waas/supabase";

async function getCrmUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ---------------------------------------------------------------------------
// GET /api/waas/audits
// Admin: all audits. Optional ?tenant_id= and ?status= filters.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCrmUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");
    const status = searchParams.get("status");
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10),
      200,
    );

    const waas = getWaasAdminClient();
    let query = waas
      .from("audits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      console.error("[WaaS API] List audits error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ audits: data, count: data?.length ?? 0 });
  } catch (err) {
    console.error("[WaaS API] GET /audits exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
