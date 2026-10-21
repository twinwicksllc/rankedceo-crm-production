import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Account resolution must go through `users`, not `accounts`.
//
// `users.id` IS the auth uid and `users.account_id` points at the account.
// `accounts` has never had a `user_id` column (see migration 030 / DEC-0022),
// so `accounts.select("id").eq("user_id", user.id)` always returns zero rows
// and every create path threw "Account not found". Four services had that
// bug; this test fails first, with the file name, if it comes back.

const SKIP = new Set([
  "node_modules",
  ".next",
  ".git",
  "qa-agent",
  "supabase-mcp-client",
]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(full) && !full.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

/** Returns "file:line" for every `from("accounts")` chain filtered by user_id. */
export function accountsQueriedByUserId(files: string[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const re = /\.from\(\s*["']accounts["']\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      // The builder chain for this call is the next chunk of source.
      const chain = src.slice(m.index, m.index + 400);
      if (!/\.eq\(\s*["']user_id["']/.test(chain)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      found.push(`${file}:${line}`);
    }
  }
  return found;
}

test("account lookups never filter accounts by user_id", () => {
  const files = [...sourceFiles("lib"), ...sourceFiles("app")];
  assert.ok(files.length > 0, "expected to scan some source files");

  const offenders = accountsQueriedByUserId(files);
  assert.deepEqual(
    offenders,
    [],
    `accounts has no user_id column; resolve the account via users.account_id instead:\n${offenders.join("\n")}`,
  );
});
