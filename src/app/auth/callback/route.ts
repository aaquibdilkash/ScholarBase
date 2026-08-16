import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSafeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const flowId = searchParams.get("sb_flow_id");
  const next = getSafeNextPath(searchParams.get("next"));
  const fallbackNext = type === "recovery" ? "/auth/update-password" : "/";
  const destination = getSafeNextPath(next === "/" ? fallbackNext : next);

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  // Keep the response instance that Supabase writes its recovery-session
  // cookies to. Creating a separate redirect response drops those cookies.
  const response = NextResponse.redirect(new URL(destination, origin));
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
    ? await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      )
    : await supabase.auth.verifyOtp({
        type: type as "recovery" | "signup" | "invite" | "email_change",
        token_hash: tokenHash!,
      });

  if (error) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  return response;
}
