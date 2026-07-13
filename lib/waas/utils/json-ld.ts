// =============================================================================
// WaaS: JSON-LD safe serialization helpers
//
// `JSON.stringify()` does NOT escape `<` characters. When a JSON-LD object is
// injected via `dangerouslySetInnerHTML` into a `<script type="application/ld+json">`
// tag, any user-controllable string that contains the literal substring
// `</script>` will prematurely close the script element and allow arbitrary
// HTML/script injection into the page — a well-known JSON-LD XSS vector.
//
// The business name, AEO answer text, service description, offer name, etc. all
// flow through client-editable fields or AI generation, so they are user/AI
// controllable. `toSafeJsonLdString()` escapes `<` (and `>` / line separators
// for good measure) to its Unicode escape so the serialized payload can never
// break out of the script tag.
//
// Reference: https://mathiasbynens.be/notes/etago (ETAGO handling)
//            https://github.com/whatwg/html/issues/2980
// =============================================================================

/**
 * Serialize a JSON-LD object to a string that is safe to inject into a
 * `<script type="application/ld+json">` element via `dangerouslySetInnerHTML`.
 *
 * Escapes:
 *   `<` -> `\u003c`  (prevents `</script>` ETAGO breakout — the primary XSS fix)
 *   `>` -> `\u003e`  (defense-in-depth for `<script>` opener sequences)
 *   U+2028 -> `\u2028` (line separator — legal in JS strings, breaks out in some legacy parsers)
 *   U+2029 -> `\u2029` (paragraph separator — same reason)
 *
 * All of these are valid inside JSON strings and are decoded identically by
 * every spec-compliant JSON parser, so the structured data remains semantically
 * identical to the unescaped output.
 */
export function toSafeJsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
