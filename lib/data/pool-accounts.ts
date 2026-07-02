// ---------------------------------------------------------------------------
// Pool Account UUIDs
// ---------------------------------------------------------------------------
// These are pre-seeded accounts in the database that capture leads submitted
// without an operatorId (e.g., direct traffic, shared links without ID).
//
// Fixed UUIDs allow deterministic seeding — safe to run the INSERT multiple
// times with ON CONFLICT DO NOTHING.
//
// Future: Admin dashboard can view pool leads and assign them to operators.
// ---------------------------------------------------------------------------

export const POOL_ACCOUNTS = {
  hvac: "00000000-0000-0000-0001-000000000001",
  plumbing: "00000000-0000-0000-0002-000000000002",
  electrical: "00000000-0000-0000-0003-000000000003",
} as const;

export type PoolIndustry = keyof typeof POOL_ACCOUNTS;

/**
 * Returns the pool account_id for a given industry.
 * Used when a lead is submitted without an operatorId.
 */
export function getPoolAccountId(industry: PoolIndustry): string {
  return POOL_ACCOUNTS[industry];
}

/**
 * Returns true if the given account_id is a pool account.
 * Useful for admin dashboards to identify unattributed leads.
 */
export function isPoolAccount(accountId: string): boolean {
  return Object.values(POOL_ACCOUNTS).includes(accountId as any);
}

/**
 * Returns the industry for a given pool account_id, or null if not a pool account.
 */
export function getPoolIndustry(accountId: string): PoolIndustry | null {
  const entry = Object.entries(POOL_ACCOUNTS).find(
    ([, id]) => id === accountId,
  );
  return entry ? (entry[0] as PoolIndustry) : null;
}
