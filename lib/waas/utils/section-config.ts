// =============================================================================
// WaaS Tier 1: Section config readers (shared helpers)
//
// Small, safe coercion helpers for reading values out of a `SectionConfig["config"]`
// record (which arrives as `Record<string, unknown>` because it is persisted to
// Postgres JSONB). Every reader returns a typed value with a sensible fallback
// so a malformed/empty config can never produce `NaN`, `undefined`, or an empty
// critical string downstream.
//
// Extracted from `BentoEmergencySection.tsx` so that every config-driven section
// (Bento Emergency, Answer-First AEO, and any future section) shares one
// NaN-safe, trim-safe implementation instead of re-inlining the same coercion
// pattern — which previously let `Number("abc")` silently become `NaN` and
// collapse the AEO Q&A list to zero cards (see audit finding 3.1).
// =============================================================================

import type { SectionConfig } from "@/lib/waas/templates/types";

type SectionConfigRecord = SectionConfig["config"];

/** Read a trimmed, non-empty string; otherwise return the fallback. */
export function readConfigString(
  config: SectionConfigRecord,
  key: string,
  fallback: string,
): string {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Read a finite, positive number.
 *
 * Accepts either a real number or a numeric string (e.g. `"45"` from JSONB).
 * Crucially guards against `NaN`: a non-numeric string such as `"abc"` yields
 * `Number("abc") === NaN`, which is rejected via `Number.isFinite()` so the
 * caller always receives a usable value.
 */
export function readConfigNumber(
  config: SectionConfigRecord,
  key: string,
  fallback: number,
): number {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

/**
 * Read a finite, non-negative integer.
 *
 * Used for "max items" / "max words" style caps that must be whole numbers >= 1.
 * Returns the fallback for `NaN`, negative numbers, zero, or non-numeric strings.
 */
export function readConfigInt(
  config: SectionConfigRecord,
  key: string,
  fallback: number,
): number {
  const value = config[key];
  let parsed: number;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && value.trim()) {
    parsed = Number(value);
  } else {
    return fallback;
  }
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

/** Read a boolean, accepting a real boolean or the strings "true"/"false". */
export function readConfigBool(
  config: SectionConfigRecord,
  key: string,
  fallback: boolean,
): boolean {
  const value = config[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return fallback;
}

/**
 * Read a string array from either a real array or a CSV string.
 * Empty/whitespace entries are dropped; falls back when nothing usable remains.
 */
export function readConfigStringArray(
  config: SectionConfigRecord,
  key: string,
  fallback: string[],
): string[] {
  const value = config[key];
  if (Array.isArray(value)) {
    const fromArray = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (fromArray.length > 0) return fromArray;
  }

  if (typeof value === "string" && value.trim()) {
    const fromCsv = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (fromCsv.length > 0) return fromCsv;
  }

  return fallback;
}
