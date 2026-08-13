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
  const flowId = searchParams.get("sb_flow_id");
  const next = getSafeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  // Keep the response instance that Supabase writes its recovery-session
  // cookies to. Creating a separate redirect response drops those cookies.
  const response = NextResponse.redirect(new URL(next, origin));
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

  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  return response;
}
