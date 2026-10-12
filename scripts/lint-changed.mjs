#!/usr/bin/env node
// Lints only the .ts/.tsx files changed against the base branch (default origin/main).
// Why: the repo still has ~500 old lint errors, so a whole-repo gate cannot pass yet.
// New and edited files must be clean; old files get cleaned up as they are touched.
// Usage: node scripts/lint-changed.mjs [baseRef]
import { execFileSync, spawnSync } from "node:child_process";

const base = process.argv[2] || process.env.LINT_BASE || "origin/main";
const git = (args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);

let mergeBase;
try {
  mergeBase = git(["merge-base", base, "HEAD"])[0];
} catch {
  console.error(
    `lint-changed: cannot find merge-base with "${base}". Run: git fetch origin main`,
  );
  process.exit(2);
}

const changed = new Set([
  ...git(["diff", "--name-only", "--diff-filter=ACMR", mergeBase]),
  ...git(["ls-files", "--others", "--exclude-standard"]),
]);
const files = [...changed].filter((f) => /\.(ts|tsx)$/.test(f));

if (files.length === 0) {
  console.log("lint-changed: no changed .ts/.tsx files.");
  process.exit(0);
}

console.log(`lint-changed: linting ${files.length} changed file(s) vs ${base}`);
const res = spawnSync("npx", ["eslint", "--max-warnings=-1", ...files], {
  stdio: "inherit",
});
process.exit(res.status ?? 1);
