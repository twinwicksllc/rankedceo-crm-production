// =============================================================================
// lib/waas/reviews.ts
// Single source of truth for "what counts as a real review" on a tenant site.
//
// Background: the reviews section used to render three hardcoded reviews and a
// hardcoded "5.0 · 100+ Google Reviews" badge on every live tenant site. That
// is fabricated social proof (FTC fake-review rule, Google policy). Now the
// section only shows what the business owner (or an admin) entered, and the
// generators are never allowed to write review data.
//
// Pure functions only: no React, no I/O. Used by the section component, the
// editor field builder, the edit-path validator and the site generators.
// =============================================================================

import type { ReviewItemContent } from "@/lib/waas/templates/types";

export const MAX_REVIEWS = 6;

export const REVIEW_LIMITS = {
  author: 60,
  text: 500,
  date: 40,
  maxRating: 5,
  minRating: 1,
  /** Upper bound on the owner-entered Google review count. */
  maxGoogleReviewCount: 1_000_000,
} as const;

/**
 * Keys the generators may never write into a reviews section's content.
 *
 * The owner-entered keys are prefixed `owner` on purpose: a variant generated
 * before this change can already contain an AI-written `content.reviews`
 * array, and reading it would show fabricated reviews as if the owner had
 * entered them. Only keys that the editor writes are read (`ownerReviews`,
 * `ownerGoogleRating`, `ownerGoogleReviewCount`); the unprefixed legacy keys
 * are ignored on read and stripped on write, so no data migration is needed.
 */
const UNVERIFIED_REVIEW_KEYS = [
  "reviews",
  "googleRating",
  "googleReviewCount",
  "ownerReviews",
  "ownerGoogleRating",
  "ownerGoogleReviewCount",
] as const;

/** Content keys the editor writes and the section reads. */
export const OWNER_REVIEWS_KEY = "ownerReviews";
export const OWNER_GOOGLE_RATING_KEY = "ownerGoogleRating";
export const OWNER_GOOGLE_COUNT_KEY = "ownerGoogleReviewCount";

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

/** Whole-star rating from a number or numeric string, or null when invalid. */
export function parseReviewRating(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isInteger(n)) return null;
  if (n < REVIEW_LIMITS.minRating || n > REVIEW_LIMITS.maxRating) return null;
  return n;
}

/**
 * Real reviews from a reviews section's content. Drops anything incomplete:
 * a review needs an author, text, and a valid 1-5 star rating. Tolerates the
 * `null` holes the edit-path patcher leaves when a later slot is filled first.
 * Capped at MAX_REVIEWS.
 */
export function normalizeReviews(
  content: { ownerReviews?: unknown } | null | undefined,
): ReviewItemContent[] {
  const raw = content?.ownerReviews;
  if (!Array.isArray(raw)) return [];

  const out: ReviewItemContent[] = [];
  for (const entry of raw) {
    if (out.length >= MAX_REVIEWS) break;
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const author = cleanString(item.author, REVIEW_LIMITS.author);
    const text = cleanString(item.text, REVIEW_LIMITS.text);
    const rating = parseReviewRating(item.rating);
    if (!author || !text || rating === null) continue;
    const date = cleanString(item.date, REVIEW_LIMITS.date);
    out.push({ author, rating, text, date: date || null });
  }
  return out;
}

export interface GoogleAggregate {
  /** One decimal place, 1.0-5.0. */
  rating: number;
  /** Whole number, at least 1. */
  count: number;
}

/**
 * The owner-entered Google rating badge. Returns null unless BOTH the rating
 * and the count are present and valid, so a half-filled badge never renders.
 * This is deliberately NOT derived from `reviews`: that list is hand-picked
 * and would overstate the real average.
 */
export function parseGoogleAggregate(
  content:
    | {
        ownerGoogleRating?: unknown;
        ownerGoogleReviewCount?: unknown;
      }
    | null
    | undefined,
): GoogleAggregate | null {
  const ratingRaw = content?.ownerGoogleRating;
  const countRaw = content?.ownerGoogleReviewCount;

  const rating =
    typeof ratingRaw === "number"
      ? ratingRaw
      : typeof ratingRaw === "string" && ratingRaw.trim() !== ""
        ? Number(ratingRaw)
        : NaN;
  const count =
    typeof countRaw === "number"
      ? countRaw
      : typeof countRaw === "string" && countRaw.trim() !== ""
        ? Number(countRaw)
        : NaN;

  if (!Number.isFinite(rating) || !Number.isFinite(count)) return null;
  if (rating < REVIEW_LIMITS.minRating || rating > REVIEW_LIMITS.maxRating) {
    return null;
  }
  if (!Number.isInteger(count)) return null;
  if (count < 1 || count > REVIEW_LIMITS.maxGoogleReviewCount) return null;

  return { rating: Math.round(rating * 10) / 10, count };
}

/** Only http(s) URLs may be rendered as an outbound review link. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export interface ReviewSectionView {
  reviews: ReviewItemContent[];
  aggregate: GoogleAggregate | null;
  googleUrl: string | null;
  /** True when there are reviews or a badge to show above the CTA. */
  hasProof: boolean;
}

/**
 * Everything the section component needs, decided in one place.
 * `showCta` is the section's `showNFC` config flag (defaults to on).
 * The section renders nothing when `hasProof` is false and there is no CTA.
 */
export function buildReviewSectionView(
  content:
    | {
        ownerReviews?: unknown;
        ownerGoogleRating?: unknown;
        ownerGoogleReviewCount?: unknown;
      }
    | null
    | undefined,
  googleUrlRaw: unknown,
): ReviewSectionView {
  const reviews = normalizeReviews(content);
  const aggregate = parseGoogleAggregate(content);
  const googleUrl = safeExternalUrl(googleUrlRaw);
  return {
    reviews,
    aggregate,
    googleUrl,
    hasProof: reviews.length > 0 || aggregate !== null,
  };
}

export function shouldRenderReviewSection(
  view: ReviewSectionView,
  showCta: boolean,
): boolean {
  return view.hasProof || (showCta && view.googleUrl !== null);
}

/**
 * Generators (AI and template) must never invent review data. Removes every
 * review field from any `reviews` section in a generated sections array, so
 * only the owner can add them. Returns a new array; inputs are not mutated.
 */
export function stripUnverifiedReviewData<
  T extends { section: string; content?: unknown },
>(sections: T[]): T[] {
  return sections.map((s) => {
    if (s.section !== "reviews") return s;
    if (!s.content || typeof s.content !== "object") return s;
    const content = { ...(s.content as Record<string, unknown>) };
    for (const key of UNVERIFIED_REVIEW_KEYS) delete content[key];
    return { ...s, content };
  });
}
