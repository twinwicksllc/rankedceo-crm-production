// RankedCEO WaaS — Admin actions barrel
// Re-exports everything from domain modules so existing imports keep working:
//   import { deploySite } from '@/lib/waas/actions/admin'

export type { ActionResult } from "./_shared";
export type { VariantLifecycleReasonCategory } from "./_versioning";

export * from "./tenants";
export * from "./variants";
export * from "./lifecycle";
export * from "./deploy";
export * from "./site-settings";
export * from "./client-review";
export * from "./domains";
export * from "./stats";
export * from "./leads";
