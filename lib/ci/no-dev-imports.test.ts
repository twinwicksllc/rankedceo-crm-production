import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// `next build` typechecks every .ts/.tsx file in the repo (tsconfig includes
// **/*.ts, including *.test.ts), and Vercel builds without devDependencies
// typed in. A file that imports a devDependency (eslint, tsx, ...) passes
// `npm run check` in CI but fails the production build (this broke #284).
// This test fails first, with the file name.

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

export function devOnlyImports(
  files: string[],
  prod: Set<string>,
  dev: Set<string>,
): string[] {
  const found: string[] = [];
  const re = /(?:from\s+|import\s*\(\s*|require\(\s*)["']([^"'./][^"']*)["']/g;
  for (const file of files) {
    // Ignore comments: a comment that says `import x from "eslint"` is not an import.
    const src = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const match of src.matchAll(re)) {
      const spec = match[1];
      if (spec.startsWith("node:") || spec.startsWith("@/")) continue;
      const name = spec.startsWith("@")
        ? spec.split("/").slice(0, 2).join("/")
        : spec.split("/")[0];
      if (dev.has(name) && !prod.has(name)) found.push(`${file} -> ${name}`);
    }
  }
  return found;
}

test("no typechecked source file imports a devDependency", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const prod = new Set(Object.keys(pkg.dependencies ?? {}));
  const dev = new Set(Object.keys(pkg.devDependencies ?? {}));
  const files = sourceFiles(".");
  assert.ok(files.length > 100, "expected to scan the whole repo");
  assert.deepEqual(
    devOnlyImports(files, prod, dev),
    [],
    "These files import a devDependency; the production build cannot resolve it. Load it at run time (createRequire) or move the package to dependencies.",
  );
});
