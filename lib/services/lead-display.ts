// ============================================================
// Display helpers for the industry lead card
// ============================================================
// Pure functions, no React and no app imports, so Deno tests can load them.
// Leads from the landing quote form and the chat agent carry only part of the
// details a full lead form collects, so every helper accepts a missing or
// oddly typed value and returns something safe to render.
// ============================================================

export const UNNAMED_LEAD = "Unnamed lead";
export const UNKNOWN_DATE = "Date unknown";
export const DEFAULT_SERVICE_LABEL = "General Service";

export type ContactMethod = "phone" | "email" | "text";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** service_details as an object; null, a string or an array become {}. */
export function detailsOf(serviceDetails: unknown): Record<string, unknown> {
  return isPlainObject(serviceDetails) ? serviceDetails : {};
}

/**
 * "Just now", "5m ago", "3h ago", "2d ago", or a local date after a week.
 * An empty, missing or unparseable date gives UNKNOWN_DATE, never "NaNd ago".
 */
export function timeAgo(
  dateStr: string | null | undefined,
  now: Date = new Date(),
): string {
  if (typeof dateStr !== "string" || dateStr.trim() === "") return UNKNOWN_DATE;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return UNKNOWN_DATE;

  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/** "ac_repair" becomes "Ac Repair"; no usable service_type gives the default. */
export function getServiceTypeLabel(serviceDetails: unknown): string {
  const type = detailsOf(serviceDetails).service_type;
  if (typeof type !== "string" || type.trim() === "") {
    return DEFAULT_SERVICE_LABEL;
  }
  return type
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The lead's name for the card heading; blank or non-string gives UNNAMED_LEAD. */
export function displayName(name: unknown): string {
  return typeof name === "string" && name.trim() !== ""
    ? name.trim()
    : UNNAMED_LEAD;
}

/** symptoms as a list of non-empty strings; anything but an array gives []. */
export function symptomsOf(serviceDetails: unknown): string[] {
  const symptoms = detailsOf(serviceDetails).symptoms;
  if (!Array.isArray(symptoms)) return [];
  return symptoms.filter(
    (s): s is string => typeof s === "string" && s.trim() !== "",
  );
}

/** The customer's own description, when it is a non-empty string. */
export function problemDescriptionOf(serviceDetails: unknown): string | null {
  const text = detailsOf(serviceDetails).problem_description;
  return typeof text === "string" && text.trim() !== "" ? text : null;
}

/** "$1,250" for a finite number; null for null, NaN, Infinity or non-numbers. */
export function formatEstimatedValue(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `$${value.toLocaleString("en-US")}`;
}

/** The contact method to show; anything unrecognised falls back to phone. */
export function contactMethodOf(value: unknown): ContactMethod {
  return value === "email" || value === "text" || value === "phone"
    ? value
    : "phone";
}
