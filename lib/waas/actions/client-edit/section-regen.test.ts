import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

// The client "Regenerate with AI" button always failed with "Could not load
// tenant information." because this action read a table named waas_tenants,
// which exists in no migration. The tenants table is named `tenants`.
// The action imports next-only modules, so it is checked by reading its source.

const source = readFileSync(
  new URL("./section-regen.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

test("the section regenerate action reads the tenants table", () => {
  assert.match(source, /\.from\("tenants"\)/);
});

test("no query names the non-existent waas_tenants table", () => {
  assert.ok(
    !/\.from\("waas_tenants"\)/.test(source),
    "waas_tenants is not a table in any migration",
  );
});

test("every table name in waas migrations that the action reads is defined", () => {
  const tables = [...source.matchAll(/\.from\("([a-z_]+)"\)/g)].map(
    (m) => m[1],
  );
  assert.ok(tables.length > 0, "found no .from() calls");
  const dir = new URL("../../../../supabase/migrations/waas/", import.meta.url);
  const migrations = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(new URL(f, dir), "utf8"))
    .join("\n");
  for (const table of new Set(tables)) {
    assert.match(
      migrations,
      new RegExp(`CREATE TABLE (IF NOT EXISTS )?(public\\.)?${table}\\b`, "i"),
      `table ${table} is not created by a waas migration`,
    );
  }
});
