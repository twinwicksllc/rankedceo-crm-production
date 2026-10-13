"use client";

import { useEffect } from "react";

/**
 * Calls `onEscape` when the Escape key is pressed while `enabled` is true.
 *
 * Modals close on a backdrop click for mouse users. Keyboard users need the
 * same way out, so every modal that closes on a backdrop click should use this
 * (or already have its own Escape handler).
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onEscape, enabled]);
}
