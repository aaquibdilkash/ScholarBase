import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "node:crypto";
import { buildCsp, CSP_HEADER } from "@/lib/csp";

/**
 * Applies the CSP to a response object.
 *
 * This exists as a helper, called immediately before EVERY return, because of a
 * trap in this file: `supabase.auth.getUser()` can refresh the token, and the
 * `setAll` callback REPLACES the whole `response` object (see line ~35). A header
 * set before that point is silently discarded along with the old object — there
 * is no error, no warning, the response just ships without a policy. Two of the
 * three exits below also return different objects (a redirect here). Reading the
 * value from a `response` variable captured earlier would reintroduce exactly
 * that bug, so the caller always passes the object it is about to return.
 */
function applyCsp(response: NextResponse, nonce: string) {
  response.headers.set(CSP_HEADER, buildCsp(nonce));
  return response;
}

export async function proxy(request: NextRequest) {
  // A fresh nonce per request. Reusing one across responses would let an
  // attacker reuse a nonce they have already seen, which is most of what the
  // nonce buys.
  const nonce = randomBytes(16).toString("base64");
  const csp = buildCsp(nonce);

  let response = NextResponse.next({
    request: {
      // TWO headers are forwarded, and the second one is load-bearing.
      //
      //   `x-nonce` — read back by `layout.tsx` so our own inline PWA capture
      //   script can carry `nonce={...}`.
      //
      //   `Content-Security-Policy` (REQUEST side) — this is how Next.js learns
      //   the nonce and applies it to ITS OWN bootstrap scripts (the RSC payload
      //   and hydration inline scripts). `x-nonce` alone is NOT consulted.
      //
      // Getting this wrong is invisible under report-only and catastrophic
      // under enforcement: every framework script would be blocked and the app
      // would render as a blank page. Verified by reading the served response,
      // not assumed.
      headers: new Headers({
        ...Object.fromEntries(request.headers),
        "x-nonce": nonce,
        "Content-Security-Policy": csp,
      }),
    },
  });

  // 1. Detect whether the incoming request is hitting a staging or preview domain
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;

  const isStagingOrPreview =
    host.startsWith("dev.") || host.endsWith(".vercel.app");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 1. Update the request cookies so downstream Server Components see the refreshed session
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          // 2. Re-create the response with the updated request headers
          response = NextResponse.next({
            request,
          });

          // 3. Write the cookies to the response for the browser
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Define paths that strictly require authentication
  const isProtectedPath = pathname.startsWith("/admin");

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const originalPath = request.nextUrl.pathname + request.nextUrl.search;
    url.searchParams.set("callbackUrl", originalPath);

    // Create redirect response while PRESERVING session cookies (e.g. cleared tokens)
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    // Apply SEO shield to redirects if on staging/preview
    if (isStagingOrPreview) {
      redirectResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
    }

    // Path 1 of 3: the auth redirect, which returns a DIFFERENT object from the
    // normal path. Applying the policy only to `response` here would leave
    // every unauthenticated /admin navigation without one.
    return applyCsp(redirectResponse, nonce);
  }

  // 2. SEO SHIELD: Tell Googlebot and all web crawlers never to index staging/preview URLs
  if (isStagingOrPreview) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // Paths 2 and 3 both arrive here: a page that was never rewritten, and a page
  // whose `response` was REPLACED by the token-refresh callback above. Passing the
  // variable (not a saved reference) is what guarantees the header lands on
  // whichever object is actually being returned.
  return applyCsp(response, nonce);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)",
  ],
};