import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyLeadUpdate } from "./industry-lead-update";

// A fake table with one row. `beforeWrite` runs between the read and the
// write, which is where a second operator's update lands.
function fakeClient(
  row: {
    problem_description: Record<string, unknown>;
    metadata: Record<string, unknown>;
    updated_at: string;
  } | null,
  beforeWrite?: () => void,
) {
  const writes: Array<Record<string, unknown>> = [];
  const filters: Array<[string, unknown]> = [];
  const fake = {
    from() {
      return {
        select() {
          const q = {
            eq() {
              return q;
            },
            async maybeSingle() {
              return { data: row ? { ...row } : null, error: null };
            },
          };
          return q;
        },
        update(patch: Record<string, unknown>) {
          const q = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return q;
            },
            select() {
              return {
                async then(resolve: (v: unknown) => void) {
                  beforeWrite?.();
                  const stale = filters.some(
                    ([c, v]) => c === "updated_at" && v !== row?.updated_at,
                  );
                  if (!stale && row) {
                    writes.push(patch);
                    Object.assign(row, patch);
                  }
                  resolve({
                    data: stale || !row ? [] : [{ id: "lead-1" }],
                    error: null,
                  });
                },
              };
            },
          };
          return q;
        },
      };
    },
  };
  // The action passes a real SupabaseClient; the fake covers the calls it makes.
  const client = fake as unknown as SupabaseClient;
  return { client, writes, filters };
}

const row = () => ({
  problem_description: { city: "Denver" },
  metadata: {},
  updated_at: "2026-10-23T10:00:00.000Z",
});

test("a plain update merges into the existing jsonb and succeeds", async () => {
  const table = row();
  const { client, writes } = fakeClient(table);
  const result = await applyLeadUpdate(client, "lead-1", "acct-1", {
    notes: "called back",
    estimated_value: 450,
  });
  assert.deepEqual(result, { success: true });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].problem_description, {
    city: "Denver",
    notes: "called back",
  });
  assert.deepEqual(writes[0].metadata, { estimated_value: 450 });
});

test("the write is conditional on the updated_at that was read", async () => {
  const table = row();
  const { client, filters } = fakeClient(table);
  await applyLeadUpdate(client, "lead-1", "acct-1", { status: "contacted" });
  assert.deepEqual(
    filters.filter(([c]) => c === "updated_at"),
    [["updated_at", "2026-10-23T10:00:00.000Z"]],
  );
});

test("a concurrent update between the read and the write is reported, not overwritten", async () => {
  const table = row();
  const { client, writes } = fakeClient(table, () => {
    // Another operator's update lands first and changes updated_at.
    table.updated_at = "2026-10-23T10:00:01.000Z";
    table.metadata = { assigned_to: "op-2" };
  });
  const result = await applyLeadUpdate(client, "lead-1", "acct-1", {
    estimated_value: 450,
  });
  assert.equal(result.success, false);
  assert.match(result.error ?? "", /changed|reload|try again/i);
  assert.equal(writes.length, 0, "the stale write must not go through");
  assert.deepEqual(table.metadata, { assigned_to: "op-2" });
});

test("a lead in another account or a missing lead is 'not found'", async () => {
  const { client } = fakeClient(null);
  const result = await applyLeadUpdate(client, "lead-1", "acct-1", {
    status: "lost",
  });
  assert.deepEqual(result, { success: false, error: "Lead not found" });
});

test("the action delegates to applyLeadUpdate", () => {
  const source = readFileSync(
    new URL("../actions/industry-lead.ts", import.meta.url),
    "utf8",
  ).replace(/\r\n/g, "\n");
  assert.match(source, /applyLeadUpdate\(/);
});
