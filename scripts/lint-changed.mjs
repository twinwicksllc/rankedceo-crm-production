#!/usr/bin/env node
// "No new lint errors" gate for changed .ts/.tsx files.
//
// The repo still has ~500 old lint errors, so a whole-repo gate cannot pass.
// For every file changed against the merge-base with the base branch, this
// lints the new version AND the base version, and fails if any rule has MORE
// errors than before. New files must be fully clean. Old errors in a touched
// file are allowed (but fixing them is welcome).
//
// Usage: node scripts/lint-changed.mjs [baseRef]   (default origin/main)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ESLint } from "eslint";

const base = process.argv[2] || process.env.LINT_BASE || "origin/main";
const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const lines = (s) => s.split("\n").filter(Boolean);

let mergeBase;
try {
  mergeBase = lines(git(["merge-base", base, "HEAD"]))[0];
} catch {
  // Shallow clones may not contain the common ancestor. Fall back to the base
  // ref itself (a two-dot diff). In CI, fetch-depth: 0 gives a real merge-base.
  try {
    mergeBase = lines(git(["rev-parse", base]))[0];
    console.warn(
      `lint-changed: no merge-base with "${base}" (shallow clone?); comparing against ${base} directly.`,
    );
  } catch {
    console.error(
      `lint-changed: cannot resolve "${base}". Run: git fetch origin main`,
    );
    process.exit(2);
  }
}

const changed = new Set([
  ...lines(git(["diff", "--name-only", "--diff-filter=ACMR", mergeBase])),
  ...lines(git(["ls-files", "--others", "--exclude-standard"])),
]);
const files = [...changed].filter((f) => /\.(ts|tsx)$/.test(f));

if (files.length === 0) {
  console.log("lint-changed: no changed .ts/.tsx files.");
  process.exit(0);
}

const eslint = new ESLint();

const countByRule = (messages) => {
  const m = new Map();
  for (const x of messages) {
    if (x.severity !== 2) continue;
    const k = x.ruleId ?? "parse-error";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

const baseSource = (file) => {
  try {
    return git(["show", `${mergeBase}:${file}`]);
  } catch {
    return null; // new file
  }
};

console.log(
  `lint-changed: checking ${files.length} changed file(s) vs ${base}`,
);
let failed = 0;

for (const file of files) {
  const [now] = await eslint.lintText(readFileSync(file, "utf8"), {
    filePath: file,
  });
  const nowCounts = countByRule(now.messages);
  const old = baseSource(file);
  let oldCounts = new Map();
  if (old !== null) {
    const [r] = await eslint.lintText(old, { filePath: file });
    oldCounts = countByRule(r.messages);
  }

  const worse = [...nowCounts].filter(
    ([rule, n]) => n > (oldCounts.get(rule) ?? 0),
  );
  if (worse.length === 0) continue;

  failed++;
  console.error(`\n${file}: new lint errors`);
  for (const [rule, n] of worse) {
    console.error(`  ${rule}: ${n} now, ${oldCounts.get(rule) ?? 0} before`);
    for (const m of now.messages.filter(
      (x) => x.severity === 2 && (x.ruleId ?? "parse-error") === rule,
    )) {
      console.error(`    ${m.line}:${m.column}  ${m.message}`);
    }
  }
}

if (failed > 0) {
  console.error(`\nlint-changed: ${failed} file(s) have new lint errors.`);
  process.exit(1);
}
console.log("lint-changed: no new lint errors.");
