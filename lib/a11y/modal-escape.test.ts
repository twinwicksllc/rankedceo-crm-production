import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Modals close on a backdrop click for mouse users. Keyboard users need Escape.
// The jsx-a11y click rules cannot see this (a backdrop marked role="presentation"
// is skipped by them), so this test checks it: every file that renders an
// aria-modal dialog must also handle the Escape key.

const ROOTS = ["app", "components"];
const SKIP = new Set(["node_modules", ".next"]);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test("every aria-modal dialog file handles the Escape key", () => {
  const modalFiles = ROOTS.flatMap(tsxFiles).filter((f) =>
    /aria-modal=("true"|\{true\})/.test(readFileSync(f, "utf8")),
  );
  assert.ok(modalFiles.length > 0, "expected to find at least one modal file");

  const missing = modalFiles.filter(
    (f) => !/Escape|useEscapeKey/.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(
    missing,
    [],
    `These modal files have no Escape handling (use hooks/use-escape-key.ts): ${missing.join(", ")}`,
  );
});
