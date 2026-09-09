import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/db";
import { isAllowedEmailDomain } from "@/lib/email-domain-allowlist";
import { recoverDeletedAccount } from "@/lib/account-recovery";

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

  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        type: type as "recovery" | "signup" | "invite" | "email_change",
        token_hash: tokenHash!,
      });

  if (error) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", publicOrigin));
  }

  // Email signup and OAuth can both create a Supabase user without passing
  // through the email signup form. Keep the allowlist enforced at the auth
  // callback boundary as well, while preserving existing user accounts and
  // password-recovery flows.
  if (data.user && type !== "recovery") {
    const existingProfile = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: { id: true, isDeleted: true },
    });

    if (existingProfile?.isDeleted) {
      const recovery = await recoverDeletedAccount(data.user.id);
      if (recovery === "expired") {
        await supabase.auth.signOut();
        response.headers.set(
          "Location",
          new URL(
            "/login?error=account-recovery-expired",
            publicOrigin,
          ).toString(),
        );
        return response;
      }
    }

    if (existingProfile === null && !isAllowedEmailDomain(data.user.email ?? "")) {
      await supabase.auth.signOut();
      // Keep the same response object so the signOut cookie removals are
      // returned to the browser along with the redirect.
      response.headers.set(
        "Location",
        new URL("/login?error=email-domain-not-allowed", publicOrigin).toString(),
      );
      return response;
    }
  }

  return response;
}
