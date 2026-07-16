"use client";

import type { CSSProperties } from "react";
import type { Block } from "@/lib/waas/website-builder/blocks";
import { cn } from "@/lib/utils";

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "hero": {
      const heroLayoutClass =
        block.variant === "split"
          ? "md:grid md:grid-cols-[1.2fr_0.8fr] md:items-center"
          : block.variant === "editorial"
            ? "max-w-3xl"
            : block.variant === "emergency"
              ? "max-w-4xl"
              : block.variant === "full-bleed-gallery"
                ? "max-w-5xl"
                : "max-w-4xl";

      const heroStyle: CSSProperties = {
        background:
          block.variant === "emergency"
            ? "linear-gradient(135deg, rgba(30, 64, 175, 0.14) 0%, rgba(99, 102, 241, 0.18) 40%, rgba(15, 23, 42, 0.14) 100%)"
            : block.variant === "editorial"
              ? "linear-gradient(160deg, rgba(241, 245, 249, 0.95) 0%, rgba(226, 232, 240, 0.92) 100%)"
              : "var(--brand-hero-gradient)",
        borderColor: "var(--brand-block-border)",
        boxShadow: "var(--brand-block-shadow)",
      };

      return (
        <div
          className={cn(
            "rounded-2xl border px-6 py-10 md:px-10",
            "flex flex-col gap-4",
            heroLayoutClass,
            block.align === "center"
              ? "items-center text-center"
              : "items-start text-left",
          )}
          style={heroStyle}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {block.eyebrow}
          </p>
          <h1
            className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl"
            style={{ fontFamily: "var(--brand-display-font)" }}
          >
            {block.title}
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {block.subtitle}
          </p>
          <span
            className="mt-2 inline-flex rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--ring))",
              boxShadow: "0 10px 20px color-mix(in srgb, var(--primary) 26%, transparent)",
            }}
          >
            {block.buttonLabel}
          </span>
        </div>
      );
    }
    case "heading": {
      const sizes = {
        h1: "text-4xl font-extrabold tracking-tight",
        h2: "text-3xl font-bold tracking-tight",
        h3: "text-xl font-semibold",
      };
      return (
        <p
          className={cn(
            sizes[block.level],
            alignClass[block.align],
            "text-foreground leading-tight",
          )}
          style={{
            fontFamily: "var(--brand-display-font)",
            marginTop: block.level === "h2" ? "0.1rem" : undefined,
          }}
        >
          {block.text}
        </p>
      );
    }
    case "text":
      return (
        <p
          className={cn(
            "text-base leading-relaxed text-muted-foreground",
            alignClass[block.align],
          )}
          style={{ color: "var(--brand-copy-color)" }}
        >
          {block.text}
        </p>
      );
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src || "/placeholder.svg"}
          alt={block.alt}
          className={cn("w-full object-cover", block.rounded && "rounded-xl")}
          style={{ borderRadius: block.rounded ? "14px" : undefined }}
        />
      );
    case "button":
      return (
        <div className={alignClass[block.align]}>
          <span
            className={cn(
              "inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold",
              block.variant === "solid"
                ? "text-primary-foreground"
                : "border text-foreground",
            )}
            style={
              block.variant === "solid"
                ? {
                    background:
                      "linear-gradient(135deg, var(--primary), var(--ring))",
                    boxShadow:
                      "0 8px 18px color-mix(in srgb, var(--primary) 24%, transparent)",
                  }
                : {
                    borderColor: "var(--primary)",
                    background: "color-mix(in srgb, var(--primary) 10%, white)",
                  }
            }
          >
            {block.label}
          </span>
        </div>
      );
    case "columns":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <p
            className="rounded-xl border p-4 text-base leading-relaxed text-muted-foreground"
            style={{
              borderColor: "var(--brand-block-border)",
              background: "var(--brand-block-bg)",
            }}
          >
            {block.left}
          </p>
          <p
            className="rounded-xl border p-4 text-base leading-relaxed text-muted-foreground"
            style={{
              borderColor: "var(--brand-block-border)",
              background: "var(--brand-block-bg)",
            }}
          >
            {block.right}
          </p>
        </div>
      );
    case "spacer": {
      const h = { sm: "h-6", md: "h-14", lg: "h-24" };
      return <div className={h[block.size]} aria-hidden />;
    }
    case "divider":
      return <hr className="border-border" style={{ borderColor: "var(--brand-divider)" }} />;
  }
}
