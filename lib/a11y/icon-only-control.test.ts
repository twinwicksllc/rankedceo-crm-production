import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

// Guards the local `local/icon-only-control` rule in eslint.config.mjs. The
// stock jsx-a11y/control-has-associated-label treats any self-closing
// component as a label, so it never flags <button><X /></button>. If someone
// loosens the local rule, these cases stop failing and this test says so.

const eslint = new ESLint({ cwd: process.cwd() });

async function flaggedLines(code: string): Promise<number[]> {
  const [result] = await eslint.lintText(code, {
    filePath: "app/__icon_only_probe.tsx",
  });
  return result.messages
    .filter((m) => m.ruleId === "local/icon-only-control")
    .map((m) => m.line);
}

const header = `import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
const Card = (p: { appointment: string }) => <div>{p.appointment}</div>;
`;

test("flags icon-only buttons and links", async () => {
  const cases = [
    `export const a = () => <button onClick={() => {}}><X /></button>;`,
    `export const a = () => <Button size="icon"><X /></Button>;`,
    `export const a = () => <Link href="/x"><X className="h-4" /></Link>;`,
    `export const a = () => <button title="Close"><X /></button>;`,
    `export const a = () => <a href="/x"><svg /></a>;`,
  ];
  for (const c of cases) {
    const lines = await flaggedLines(header + c);
    assert.ok(lines.length > 0, `should be flagged: ${c}`);
  }
});

test("does not flag controls that have a name", async () => {
  const cases = [
    `export const a = () => <button aria-label="Close"><X /></button>;`,
    `export const a = () => <button aria-labelledby="t"><X /></button>;`,
    `export const a = (p: { label: string }) => <button><X />{p.label}</button>;`,
    `export const a = () => <button><span className="sr-only">Close</span><X /></button>;`,
    `export const a = () => <button><X /> Close</button>;`,
    `export const a = (p: object) => <button {...p}><X /></button>;`,
    `export const a = () => <Link href="/x"><Card appointment="a" /></Link>;`,
    `export const a = () => <Link href="/"><Image src="/a.png" alt="Logo" width={1} height={1} /></Link>;`,
  ];
  for (const c of cases) {
    const lines = await flaggedLines(header + c);
    assert.deepEqual(lines, [], `should NOT be flagged: ${c}`);
  }
});
