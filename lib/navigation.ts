/**
 * Full page load to `url` (a normal browser navigation, not a Next.js client
 * transition).
 *
 * Use this, not `router.push`, when the destination must be fetched fresh from
 * the server: after sign-in or sign-out so server components see the new
 * cookies, or when the target is a route handler that redirects (for example
 * the OAuth connect endpoints under `/api`). For ordinary page-to-page links
 * keep using `<Link>` / `router.push`.
 */
export function hardNavigate(url: string): void {
  window.location.href = url;
}
