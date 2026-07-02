// =============================================================================
// app/api/waas/webhooks/stripe/route.ts
// Phase 7.4: WaaS Stripe Webhook Handler
// Phase 8.3: Added billing lifecycle email notifications
//
// POST /api/waas/webhooks/stripe
//
// Receives Stripe lifecycle events for WaaS subscriptions and updates the
// `tenants` table accordingly. This is a separate webhook endpoint from
// the CRM webhook (/api/stripe/webhook) — register it separately in the
// Stripe Dashboard with a dedicated signing secret (WAAS_STRIPE_WEBHOOK_SECRET).
//
// Events handled:
//   checkout.session.completed      — new subscription created via Checkout
//   customer.subscription.updated   — plan changed, interval changed, status change
//   customer.subscription.deleted   — subscription cancelled / expired
//   invoice.payment_failed          — subscription payment failed
//
// Email notifications sent (Phase 8.3):
//   checkout.session.completed      → subscription_activated to tenant
//   customer.subscription.updated   → plan_changed to tenant (when tier changes)
//   invoice.payment_failed          → payment_failed to tenant
//
// Security:
//   - Signature verified with WAAS_STRIPE_WEBHOOK_SECRET
//   - Tenant lookup by stripe_customer_id (set on checkout.session.completed)
//   - All mutations are idempotent (upsert-style, safe for event replays)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendTenantNotification } from "@/lib/waas/services/notifications";
import { WAAS_PLAN_DISPLAY } from "@/lib/waas/billing-config";
import type { WaasPackageTier } from "@/lib/waas/types";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-02-25.clover", typescript: true });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("WaaS Supabase admin env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Derive WaasPackageTier from Stripe price ID
// ---------------------------------------------------------------------------

function tierFromPriceId(priceId: string | null): WaasPackageTier | null {
  if (!priceId) return null;
  const standardMonthly = process.env.WAAS_STRIPE_PRICE_STANDARD_MONTHLY;
  const standardYearly = process.env.WAAS_STRIPE_PRICE_STANDARD_YEARLY;
  const premiumMonthly = process.env.WAAS_STRIPE_PRICE_PREMIUM_MONTHLY;
  const premiumYearly = process.env.WAAS_STRIPE_PRICE_PREMIUM_YEARLY;
  const hostingOnly = process.env.WAAS_STRIPE_PRICE_HOSTING_ONLY;
  if (priceId === standardMonthly || priceId === standardYearly)
    return "standard";
  if (priceId === premiumMonthly || priceId === premiumYearly) return "premium";
  if (priceId === hostingOnly) return "hosting_only";
  return null; // unknown price — don't overwrite tier
}

// ---------------------------------------------------------------------------
// Plan display helpers
// ---------------------------------------------------------------------------

function planLabel(tier: WaasPackageTier | null): string {
  if (!tier) return "your plan";
  return WAAS_PLAN_DISPLAY[tier]?.label ?? tier;
}

function planPriceString(
  tier: WaasPackageTier | null,
  interval: "month" | "year" | null,
): string {
  if (!tier || !interval) return "";
  const display = WAAS_PLAN_DISPLAY[tier];
  if (!display) return "";
  if (interval === "year") return `$${display.yearlyPrice}/yr`;
  if (interval === "month") return `$${display.monthlyPrice}/mo`;
  return "";
}

// ---------------------------------------------------------------------------
// Tenant lookup helpers
// ---------------------------------------------------------------------------

interface TenantRow {
  id: string;
  brand_config: {
    business_name?: string;
    contact?: { email?: string | null };
  } | null;
  package_tier: string;
  plan_interval: string | null;
}

async function getTenantByCustomerId(
  customerId: string,
): Promise<TenantRow | null> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, brand_config, package_tier, plan_interval")
    .eq("stripe_customer_id", customerId)
    .single();
  return (data as TenantRow | null) ?? null;
}

async function getTenantById(tenantId: string): Promise<TenantRow | null> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, brand_config, package_tier, plan_interval")
    .eq("id", tenantId)
    .single();
  return (data as TenantRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Update tenant billing fields by customer_id
// ---------------------------------------------------------------------------

async function updateTenantByCustomerId(
  customerId: string,
  fields: Partial<{
    stripe_subscription_id: string | null;
    package_tier: string;
    plan_interval: string | null;
    stripe_customer_id: string;
  }>,
): Promise<{ updated: boolean; tenantId: string | null }> {
  const supabase = getAdminClient();

  const { data: row } = await supabase
    .from("tenants")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!row) {
    console.warn(`[WaaS Webhook] No tenant found for customer ${customerId}`);
    return { updated: false, tenantId: null };
  }

  const tenant = row as { id: string };

  const { error } = await supabase
    .from("tenants")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", tenant.id);

  if (error) {
    console.error(
      `[WaaS Webhook] DB update error for tenant ${tenant.id}:`,
      error.message,
    );
    return { updated: false, tenantId: tenant.id };
  }

  return { updated: true, tenantId: tenant.id };
}

// ---------------------------------------------------------------------------
// Send notification — fire-and-forget (never block webhook response)
// ---------------------------------------------------------------------------

function notifyAsync(fn: () => Promise<void>): void {
  fn().catch((err) => {
    console.error(
      "[WaaS Webhook] Notification error:",
      err instanceof Error ? err.message : String(err),
    );
  });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.WAAS_STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[WaaS Webhook] WAAS_STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WaaS Webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 },
    );
  }

  console.log(`[WaaS Webhook] Event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // New subscription created via Checkout
      // -----------------------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const tenantId = session.metadata?.waas_tenant_id;
        const tier = (session.metadata?.package_tier ??
          null) as WaasPackageTier | null;
        const interval = (session.metadata?.plan_interval ?? null) as
          "month" | "year" | null;

        if (!customerId || !subscriptionId || !tenantId) {
          console.warn(
            "[WaaS Webhook] checkout.session.completed missing required fields",
            { customerId, subscriptionId, tenantId },
          );
          break;
        }

        const supabase = getAdminClient();
        const { error } = await supabase
          .from("tenants")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            package_tier: tier ?? undefined,
            plan_interval: interval,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);

        if (error) {
          console.error(
            "[WaaS Webhook] checkout.session.completed DB error:",
            error.message,
          );
        } else {
          console.log(
            `[WaaS Webhook] Tenant ${tenantId} subscribed → ${tier} (${interval})`,
          );
        }

        // --- Email: subscription_activated ---
        notifyAsync(async () => {
          const tenant = await getTenantById(tenantId);
          if (!tenant) return;
          const businessName =
            (tenant.brand_config as { business_name?: string } | null)
              ?.business_name ?? undefined;
          const email =
            (
              tenant.brand_config as {
                contact?: { email?: string | null };
              } | null
            )?.contact?.email ?? undefined;
          await sendTenantNotification({
            type: "subscription_activated",
            tenantId,
            data: {
              businessName,
              planLabel: planLabel(tier),
              planInterval:
                interval === "year"
                  ? "annual"
                  : interval === "month"
                    ? "monthly"
                    : undefined,
              planPrice: planPriceString(tier, interval),
              portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/edit`,
            },
            recipientEmail: email,
            dedupKey: `subscription_activated:${subscriptionId}`,
          });
        });
        break;
      }

      // -----------------------------------------------------------------------
      // Subscription updated (plan change, interval change, reactivated)
      // -----------------------------------------------------------------------
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        // Fetch current tenant state BEFORE update (for plan_changed diff)
        const tenantBefore = await getTenantByCustomerId(customerId);
        const oldTier = (tenantBefore?.package_tier ??
          null) as WaasPackageTier | null;

        // Derive new tier and interval from subscription items
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const newTier = tierFromPriceId(priceId);
        const newInterval =
          sub.items.data[0]?.price?.recurring?.interval === "year"
            ? ("year" as const)
            : sub.items.data[0]?.price?.recurring?.interval === "month"
              ? ("month" as const)
              : null;

        const updateFields: Record<string, string | null> = {
          stripe_subscription_id: sub.id,
          plan_interval: newInterval,
        };
        if (newTier) updateFields.package_tier = newTier;

        // If subscription is cancelled/unpaid → downgrade to hosting
        if (sub.status === "canceled" || sub.status === "unpaid") {
          updateFields.package_tier = "hosting";
          updateFields.stripe_subscription_id = null;
          updateFields.plan_interval = null;
        }

        const { updated, tenantId } = await updateTenantByCustomerId(
          customerId,
          updateFields,
        );
        console.log(
          `[WaaS Webhook] subscription.updated → tenant ${tenantId} updated=${updated} status=${sub.status} tier=${newTier ?? "unchanged"}`,
        );

        // --- Email: plan_changed (only when tier actually changes) ---
        if (updated && tenantId && newTier && oldTier && newTier !== oldTier) {
          notifyAsync(async () => {
            const tenant = await getTenantById(tenantId);
            if (!tenant) return;
            const businessName =
              (tenant.brand_config as { business_name?: string } | null)
                ?.business_name ?? undefined;
            const email =
              (
                tenant.brand_config as {
                  contact?: { email?: string | null };
                } | null
              )?.contact?.email ?? undefined;
            await sendTenantNotification({
              type: "plan_changed",
              tenantId,
              data: {
                businessName,
                oldPlanLabel: planLabel(oldTier),
                newPlanLabel: planLabel(newTier),
                planLabel: planLabel(newTier),
                planInterval:
                  newInterval === "year"
                    ? "annual"
                    : newInterval === "month"
                      ? "monthly"
                      : undefined,
                planPrice: planPriceString(newTier, newInterval),
                portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/edit`,
              },
              recipientEmail: email,
              dedupKey: `plan_changed:${sub.id}:${newTier}`,
            });
          });
        }
        break;
      }

      // -----------------------------------------------------------------------
      // Subscription deleted / cancelled
      // -----------------------------------------------------------------------
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const { updated, tenantId } = await updateTenantByCustomerId(
          customerId,
          {
            stripe_subscription_id: null,
            package_tier: "hosting",
            plan_interval: null,
          },
        );
        console.log(
          `[WaaS Webhook] subscription.deleted → tenant ${tenantId} downgraded to hosting, updated=${updated}`,
        );
        // Subscription cancelled — no email; user initiated this via Stripe portal
        break;
      }

      // -----------------------------------------------------------------------
      // Payment failed — notify tenant, don't downgrade yet (Stripe handles retries)
      // -----------------------------------------------------------------------
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        console.warn(
          `[WaaS Webhook] Payment failed for customer ${customerId ?? "unknown"} — invoice ${invoice.id}`,
        );

        // --- Email: payment_failed ---
        if (customerId) {
          notifyAsync(async () => {
            const tenant = await getTenantByCustomerId(customerId);
            if (!tenant) return;
            const businessName =
              (tenant.brand_config as { business_name?: string } | null)
                ?.business_name ?? undefined;
            const email =
              (
                tenant.brand_config as {
                  contact?: { email?: string | null };
                } | null
              )?.contact?.email ?? undefined;
            const tier =
              (tenant.package_tier as WaasPackageTier | null) ?? null;
            await sendTenantNotification({
              type: "payment_failed",
              tenantId: tenant.id,
              data: {
                businessName,
                planLabel: planLabel(tier),
                portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/edit`,
              },
              recipientEmail: email,
              dedupKey: `payment_failed:${invoice.id}`,
              dedupWindowHours: 48, // don't spam if multiple retries fail quickly
            });
          });
        }
        break;
      }

      default:
        console.log(`[WaaS Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WaaS Webhook] Handler error:", message);
    // Return 200 to prevent Stripe retrying — log to Sentry in production
    return NextResponse.json({ received: true, warning: message });
  }
}
