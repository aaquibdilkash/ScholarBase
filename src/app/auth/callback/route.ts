import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSafeNextPath(next: string | null): string {
  if (!next) return "/";
  const trimmed = next.trim();
  // Prevent open redirect attacks (must start with / and not //)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return "/";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Determine the correct public origin behind reverse proxies (Vercel)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const isLocal = process.env.NODE_ENV === "development";

  const publicOrigin = isLocal
    ? request.nextUrl.origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;

  // Resolve target destination
  const rawTarget =
    searchParams.get("next") ||
    searchParams.get("callbackUrl") ||
    (type === "recovery" ? "/auth/update-password" : "/");

  const destination = getSafeNextPath(rawTarget);

  // Missing code or token hash
  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", publicOrigin));
  }

  // Pre-instantiate response to capture session cookies
  const response = NextResponse.redirect(new URL(destination, publicOrigin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        type: type as "recovery" | "signup" | "invite" | "email_change",
        token_hash: tokenHash!,
      });

  if (error) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", publicOrigin));
  }

  return response;
}