"use client";

import type { Block } from "@/lib/waas/website-builder/blocks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  block: Block | null;
  onChange: (patch: Partial<Block>) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function AlignSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="left">Left</SelectItem>
        <SelectItem value="center">Center</SelectItem>
        <SelectItem value="right">Right</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function Inspector({ block, onChange }: Props) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">Properties</h2>
        <p className="text-xs text-muted-foreground">
          {block ? `Editing ${block.type}` : "Select a block to edit"}
        </p>
      </div>

      {!block ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Click a block on the canvas to edit its content and styling.
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {block.type === "hero" && (
            <>
              <Field label="Eyebrow">
                <Input
                  value={block.eyebrow}
                  onChange={(e) => onChange({ eyebrow: e.target.value })}
                />
              </Field>
              <Field label="Title">
                <Textarea
                  value={block.title}
                  onChange={(e) => onChange({ title: e.target.value })}
                  rows={2}
                />
              </Field>
              <Field label="Subtitle">
                <Textarea
                  value={block.subtitle}
                  onChange={(e) => onChange({ subtitle: e.target.value })}
                  rows={3}
                />
              </Field>
              <Field label="Button label">
                <Input
                  value={block.buttonLabel}
                  onChange={(e) => onChange({ buttonLabel: e.target.value })}
                />
              </Field>
              <Field label="Alignment">
                <AlignSelect
                  value={block.align}
                  onChange={(v) => onChange({ align: v as "left" | "center" })}
                />
              </Field>
            </>
          )}

          {block.type === "heading" && (
            <>
              <Field label="Text">
                <Textarea
                  value={block.text}
                  onChange={(e) => onChange({ text: e.target.value })}
                  rows={2}
                />
              </Field>
              <Field label="Level">
                <Select
                  value={block.level}
                  onValueChange={(v) =>
                    onChange({ level: v as "h1" | "h2" | "h3" })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h1">H1 — Largest</SelectItem>
                    <SelectItem value="h2">H2 — Medium</SelectItem>
                    <SelectItem value="h3">H3 — Small</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Alignment">
                <AlignSelect
                  value={block.align}
                  onChange={(v) =>
                    onChange({ align: v as "left" | "center" | "right" })
                  }
                />
              </Field>
            </>
          )}

          {block.type === "text" && (
            <>
              <Field label="Text">
                <Textarea
                  value={block.text}
                  onChange={(e) => onChange({ text: e.target.value })}
                  rows={6}
                />
              </Field>
              <Field label="Alignment">
                <AlignSelect
                  value={block.align}
                  onChange={(v) =>
                    onChange({ align: v as "left" | "center" | "right" })
                  }
                />
              </Field>
            </>
          )}

          {block.type === "image" && (
            <>
              <Field label="Image URL">
                <Input
                  value={block.src}
                  onChange={(e) => onChange({ src: e.target.value })}
                />
              </Field>
              <Field label="Alt text">
                <Input
                  value={block.alt}
                  onChange={(e) => onChange({ alt: e.target.value })}
                />
              </Field>
              <Field label="Rounded corners">
                <Select
                  value={block.rounded ? "yes" : "no"}
                  onValueChange={(v) => onChange({ rounded: v === "yes" })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {block.type === "button" && (
            <>
              <Field label="Label">
                <Input
                  value={block.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                />
              </Field>
              <Field label="Link URL">
                <Input
                  value={block.href}
                  onChange={(e) => onChange({ href: e.target.value })}
                />
              </Field>
              <Field label="Style">
                <Select
                  value={block.variant}
                  onValueChange={(v) =>
                    onChange({ variant: v as "solid" | "outline" })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Alignment">
                <AlignSelect
                  value={block.align}
                  onChange={(v) =>
                    onChange({ align: v as "left" | "center" | "right" })
                  }
                />
              </Field>
            </>
          )}

          {block.type === "columns" && (
            <>
              <Field label="Left column">
                <Textarea
                  value={block.left}
                  onChange={(e) => onChange({ left: e.target.value })}
                  rows={4}
                />
              </Field>
              <Field label="Right column">
                <Textarea
                  value={block.right}
                  onChange={(e) => onChange({ right: e.target.value })}
                  rows={4}
                />
              </Field>
            </>
          )}

          {block.type === "spacer" && (
            <Field label="Size">
              <Select
                value={block.size}
                onValueChange={(v) =>
                  onChange({ size: v as "sm" | "md" | "lg" })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {block.type === "divider" && (
            <p className="text-sm text-muted-foreground">
              A divider has no editable options.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
