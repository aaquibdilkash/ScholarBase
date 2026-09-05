import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
  const isProtectedPath =
    pathname.startsWith("/admin")
    // pathname.startsWith("/messages") ||
    // (pathname.startsWith("/supervisor/") && pathname.endsWith("/recommend"));

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

    return redirectResponse;
  }

  return response;
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