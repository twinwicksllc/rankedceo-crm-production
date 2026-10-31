// =============================================================================
// lib/waas/client-edit/content-paths.ts
// Safe JSONPath-style patcher for nested variant section content.
//
// Supports paths like:
//   "sections[0].content.headline"
//   "sections[2].content.body_text"
//   "sections[1].content.image_url"
//   "brand_config.primary_color"
//   "brand_config.business_name"
// =============================================================================

import { SECTION_ID_PATTERN } from "@/lib/waas/sections/section-ids";
import {
  MAX_REVIEWS,
  OWNER_GOOGLE_COUNT_KEY,
  OWNER_GOOGLE_RATING_KEY,
  OWNER_REVIEWS_KEY,
  REVIEW_LIMITS,
  parseGoogleAggregate,
  parseReviewRating,
} from "@/lib/waas/reviews";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Path segment types
// ---------------------------------------------------------------------------

type PathSegment =
  { type: "key"; key: string } | { type: "index"; index: number };

// ---------------------------------------------------------------------------
// Parse a dot/bracket path string into segments
// e.g. "sections[0].content.headline" →
//   [{type:'key',key:'sections'}, {type:'index',index:0},
//    {type:'key',key:'content'},  {type:'key',key:'headline'}]
// ---------------------------------------------------------------------------

export function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  // Split on . and [ — keep the index numbers
  const parts = path.split(/\.|\[(\d+)\]\.?/).filter(Boolean);

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      segments.push({ type: "index", index: parseInt(part, 10) });
    } else if (part.trim()) {
      segments.push({ type: "key", key: part.trim() });
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Read a value at path (returns undefined if path does not exist)
// ---------------------------------------------------------------------------

export function getValueAtPath(
  obj: JsonValue,
  path: string,
): JsonValue | undefined {
  const segments = parsePath(path);
  let current: JsonValue = obj;

  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;

    if (seg.type === "key") {
      if (typeof current !== "object" || Array.isArray(current))
        return undefined;
      current = (current as Record<string, JsonValue>)[seg.key];
    } else {
      if (!Array.isArray(current)) return undefined;
      current = current[seg.index];
    }
  }

  return current;
}

// ---------------------------------------------------------------------------
// Immutably set a value at path — returns new object
// Returns { ok: true, result } on success or { ok: false, error } on failure
// ---------------------------------------------------------------------------

export type PatchResult =
  { ok: true; result: JsonValue } | { ok: false; error: string };

export function setValueAtPath(
  obj: JsonValue,
  path: string,
  newValue: JsonValue,
): PatchResult {
  try {
    if (path.includes("[id=")) {
      // The patcher works on array positions; callers must resolve id paths
      // with resolveSectionPath() first.
      return { ok: false, error: "Section id paths must be resolved first" };
    }
    const segments = parsePath(path);
    if (segments.length === 0) {
      return { ok: false, error: "Path is empty" };
    }

    const result = deepSetRecursive(obj, segments, 0, newValue);
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown patch error",
    };
  }
}

function deepSetRecursive(
  current: JsonValue,
  segments: PathSegment[],
  depth: number,
  newValue: JsonValue,
): JsonValue {
  if (depth === segments.length) return newValue;

  const seg = segments[depth];

  if (seg.type === "key") {
    // Treat null/non-object as an empty object at this level
    const base: Record<string, JsonValue> =
      current !== null && typeof current === "object" && !Array.isArray(current)
        ? { ...(current as Record<string, JsonValue>) }
        : {};

    base[seg.key] = deepSetRecursive(
      base[seg.key] !== undefined ? base[seg.key] : null,
      segments,
      depth + 1,
      newValue,
    );
    return base;
  } else {
    // Array index
    const base: JsonValue[] = Array.isArray(current) ? [...current] : [];
    // Pad array if index is beyond current length
    while (base.length <= seg.index) base.push(null);
    base[seg.index] = deepSetRecursive(
      base[seg.index],
      segments,
      depth + 1,
      newValue,
    );
    return base;
  }
}

// ---------------------------------------------------------------------------
// Validate that a path is allowlisted (prevent arbitrary key injection)
// ---------------------------------------------------------------------------

const ALLOWED_PATH_PREFIXES = ["sections[", "brand_config."] as const;

// Brand config keys clients can edit (matches BrandConfig interface in
// lib/waas/templates/types.ts — real shape includes nested colors.* etc.)
const ALLOWED_BRAND_KEYS = new Set([
  "brand_config.business_name",
  "brand_config.tagline",
  "brand_config.logo_url",
  "brand_config.hero_image_url", // Phase 7.2
  "brand_config.colors.primary",
  "brand_config.colors.secondary",
  "brand_config.colors.accent",
  "brand_config.colors.background",
  "brand_config.colors.text",
  "brand_config.fonts.heading", // Phase 7.1
  "brand_config.fonts.body", // Phase 7.1
  "brand_config.contact.phone",
  "brand_config.contact.email",
  "brand_config.contact.address",
  "brand_config.contact.city",
  "brand_config.contact.state",
  "brand_config.contact.zip",
  "brand_config.social.facebook",
  "brand_config.social.instagram",
  "brand_config.social.google",
  "brand_config.social.yelp",
]);

// Top-level leaf keys inside sections[N].content (matches the Section*Content
// interfaces in lib/waas/templates/types.ts — all camelCase)
const ALLOWED_SECTION_CONTENT_KEYS = new Set([
  "eyebrow",
  "headline",
  "subheadline",
  "body",
  "intro",
  "primaryCtaLabel",
  "secondaryCtaLabel",
  "locationBadge",
  "bottomCtaText",
  "image_url", // generic image fields (future-proof)
  "image_alt",
]);

// Top-level leaf keys inside sections[N].config that clients/admins may edit
// (Phase 8.6 — audit finding 2.1). Config keys drive runtime behavior
// (dispatch fee, response window, Q&A caps, JSON-LD toggle, visual preset)
// rather than display copy, so they are validated separately from content
// keys and must match the definitions in editable-fields.ts's
// SECTION_CONFIG_FIELDS map exactly.
const ALLOWED_SECTION_CONFIG_KEYS = new Set([
  // bento-emergency
  "responseMinutes",
  "dispatchFee",
  "visualDirection",
  "emergencyLabel",
  "standardLabel",
  "operatingHours",
  "serviceArea",
  "brands",
  // answer-first-aeo
  "maxItems",
  "maxAnswerWords",
  "includeJsonLd",
  // booking: lead form (B5)
  "formEnabled",
  "formHeading",
  "formButtonLabel",
  "formSuccessMessage",
  "formServices",
]);

// Keys permitted on items in arrays like services[i], faq[i], steps[i],
// badges[i], highlights[i].  Values that are themselves arrays-of-strings
// are matched separately below (highlights[i]).
const ALLOWED_ARRAY_ITEM_KEYS = new Set([
  "title",
  "description",
  "label",
  "sub",
  "icon",
  "question",
  "answer",
  "sourceLabel",
  "lastUpdated",
  "image_url", // Phase 7.3: gallery item image
  "caption", // Phase 7.3: gallery item caption
  "alt", // Phase 7.3: gallery item alt text
]);

// ---------------------------------------------------------------------------
// Config-value validation (Phase 8.6 — audit finding 2.1)
//
// Path allow-listing (above) only confirms a config *key* is editable.
// Config values drive real runtime behavior, so we additionally validate the
// *value* server-side — independent of any client-side coercion in the
// editor UI — so a direct server-action call can never persist a NaN,
// out-of-range, or wrong-typed config value (mirrors the NaN-guard fix
// applied to section rendering in lib/waas/utils/section-config.ts).
// ---------------------------------------------------------------------------

type ConfigValueValidator = (value: JsonValue) => PathValidationResult;

const numberRangeValidator = (
  min: number,
  max: number,
): ConfigValueValidator => {
  return (value) => {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : NaN;
    if (!Number.isFinite(num)) {
      return { valid: false, reason: "Value must be a finite number" };
    }
    if (num < min || num > max) {
      return {
        valid: false,
        reason: `Value must be between ${min} and ${max}`,
      };
    }
    return { valid: true };
  };
};

const booleanValidator: ConfigValueValidator = (value) => {
  if (
    typeof value === "boolean" ||
    value === "true" ||
    value === "false"
  ) {
    return { valid: true };
  }
  return { valid: false, reason: "Value must be a boolean" };
};

const stringWithMaxLenValidator = (maxLen: number): ConfigValueValidator => {
  return (value) => {
    if (typeof value !== "string") {
      return { valid: false, reason: "Value must be a string" };
    }
    if (value.length > maxLen) {
      return {
        valid: false,
        reason: `Value exceeds maximum length of ${maxLen} characters`,
      };
    }
    return { valid: true };
  };
};

const stringSelectValidator = (allowed: string[]): ConfigValueValidator => {
  return (value) => {
    if (typeof value !== "string" || !allowed.includes(value)) {
      return {
        valid: false,
        reason: `Value must be one of: ${allowed.join(", ")}`,
      };
    }
    return { valid: true };
  };
};

const stringArrayValidator = (
  maxItems: number,
  maxItemLen: number,
): ConfigValueValidator => {
  return (value) => {
    // Accept either a real array of strings or a CSV string (the editor UI
    // sends CSV for `string_list`-kind fields; both are valid persisted forms).
    const items = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",").map((s) => s.trim())
        : null;

    if (!items) {
      return {
        valid: false,
        reason: "Value must be an array of strings or a comma-separated string",
      };
    }
    if (items.length > maxItems) {
      return {
        valid: false,
        reason: `Value must contain at most ${maxItems} items`,
      };
    }
    for (const item of items) {
      if (typeof item !== "string" || item.length > maxItemLen) {
        return {
          valid: false,
          reason: `Each item must be a string of at most ${maxItemLen} characters`,
        };
      }
    }
    return { valid: true };
  };
};

const CONFIG_VALUE_VALIDATORS: Record<string, ConfigValueValidator> = {
  // bento-emergency
  responseMinutes: numberRangeValidator(1, 999),
  dispatchFee: numberRangeValidator(0, 9999),
  visualDirection: stringSelectValidator([
    "signal",
    "calm",
    "warm",
    "premium",
    "showcase",
  ]),
  emergencyLabel: stringWithMaxLenValidator(60),
  standardLabel: stringWithMaxLenValidator(60),
  operatingHours: stringWithMaxLenValidator(80),
  serviceArea: stringWithMaxLenValidator(120),
  brands: stringArrayValidator(12, 40),
  // answer-first-aeo
  maxItems: numberRangeValidator(1, 20),
  maxAnswerWords: numberRangeValidator(20, 300),
  includeJsonLd: booleanValidator,
  // booking: lead form (B5)
  formEnabled: booleanValidator,
  formHeading: stringWithMaxLenValidator(80),
  formButtonLabel: stringWithMaxLenValidator(30),
  formSuccessMessage: stringWithMaxLenValidator(200),
  formServices: stringArrayValidator(8, 40),
};

/**
 * Validate a value intended for a `sections[N].config.<key>` path.
 * Returns `{ valid: true }` for keys with no registered validator (keeps
 * this additive/non-breaking for any future config key that hasn't been
 * wired with a validator yet — the path allow-list in `validateEditPath`
 * is still the primary gate for *which* keys are editable at all).
 */
export function validateConfigValue(
  key: string,
  value: JsonValue,
): PathValidationResult {
  const validator = CONFIG_VALUE_VALIDATORS[key];
  if (!validator) return { valid: true };
  return validator(value);
}

// Review fields (see lib/waas/reviews.ts). Kept apart from the generic
// allow-lists above on purpose.
const REVIEW_ITEM_KEYS = new Set(["author", "rating", "text", "date"]);
const REVIEW_CONTENT_KEYS = new Set([
  OWNER_GOOGLE_RATING_KEY,
  OWNER_GOOGLE_COUNT_KEY,
]);

// Built from the exported key constants in lib/waas/reviews.ts so the path
// regexes can never drift from the keys the section actually reads/writes.
const SECTION_CONTENT_PREFIX =
  String.raw`sections\[(?:\d+|id=[A-Za-z0-9_-]+)\]\.content\.`;
const REVIEW_ITEM_PATH_RE = new RegExp(
  `^${SECTION_CONTENT_PREFIX}${OWNER_REVIEWS_KEY}\\[\\d+\\]\\.([a-zA-Z0-9_]+)$`,
);
const REVIEW_AGGREGATE_PATH_RE = new RegExp(
  `^${SECTION_CONTENT_PREFIX}(${OWNER_GOOGLE_RATING_KEY}|${OWNER_GOOGLE_COUNT_KEY})$`,
);

/**
 * Validate the VALUE written to a review path. Path allow-listing only
 * confirms the key is editable; this stops a direct server-action call from
 * persisting a 9-star rating, a 10 MB review, or a half-formed Google badge.
 * An empty string is always allowed: it is how an owner clears a field.
 * Returns `{ valid: true }` for any path that is not a review path.
 */
export function validateReviewValue(
  path: string,
  value: JsonValue,
): PathValidationResult {
  const item = path.match(REVIEW_ITEM_PATH_RE);
  const aggregate = item ? null : path.match(REVIEW_AGGREGATE_PATH_RE);
  if (!item && !aggregate) return { valid: true };

  const key = (item ? item[1] : aggregate?.[1]) as string;
  const isBlank = value === null || (typeof value === "string" && !value.trim());
  if (isBlank) return { valid: true };

  const maxLen = (limit: number, label: string): PathValidationResult =>
    typeof value === "string" && value.length <= limit
      ? { valid: true }
      : {
          valid: false,
          reason: `${label} must be text of at most ${limit} characters`,
        };

  switch (key) {
    case "author":
      return maxLen(REVIEW_LIMITS.author, "Reviewer name");
    case "text":
      return maxLen(REVIEW_LIMITS.text, "Review text");
    case "date":
      return maxLen(REVIEW_LIMITS.date, "Review date");
    case "rating":
      return parseReviewRating(value) === null
        ? { valid: false, reason: "Rating must be a whole number from 1 to 5" }
        : { valid: true };
    case OWNER_GOOGLE_RATING_KEY:
      return parseGoogleAggregate({
        [OWNER_GOOGLE_RATING_KEY]: value,
        [OWNER_GOOGLE_COUNT_KEY]: 1,
      })
        ? { valid: true }
        : { valid: false, reason: "Google rating must be between 1 and 5" };
    case OWNER_GOOGLE_COUNT_KEY:
      return parseGoogleAggregate({
        [OWNER_GOOGLE_RATING_KEY]: 5,
        [OWNER_GOOGLE_COUNT_KEY]: value,
      })
        ? { valid: true }
        : {
            valid: false,
            reason: `Google review count must be a whole number from 1 to ${REVIEW_LIMITS.maxGoogleReviewCount.toLocaleString("en-US")}`,
          };
    default:
      return { valid: false, reason: `Unknown review field '${key}'` };
  }
}

const ID_REF_RE = new RegExp(`^sections\\[id=(${SECTION_ID_PATTERN})\\]`);

export type PathValidationResult =
  { valid: true } | { valid: false; reason: string };

export function validateEditPath(path: string): PathValidationResult {
  if (!path || typeof path !== "string") {
    return { valid: false, reason: "Path must be a non-empty string" };
  }

  if (path.length > 200) {
    return {
      valid: false,
      reason: "Path exceeds maximum length of 200 characters",
    };
  }

  // Check allowed prefixes
  const hasAllowedPrefix = ALLOWED_PATH_PREFIXES.some((p) =>
    path.startsWith(p),
  );
  if (!hasAllowedPrefix) {
    return {
      valid: false,
      reason: `Path must start with one of: ${ALLOWED_PATH_PREFIXES.join(", ")}`,
    };
  }

  // Id form `sections[id=<id>]...` is checked with the same patterns as the
  // numeric form: swap the id (strictly validated) for a position.
  const idRef = path.match(ID_REF_RE);
  if (path.startsWith("sections[id=") && !idRef) {
    return { valid: false, reason: "Section id in path is not valid" };
  }
  const shape = idRef ? path.replace(ID_REF_RE, "sections[0]") : path;

  // Brand config paths — check against explicit allowlist
  if (path.startsWith("brand_config.")) {
    if (!ALLOWED_BRAND_KEYS.has(path)) {
      return {
        valid: false,
        reason: `Brand config key '${path}' is not editable by clients`,
      };
    }
    return { valid: true };
  }

  // Section content paths — validate the leaf key
  // Pattern 1: sections[N].content.<allowed_key>
  const sectionContentMatch = shape.match(
    /^sections\[\d+\]\.content\.([a-zA-Z0-9_]+)$/,
  );
  if (sectionContentMatch) {
    const leafKey = sectionContentMatch[1];
    if (
      !ALLOWED_SECTION_CONTENT_KEYS.has(leafKey) &&
      !REVIEW_CONTENT_KEYS.has(leafKey)
    ) {
      return {
        valid: false,
        reason: `Section content key '${leafKey}' is not editable by clients`,
      };
    }
    return { valid: true };
  }

  // Section config paths — validate the leaf key against the config allow-list
  // Pattern: sections[N].config.<allowed_key>  (Phase 8.6 — audit finding 2.1)
  const sectionConfigMatch = shape.match(
    /^sections\[\d+\]\.config\.([a-zA-Z0-9_]+)$/,
  );
  if (sectionConfigMatch) {
    const leafKey = sectionConfigMatch[1];
    if (!ALLOWED_SECTION_CONFIG_KEYS.has(leafKey)) {
      return {
        valid: false,
        reason: `Section config key '${leafKey}' is not editable by clients`,
      };
    }
    return { valid: true };
  }

  // Reviews (real, owner-entered only; see lib/waas/reviews.ts). Deliberately
  // NOT folded into ALLOWED_ARRAY_ITEM_KEYS: `author`, `text` and `rating`
  // must not become editable on services/faq/steps items.
  //   sections[N].content.ownerReviews[M].<author|rating|text|date>  (M < 6)
  //   sections[N].content.<ownerGoogleRating|ownerGoogleReviewCount>
  const reviewItemMatch = shape.match(
    new RegExp(
      `^sections\\[\\d+\\]\\.content\\.${OWNER_REVIEWS_KEY}\\[(\\d+)\\]\\.([a-zA-Z0-9_]+)$`,
    ),
  );
  if (reviewItemMatch) {
    const slot = Number(reviewItemMatch[1]);
    const leafKey = reviewItemMatch[2];
    if (slot >= MAX_REVIEWS) {
      return {
        valid: false,
        reason: `At most ${MAX_REVIEWS} reviews can be added`,
      };
    }
    if (!REVIEW_ITEM_KEYS.has(leafKey)) {
      return {
        valid: false,
        reason: `Review key '${leafKey}' is not editable by clients`,
      };
    }
    return { valid: true };
  }

  // Pattern 2: sections[N].content.<arrayField>[M].<allowed_item_key>
  //   e.g. sections[2].content.items[0].title
  //        sections[3].content.steps[1].description
  //        sections[4].content.badges[0].label
  const arrayItemMatch = shape.match(
    /^sections\[\d+\]\.content\.([a-zA-Z0-9_]+)\[\d+\]\.([a-zA-Z0-9_]+)$/,
  );
  if (arrayItemMatch) {
    const arrayField = arrayItemMatch[1];
    const leafKey = arrayItemMatch[2];
    const allowedArrayFields = new Set([
      "items",
      "steps",
      "badges",
      "faq",
      "gallery",
    ]);
    if (!allowedArrayFields.has(arrayField)) {
      return {
        valid: false,
        reason: `Array field '${arrayField}' is not editable by clients`,
      };
    }
    if (!ALLOWED_ARRAY_ITEM_KEYS.has(leafKey)) {
      return {
        valid: false,
        reason: `Item key '${leafKey}' is not editable by clients`,
      };
    }
    return { valid: true };
  }

  // Pattern 3: sections[N].content.highlights[M]  (string array, no leaf key)
  const highlightMatch = shape.match(
    /^sections\[\d+\]\.content\.highlights\[\d+\]$/,
  );
  if (highlightMatch) return { valid: true };

  // Pattern 4: sections[N].content.items[M].keyFacts[K] (answer-first-aeo)
  const keyFactsMatch = shape.match(
    /^sections\[\d+\]\.content\.items\[\d+\]\.keyFacts\[\d+\]$/,
  );
  if (keyFactsMatch) return { valid: true };

  // sections[N].enabled is also allowed (section toggle)
  const sectionEnabledMatch = shape.match(/^sections\[\d+\]\.enabled$/);
  if (sectionEnabledMatch) return { valid: true };

  return {
    valid: false,
    reason: `Path '${path}' does not match any allowed edit pattern`,
  };
}

// ---------------------------------------------------------------------------
// Extract a plain-text snapshot of a value for diffing / history display
// Truncates long strings and serializes arrays/objects
// ---------------------------------------------------------------------------

export function serializeForHistory(
  value: JsonValue | undefined,
  maxLen = 500,
): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    return value.length > maxLen ? value.slice(0, maxLen) + "…" : value;
  }
  const json = JSON.stringify(value);
  return json.length > maxLen ? json.slice(0, maxLen) + "…" : json;
}
