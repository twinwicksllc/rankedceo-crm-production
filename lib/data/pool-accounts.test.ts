import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { POOL_ACCOUNTS } from "./pool-accounts";

// Every pool id the app writes must be an account that rankedceo-waas seeds,
// or the insert fails on the accounts foreign key. The landing quote route
// once kept its own copy of these ids with a smile id that was never seeded.

function seededAccountIds(): Set<string> {
  const sql = readFileSync(
    "supabase/migrations/waas/030_crm_tables_in_waas.sql",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const ids = new Set<string>();
  const row =
    /INSERT INTO public\.accounts \(id,[^)]*\)\s*VALUES \('([0-9a-f-]{36})'/g;
  for (const match of sql.matchAll(row)) ids.add(match[1]);
  return ids;
}

test("every pool account id is seeded by waas/030", () => {
  const seeded = seededAccountIds();
  assert.ok(seeded.size > 0, "found no seeded account rows in waas/030");
  for (const [industry, id] of Object.entries(POOL_ACCOUNTS)) {
    assert.ok(seeded.has(id), `${industry} pool id ${id} is not seeded`);
  }
});

test("the landing quote route uses the shared pool ids", () => {
  const route = readFileSync("app/api/landing/quote/route.ts", "utf8");
  assert.doesNotMatch(route, /const POOL_ACCOUNTS\b/);
  assert.match(route, /from "@\/lib\/data\/pool-accounts"/);
});
