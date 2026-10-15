// =============================================================================
// Safe post-auth redirect
//
// The audit login/confirm pages forward to a caller-supplied destination after
// sign-in (so a magic-link or Google sign-in returns the user to the report
// they were reading). That value travels through the URL, so it must be
// validated before use or it becomes an open redirect.
//
// Only same-origin relative paths are allowed: the value must start with a
// single "/" and must not contain a backslash, whitespace, or control
// characters. Anything else — absolute URLs, protocol-relative "//evil.com",
// "javascript:", "/\evil.com" — is rejected and the fallback is returned.
// =============================================================================

export const DEFAULT_AUDIT_REDIRECT = "/audit/start";

export function resolveSafeRedirect(
  target: string | null | undefined,
  fallback: string = DEFAULT_AUDIT_REDIRECT,
): string {
  if (!target) return fallback;

  const value = target.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback; // protocol-relative URL
  if (value.includes("\\")) return fallback; // backslash trick
  // Whitespace / control chars could break out of the path or header.
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f]/.test(value)) return fallback;

  return value;
}
