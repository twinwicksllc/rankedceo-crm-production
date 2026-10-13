import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
// `typescript` is a production dependency, so this import also resolves in the
// Vercel build (see lib/ci/no-dev-imports.test.ts).
import ts from "typescript";

// Modals close on a backdrop click for mouse users. Keyboard users need Escape.
// The jsx-a11y click rules cannot see this (a backdrop marked role="presentation"
// is skipped by them), so this test checks it: every file that renders an
// aria-modal dialog must also register an Escape handler.
//
// The check reads the syntax tree, not the raw text, so a comment or a string
// that mentions Escape does not count. A handler is either a call to
// useEscapeKey(...) or a comparison against the string "Escape" (the
// `e.key === "Escape"` pattern used by the older modals).

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

export function escapeCoverage(source: string): {
  dialogs: number;
  handlers: number;
} {
  const file = ts.createSourceFile(
    "probe.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let dialogs = 0;
  let handlers = 0;
  const isEscape = (node: ts.Node) =>
    ts.isStringLiteralLike(node) && node.text === "Escape";

  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === "aria-modal") {
      const init = node.initializer;
      const isTrue =
        (init && ts.isStringLiteral(init) && init.text === "true") ||
        (init &&
          ts.isJsxExpression(init) &&
          init.expression?.kind === ts.SyntaxKind.TrueKeyword);
      if (isTrue) dialogs += 1;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useEscapeKey"
    ) {
      handlers += 1;
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken) &&
      (isEscape(node.left) || isEscape(node.right))
    ) {
      handlers += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { dialogs, handlers };
}

test("every aria-modal dialog file registers an Escape handler", () => {
  const modalFiles = ROOTS.flatMap(tsxFiles)
    .map((f) => ({ f, ...escapeCoverage(readFileSync(f, "utf8")) }))
    .filter((r) => r.dialogs > 0);
  assert.ok(modalFiles.length > 0, "expected to find at least one modal file");

  // At least one handler per dialog in the file (approval-panel has two).
  const missing = modalFiles
    .filter((r) => r.handlers < r.dialogs)
    .map((r) => `${r.f} (${r.dialogs} dialogs, ${r.handlers} Escape handlers)`);
  assert.deepEqual(
    missing,
    [],
    `These modal files have fewer Escape handlers than dialogs (use hooks/use-escape-key.ts): ${missing.join(", ")}`,
  );
});

test("the Escape check ignores comments and strings", () => {
  const dialog = `<div role="dialog" aria-modal="true" />`;
  // A comment or string that mentions Escape is not a handler.
  assert.deepEqual(
    escapeCoverage(
      `// Escape is handled elsewhere\n/* useEscapeKey(x) */\nconst s = "Escape";\nconst t = "useEscapeKey(x)";\nconst a = () => ${dialog};`,
    ),
    { dialogs: 1, handlers: 0 },
  );
  // Real handlers count, for both patterns.
  assert.deepEqual(
    escapeCoverage(
      `const a = () => { useEscapeKey(onClose); return ${dialog}; };`,
    ),
    { dialogs: 1, handlers: 1 },
  );
  assert.deepEqual(
    escapeCoverage(
      `const a = () => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; return ${dialog}; };`,
    ),
    { dialogs: 1, handlers: 1 },
  );
  // aria-modal={true} counts as a dialog; aria-modal="false" does not.
  assert.equal(
    escapeCoverage(`const a = () => <div aria-modal={true} />;`).dialogs,
    1,
  );
  assert.equal(
    escapeCoverage(`const a = () => <div aria-modal="false" />;`).dialogs,
    0,
  );
  // Two dialogs with one handler is not enough.
  const two = escapeCoverage(
    `const a = () => { useEscapeKey(x); return <><div aria-modal="true" /><div aria-modal="true" /></>; };`,
  );
  assert.ok(two.handlers < two.dialogs);
});
