// ============================================================
// What a lead form shows after a submit
// ============================================================
// The page wrappers are "use server" functions. A server action that THROWS has
// its message replaced by a digest in production, so the wrapper returns
// `{ error }` for a failure and calls redirect() only on success. The form
// passes whatever the call produced (a returned outcome, or a caught error)
// to submitErrorMessage and shows the result.
// ============================================================

export const GENERIC_SUBMIT_ERROR =
  "We could not submit your request. Please check your details and try again.";

export interface LeadSubmitOutcome {
  error?: string;
}

/**
 * True for the error Next.js throws from redirect() so the framework can
 * navigate. Its `digest` starts with "NEXT_REDIRECT". A form that catches
 * everything must rethrow it, or a successful submit would show a failure.
 * Matched by shape, not by importing Next's internal helper, so this stays
 * testable and does not depend on a private path.
 */
export function isRedirectError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * The message to show, or null when there is nothing to show.
 *
 * - undefined / null / {}: no failure was reported (a success redirects away).
 * - { error }: show it, or the generic text when it is blank.
 * - a thrown value of any kind: the generic text, never the thrown text, which
 *   in production is an opaque digest and in development may be internal.
 */
export function submitErrorMessage(outcome: unknown): string | null {
  if (outcome === undefined || outcome === null) return null;
  if (outcome instanceof Error || typeof outcome !== "object") {
    return GENERIC_SUBMIT_ERROR;
  }
  const error = (outcome as LeadSubmitOutcome).error;
  if (error === undefined) return null;
  return typeof error === "string" && error.trim() !== ""
    ? error
    : GENERIC_SUBMIT_ERROR;
}
