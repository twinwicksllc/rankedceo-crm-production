/**
 * Helpers for working with `unknown` caught values.
 *
 * With `strict` on, `catch (e)` gives `e: unknown`. Supabase/PostgREST errors are
 * plain objects with a `message` (not `Error` instances), so we accept any object
 * that carries a non-empty string `message`.
 */

export function getErrorMessage(
  error: unknown,
  fallback = "Unknown error",
): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}
