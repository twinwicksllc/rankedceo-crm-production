// =============================================================================
// Tenant lead intake (B5): the logic behind the lead form on a customer's site.
//
// Kept free of Next.js and Supabase imports so every branch can be tested with
// fake dependencies. lib/waas/actions/tenant-lead.ts supplies the real ones.
//
// The tenant is never taken from the request alone: the browser sends the
// tenant id plus a token the server signed when it rendered the site, and the
// tenant must be live (status "active"). The tenant id written to the lead is
// the verified one.
// =============================================================================

import { verifySiteLeadToken } from "../lead-form-token";
import { validateTenantLeadInput } from "../validation/tenant-lead";
import {
  RATE_LIMITS,
  RATE_WINDOW_MS,
  checkSpamSignals,
  hashIp,
  isRateLimited,
} from "./tenant-lead-guard";

export interface TenantLeadRow {
  tenant_id: string;
  source: "tenant_site";
  status: "new";
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  service_requested: string | null;
  page_url: string | null;
  ip_hash: string | null;
}

export interface TenantLeadDeps {
  now: () => number;
  loadTenant: (
    id: string,
  ) => Promise<{ id: string; status: string; businessName: string } | null>;
  countRecent: (
    tenantId: string,
    keys: { ipHash: string | null; email: string },
    sinceIso: string,
  ) => Promise<{ ip: number; email: number; tenant: number }>;
  insertLead: (row: TenantLeadRow) => Promise<{ id: string } | null>;
  /** Fire-and-forget email to the tenant. Failures must not reach the visitor. */
  notify: (args: {
    tenantId: string;
    leadId: string;
    businessName: string;
    lead: TenantLeadRow;
  }) => Promise<void>;
}

export type TenantLeadResult =
  | { ok: true }
  | {
      ok: false;
      code: "invalid" | "unavailable" | "rate_limited" | "error";
      error: string;
      fieldErrors?: Record<string, string>;
    };

const UNAVAILABLE =
  "This form is not available right now. Please call us instead.";

export async function processTenantLead(
  input: unknown,
  ctx: { ip: string | null },
  deps: TenantLeadDeps,
): Promise<TenantLeadResult> {
  const validation = validateTenantLeadInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      code: "invalid",
      error: "Please check the highlighted fields.",
      fieldErrors: validation.fieldErrors,
    };
  }
  const data = validation.data;
  const now = deps.now();

  // Bots get a fake success: nothing stored, nothing to retry against.
  if (
    checkSpamSignals({ website: data.website, shownAt: data.shownAt, now }) ===
    "bot"
  ) {
    return { ok: true };
  }

  if (!verifySiteLeadToken(data.tenantId, data.siteToken)) {
    return { ok: false, code: "unavailable", error: UNAVAILABLE };
  }

  const tenant = await deps.loadTenant(data.tenantId);
  if (!tenant || tenant.status !== "active") {
    return { ok: false, code: "unavailable", error: UNAVAILABLE };
  }

  const ipHash = hashIp(ctx.ip, tenant.id);
  const counts = await deps.countRecent(
    tenant.id,
    { ipHash, email: data.email },
    new Date(now - RATE_WINDOW_MS).toISOString(),
  );
  if (isRateLimited(counts)) {
    return {
      ok: false,
      code: "rate_limited",
      error:
        "You have sent several messages recently. Please try again later or call us.",
    };
  }

  const row: TenantLeadRow = {
    tenant_id: tenant.id, // the verified tenant, never the raw request value
    source: "tenant_site",
    status: "new",
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    message: data.message ?? null,
    service_requested: data.service ?? null,
    page_url: data.pageUrl ?? null,
    ip_hash: ipHash,
  };
  const saved = await deps.insertLead(row);
  if (!saved) {
    return {
      ok: false,
      code: "error",
      error: "We could not send your message. Please call us instead.",
    };
  }

  // The lead is saved. Email is best effort, and skipped during a flood.
  if (counts.tenant < RATE_LIMITS.perTenantEmails) {
    try {
      await deps.notify({
        tenantId: tenant.id,
        leadId: saved.id,
        businessName: tenant.businessName,
        lead: row,
      });
    } catch (err) {
      console.error("[tenant-lead] notification failed:", String(err).slice(0, 200));
    }
  }

  return { ok: true };
}
