import type { LeadStats } from "../types/industry-lead";

// ============================================================
// Pure helpers behind the industry lead server actions
// ============================================================
// Kept out of the "use server" file so they can be tested without Next.js.
// ============================================================

const MAX_SEARCH_LENGTH = 100;

/**
 * The PostgREST `.or()` filter for the dashboard search box, or null when the
 * term is empty after cleaning.
 *
 * `.or()` takes one comma-separated string, so a raw term containing `,` or
 * `)` could add its own conditions (filter injection). Those characters, the
 * quote and backslash that open escapes, and the wildcards `%` and `*` are
 * removed from the term, which leaves nothing that can end the condition or
 * add a wildcard of the caller's choosing.
 *
 * Only live columns are searched; city is not a column.
 */
export function buildSearchFilter(search: string | undefined): string | null {
  if (!search) return null;
  const term = search
    .replace(/[,()"\\*%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .trim();
  if (term === "") return null;
  return [
    `lead_name.ilike.%${term}%`,
    `lead_email.ilike.%${term}%`,
    `lead_phone.ilike.%${term}%`,
  ].join(",");
}

/** estimated_value lives in the metadata jsonb; only a finite number counts. */
export function estimatedValueFromMetadata(metadata: unknown): number | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const value = (metadata as Record<string, unknown>).estimated_value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface LeadStatsRow {
  status?: string | null;
  urgency?: string | null;
  metadata?: unknown;
}

export function computeLeadStats(all: LeadStatsRow[]): LeadStats {
  const total = all.length;
  const new_count = all.filter((l) => l.status === "new").length;
  const emergency_count = all.filter((l) => l.urgency === "emergency").length;
  const urgent_count = all.filter((l) => l.urgency === "urgent").length;
  const scheduled_count = all.filter((l) => l.status === "scheduled").length;
  const completed_count = all.filter((l) => l.status === "completed").length;
  const lost_count = all.filter((l) => l.status === "lost").length;

  const closedCount = completed_count + lost_count;
  const conversion_rate =
    closedCount > 0 ? Math.round((completed_count / closedCount) * 100) : 0;

  const values = all
    .map((l) => estimatedValueFromMetadata(l.metadata))
    .filter((v): v is number => v !== null);
  const avg_estimated_value =
    values.length > 0
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : null;
  const total_pipeline_value = values.reduce((sum, v) => sum + v, 0);

  return {
    total,
    new_count,
    emergency_count,
    urgent_count,
    scheduled_count,
    completed_count,
    lost_count,
    conversion_rate,
    avg_estimated_value,
    total_pipeline_value,
  };
}
