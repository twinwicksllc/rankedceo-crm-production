"use client"

import { useDraggable } from "@dnd-kit/core"
import {
  Columns2,
  Heading,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  Sparkles,
  Square,
  Type,
} from "lucide-react"
import { BLOCK_LIBRARY, type BlockType } from "@/lib/waas/website-builder/blocks"
import { cn } from "@/lib/utils"

const ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  hero:    Sparkles,
  heading: Heading,
  text:    Type,
  image:   ImageIcon,
  button:  MousePointerClick,
  columns: Columns2,
  spacer:  Square,
  divider: Minus,
}

function PaletteItem({ type, label, description }: { type: BlockType; label: string; description: string }) {
  const Icon = ICONS[type]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", blockType: type },
  })

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex w-full cursor-grab items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-accent hover:bg-secondary active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

export function BlockPalette() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">Blocks</h2>
        <p className="text-xs text-muted-foreground">Drag onto the canvas to add</p>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto p-4">
        {BLOCK_LIBRARY.map((b) => (
          <PaletteItem key={b.type} type={b.type} label={b.label} description={b.description} />
        ))}
      </div>
    </aside>
  )
}
