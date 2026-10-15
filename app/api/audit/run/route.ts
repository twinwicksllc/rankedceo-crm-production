// =============================================================================
// POST /api/audit/run
// Main audit runner — accepts target + competitor URLs, runs the full engine,
// saves results to the WaaS Supabase audits table.
// Public endpoint (no auth required) — rate limiting via Supabase RLS.
// =============================================================================

import { NextRequest, NextResponse, after } from "next/server";
import { createAuditRecord, updateAuditRecord } from "@/lib/waas/supabase";
import { signAuditToken } from "@/lib/waas/audit-share-token";
import type { WaasAuditInsert } from "@/lib/waas/supabase";
import type { AuditSeoProvider } from "@/lib/waas/types";
import { runAuditJob } from "@/lib/waas/services/audit-jobs";
import { createClient } from "@/lib/supabase/server";
import { authorizeAuditAccess } from "@/lib/waas/audit-access-server";

const AUDIT_EXPIRY_DAYS = 30;

// Initiative 6 (async audit processing): maxDuration now bounds the background
// job lifetime, not the request. The request returns immediately with a
// pending status. Tune this against real p95 measurements from the job logs.
export const maxDuration = 90;

// ---------------------------------------------------------------------------
// POST /api/audit/run
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const {
      target_url,
      competitor_urls,
      industry,
      location,
      requestor_name,
      requestor_email,
      requestor_phone,
      requestor_company,
      audit_id,
      skip_cache,
      token,
    } = body;

    // ── Validate inputs ────────────────────────────────────────────────────
    if (!target_url?.trim()) {
      return NextResponse.json(
        { error: "target_url is required" },
        { status: 400 },
      );
    }

    const normalizeUrl = (url: string) =>
      url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;

    const normalizedTarget = normalizeUrl(String(target_url));
    const normalizedCompetitors = ((competitor_urls ?? []) as unknown[])
      .filter(Boolean)
      .slice(0, 3)
      .map((u) => normalizeUrl(String(u)));

    try {
      new URL(normalizedTarget);
    } catch {
      return NextResponse.json(
        { error: "target_url must be a valid URL" },
        { status: 400 },
      );
    }

    if (normalizedCompetitors.length === 0) {
      return NextResponse.json(
        { error: "At least one competitor_url is required" },
        { status: 400 },
      );
    }

    // ── Check cache for recent identical audit (within 24 hours) ───────────────
    // Skip if skip_cache flag is explicitly set (allows force refresh)
    const { getRecentAuditRecord } = await import("@/lib/waas/supabase");
    if (!skip_cache && !audit_id && process.env.WAAS_SEO_PROVIDER !== 'mock') {
      const cachedId = await getRecentAuditRecord(
        normalizedTarget,
        normalizedCompetitors,
        location ? String(location) : null,
        requestor_email ? String(requestor_email) : null,
      );
      if (cachedId) {
        console.log(`[WaaS] Returning cached audit ${cachedId} for ${normalizedTarget}`);
        const cachedToken = signAuditToken(cachedId);
        // The status route is access-controlled, so the poll URL must carry the
        // same capability token or the client's polling would 403.
        const cachedPollUrl = `/api/waas/audits/${cachedId}/status${
          cachedToken ? `?token=${encodeURIComponent(cachedToken)}` : ""
        }`;
        return NextResponse.json(
          {
            audit_id: cachedId,
            token: cachedToken,
            status: "completed",
            message: "Audit is ready",
            poll_url: cachedPollUrl,
          },
          { status: 200 }
        );
      }
    }

    // ── Create or update audit record (status: running) ──────────────────
    let auditId: string | null = audit_id ? String(audit_id) : null;

    if (auditId) {
      // Re-running an existing audit is a mutation and the response carries a
      // share token, so the caller must be allowed to read this audit first
      // (valid share token, matching signed-in email, tenant owner, or admin).
      // Without this, anyone could reset and re-sign an arbitrary audit id.
      const authClient = await createClient();
      const {
        data: { user },
      } = await authClient.auth.getUser();
      const access = await authorizeAuditAccess({
        auditId,
        token: token ? String(token) : null,
        user,
        authClient,
      });
      if (!access.audit) {
        return NextResponse.json({ error: "Audit not found" }, { status: 404 });
      }
      if (!access.allowed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      await updateAuditRecord(auditId, {
        status: "pending",
        started_at: new Date().toISOString(),
      });
    } else {
      const insert: WaasAuditInsert = {
        audit_type: "prospect",
        status: "pending",
        target_url: normalizedTarget,
        competitor_urls: normalizedCompetitors,
        requestor_name: requestor_name ? String(requestor_name) : null,
        requestor_email: requestor_email ? String(requestor_email) : null,
        requestor_phone: requestor_phone ? String(requestor_phone) : null,
        requestor_company: requestor_company ? String(requestor_company) : null,
        started_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + AUDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        seo_provider: (process.env.WAAS_SEO_PROVIDER ??
          "serper") as AuditSeoProvider,
      };

      auditId = await createAuditRecord(insert);

      if (!auditId) {
        return NextResponse.json(
          { error: "Failed to initialize audit record" },
          { status: 500 },
        );
      }
    }

    // ── Dispatch async audit job ────────────────────────────────────────
    // Note: auditId is guaranteed non-null here (checked at line 122-127)
    after(() =>
      runAuditJob(auditId as string, {
        targetUrl: normalizedTarget,
        competitorUrls: normalizedCompetitors,
        industry: industry ? String(industry) : null,
        location: location ? String(location) : null,
        requestorName: requestor_name ? String(requestor_name) : null,
        requestorEmail: requestor_email ? String(requestor_email) : null,
        requestorPhone: requestor_phone ? String(requestor_phone) : null,
        requestorCompany: requestor_company ? String(requestor_company) : null,
      }),
    );

    const newToken = signAuditToken(auditId);
    // The status route is access-controlled, so the poll URL must carry the
    // same capability token or the client's polling would 403.
    const pollUrl = `/api/waas/audits/${auditId}/status${
      newToken ? `?token=${encodeURIComponent(newToken)}` : ""
    }`;

    return NextResponse.json(
      {
        audit_id: auditId,
        token: newToken,
        status: "pending",
        poll_url: pollUrl,
      },
      { status: 202 },
    );
  } catch (err) {
    console.error("[/api/audit/run] Unhandled exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

