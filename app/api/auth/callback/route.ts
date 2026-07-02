// =============================================================================
// Supabase OAuth Callback Handler
// Handles Google OAuth (PKCE + implicit) and Magic Link redirects
//
// Cross-domain flow (audit.rankedceo.com → crm.rankedceo.com):
//   1. OAuth starts on audit.rankedceo.com
//   2. Supabase redirects to Google
//   3. Google returns ?code= to crm.rankedceo.com/api/auth/callback
//      with ?next=https://audit.rankedceo.com/audit/start
//   4. This handler exchanges the code, sets .rankedceo.com cookies,
//      then redirects to audit.rankedceo.com/audit/start
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function applyCookieScope(
  request: NextRequest,
  options: CookieOptions,
): CookieOptions {
  const host = (request.headers.get("host") || "").split(":")[0];
  const isProductionDomain =
    host.endsWith(".rankedceo.com") || host === "rankedceo.com";

  return isProductionDomain
    ? { ...options, domain: ".rankedceo.com", sameSite: "lax", secure: true }
    : options;
}

function resolveSafeNext(next: string, origin: string): string {
  if (!next) return `${origin}/dashboard`;

  // Absolute URL — allow any https rankedceo.com subdomain
  if (next.startsWith("http://") || next.startsWith("https://")) {
    try {
      const parsed = new URL(next);
      const isHttps = parsed.protocol === "https:";
      const isRankedCeoHost =
        parsed.hostname === "rankedceo.com" ||
        parsed.hostname.endsWith(".rankedceo.com");

      if (isHttps && isRankedCeoHost) {
        return parsed.toString();
      }
    } catch {
      // Invalid URL — fall through to default
    }
    return `${origin}/dashboard`;
  }

  // Relative path — resolve against origin
  if (next.startsWith("/")) {
    return `${origin}${next}`;
  }

  return `${origin}/dashboard`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");

  // ── Handle OAuth errors ────────────────────────────────────────────────────
  if (error) {
    console.error("[Auth Callback] OAuth error:", error);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error);
    return NextResponse.redirect(loginUrl.toString());
  }

  // ── PKCE code exchange ─────────────────────────────────────────────────────
  if (code) {
    const redirectTarget = resolveSafeNext(next, origin);
    const response = NextResponse.redirect(redirectTarget);

    // Build a cookie jar that reads ALL incoming cookies (including those
    // originally set on a different subdomain with domain=.rankedceo.com,
    // e.g. the PKCE code-verifier set on audit.rankedceo.com)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            // Check direct cookie first, then try common Supabase PKCE key patterns
            const direct = request.cookies.get(name)?.value;
            if (direct) return direct;

            // Supabase stores the PKCE verifier under a hashed project-ref key.
            // When auth starts on audit.rankedceo.com, the verifier cookie is set
            // with domain=.rankedceo.com so it IS present here on crm — but
            // the key name may differ slightly. Search all cookies for a match.
            if (
              name.includes("code-verifier") ||
              name.includes("auth-token-code-verifier")
            ) {
              for (const cookie of request.cookies.getAll()) {
                if (cookie.name.includes("code-verifier")) {
                  return cookie.value;
                }
              }
            }

            return undefined;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value,
              ...applyCookieScope(request, options),
            });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: "",
              ...applyCookieScope(request, options),
            });
          },
        },
        auth: {
          // Allow both PKCE and implicit token flows
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(
        "[Auth Callback] Code exchange error:",
        exchangeError.message,
      );

      // If PKCE verifier not found AND this looks like a cross-domain audit flow,
      // redirect to audit login with a clear message instead of a raw error
      const isAuditFlow =
        next.includes("audit.rankedceo.com") || next.includes("/audit/");
      if (
        exchangeError.message.includes("code verifier") ||
        exchangeError.message.includes("PKCE")
      ) {
        if (isAuditFlow) {
          return NextResponse.redirect(
            "https://audit.rankedceo.com/login?error=session_expired",
          );
        }
      }

      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(loginUrl.toString());
    }

    return response;
  }

  // ── No code — redirect to login ────────────────────────────────────────────
  return NextResponse.redirect(`${origin}/login`);
}
