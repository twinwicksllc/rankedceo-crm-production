"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { Block } from "@/lib/waas/website-builder/blocks";
import { BlockRenderer } from "./block-renderer";
import { cn } from "@/lib/utils";

interface Props {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function CanvasBlock({ block, selected, onSelect, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { source: "canvas" },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    background: "var(--brand-block-bg)",
    borderColor: selected ? "var(--accent)" : "var(--brand-block-border)",
    boxShadow: "var(--brand-block-shadow)",
    borderRadius: "var(--brand-block-radius)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group relative border px-4 py-3 transition-all",
        selected ? "ring-1 ring-accent" : "hover:border-border",
        isDragging && "z-10 opacity-70",
      )}
    >
      {/* Drag handle */}
      <div
        className={cn(
          "absolute -left-3 top-1/2 flex -translate-y-1/2 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100",
          selected && "opacity-100",
        )}
      >
        <button
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder"
          className="flex size-6 cursor-grab items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      {/* Delete button */}
      <div
        className={cn(
          "absolute -right-3 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100",
          selected && "opacity-100",
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete block"
          className="flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <BlockRenderer block={block} />
    </div>
  );
}
