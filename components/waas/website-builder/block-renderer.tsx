"use client"

import type { Block } from "@/lib/waas/website-builder/blocks"
import { cn } from "@/lib/utils"

const alignClass = {
  left:   "text-left",
  center: "text-center",
  right:  "text-right",
}

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return (
        <div
          className={cn(
            "flex flex-col gap-4 py-10",
            block.align === "center" ? "items-center text-center" : "items-start text-left",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{block.eyebrow}</p>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
            {block.title}
          </h1>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground">{block.subtitle}</p>
          <span className="mt-2 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            {block.buttonLabel}
          </span>
        </div>
      )
    case "heading": {
      const sizes = {
        h1: "text-4xl font-extrabold tracking-tight",
        h2: "text-3xl font-bold tracking-tight",
        h3: "text-xl font-semibold",
      }
      return (
        <p className={cn(sizes[block.level], alignClass[block.align], "text-foreground")}>
          {block.text}
        </p>
      )
    }
    case "text":
      return (
        <p className={cn("text-base leading-relaxed text-muted-foreground", alignClass[block.align])}>
          {block.text}
        </p>
      )
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src || "/placeholder.svg"}
          alt={block.alt}
          className={cn("w-full object-cover", block.rounded && "rounded-xl")}
        />
      )
    case "button":
      return (
        <div className={alignClass[block.align]}>
          <span
            className={cn(
              "inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold",
              block.variant === "solid"
                ? "bg-primary text-primary-foreground"
                : "border border-primary text-foreground",
            )}
          >
            {block.label}
          </span>
        </div>
      )
    case "columns":
      return (
        <div className="grid gap-6 md:grid-cols-2">
          <p className="text-base leading-relaxed text-muted-foreground">{block.left}</p>
          <p className="text-base leading-relaxed text-muted-foreground">{block.right}</p>
        </div>
      )
    case "spacer": {
      const h = { sm: "h-6", md: "h-14", lg: "h-24" }
      return <div className={h[block.size]} aria-hidden />
    }
    case "divider":
      return <hr className="border-border" />
  }
}
