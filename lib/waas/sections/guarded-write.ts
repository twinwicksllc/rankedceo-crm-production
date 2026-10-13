// =============================================================================
// lib/waas/sections/guarded-write.ts
// "Update this row only if nobody changed it since I read it" (optimistic
// guard on updated_at). Shared by the client edit save (content-edit.ts) and
// the section-id backfill (scripts/backfill-section-ids.ts), so both behave the
// same way and one test covers both.
//
// The client is typed as a minimal interface so tests can pass a fake; callers
// pass the real Supabase admin client (cast, because the real builder types are
// much larger than what is used here).
// =============================================================================

export interface GuardedQuery {
  eq(column: string, value: string): GuardedQuery;
  is(column: string, value: null): GuardedQuery;
  select(columns: string): PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
}

export interface GuardedClient {
  from(table: string): {
    update(values: Record<string, unknown>): GuardedQuery;
  };
}

export type GuardedWriteResult =
  | { status: "written" }
  | { status: "conflict" }
  | { status: "error"; message: string };

/**
 * Update one row (by id) only if its `updated_at` still equals
 * `expectedUpdatedAt` (null means "was null when read"). The write also sets a
 * new `updated_at`, so any other writer that read the old row fails its own
 * check. Zero matched rows is reported as `conflict`, not as success.
 */
export async function updateIfUnchanged(
  client: GuardedClient,
  table: string,
  id: string,
  values: Record<string, unknown>,
  expectedUpdatedAt: string | null,
  newUpdatedAt: string,
): Promise<GuardedWriteResult> {
  let query = client
    .from(table)
    .update({ ...values, updated_at: newUpdatedAt })
    .eq("id", id);
  query =
    expectedUpdatedAt === null
      ? query.is("updated_at", null)
      : query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select("id");
  if (error) return { status: "error", message: error.message };
  if (!data || data.length === 0) return { status: "conflict" };
  return { status: "written" };
}
