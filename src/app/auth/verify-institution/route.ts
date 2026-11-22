import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import prisma from "@/lib/db";
import { getBaseUrl } from "@/lib/url";

/**
 * Redirects must not be built from `request.url`.
 *
 * Behind the production reverse proxy, `request.url` resolves to the internal
 * bind address (`https://0.0.0.0:3000`), so a verified user was sent to an
 * unreachable host right after the badge was granted — the database was
 * updated, but the page they landed on was dead. `getBaseUrl` resolves the
 * public origin from the configured site URL or the forwarded host headers.
 */
function redirectWithCookies(url: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectResponse;
}

async function redirectToSettings(userId: string, result: string, response: NextResponse) {
  const url = new URL(`/scholars/${userId}/settings`, await getBaseUrl());
  url.searchParams.set("tab", "security");
  url.searchParams.set("institution", result);
  return redirectWithCookies(url, response);
}

export async function GET(request: NextRequest) {
  // Preserve refreshed auth cookies on the redirect. Otherwise an expiring
  // session can make the destination appear logged out until a manual refresh.
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();
  const token = request.nextUrl.searchParams.get("token") ?? "";

  if (!supabaseUser) {
    const loginUrl = new URL("/login", await getBaseUrl());
    loginUrl.searchParams.set("error", "institution-verification-login-required");
    if (/^[a-f0-9]{64}$/.test(token)) {
      loginUrl.searchParams.set(
        "callbackUrl",
        `/auth/verify-institution?token=${encodeURIComponent(token)}`,
      );
    }
    return redirectWithCookies(loginUrl, response);
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return redirectToSettings(supabaseUser.id, "invalid", response);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const pendingVerification = await prisma.user.findUnique({
    where: { institutionVerificationTokenHash: tokenHash },
    select: {
      id: true,
      pendingInstitutionEmail: true,
      pendingInstitutionDomain: true,
      institutionVerificationExpiresAt: true,
    },
  });

  if (!pendingVerification || pendingVerification.id !== supabaseUser.id) {
    return redirectToSettings(supabaseUser.id, "invalid", response);
  }

  if (
    !pendingVerification.institutionVerificationExpiresAt ||
    pendingVerification.institutionVerificationExpiresAt <= new Date()
  ) {
    return redirectToSettings(supabaseUser.id, "expired", response);
  }

  const verifiedAt = new Date();
  let result = 0;
  try {
    result = await prisma.$transaction(async (tx) => {
      const targetEmail = pendingVerification.pendingInstitutionEmail;
      const updateResult = await tx.user.updateMany({
        where: {
          id: supabaseUser.id,
          institutionVerificationTokenHash: tokenHash,
          institutionVerificationExpiresAt: { gt: verifiedAt },
        },
        data: targetEmail
          ? {
              institutionEmail: targetEmail,
              institutionDomain:
                pendingVerification.pendingInstitutionDomain,
              institutionVerifiedAt: verifiedAt,
              pendingInstitutionEmail: null,
              pendingInstitutionDomain: null,
              institutionVerificationTokenHash: null,
              institutionVerificationExpiresAt: null,
            }
          : {
              // Compatibility for tokens created before pending institution
              // fields existed: the legacy institutionEmail is already the
              // address that was requested.
              institutionVerifiedAt: verifiedAt,
              pendingInstitutionEmail: null,
              pendingInstitutionDomain: null,
              institutionVerificationTokenHash: null,
              institutionVerificationExpiresAt: null,
            },
      });

      return updateResult.count;
    });
  } catch {
    // Another account may have verified the same address after this request
    // was created. The unique institutionEmail constraint wins safely.
    return redirectToSettings(supabaseUser.id, "invalid", response);
  }

  return redirectToSettings(supabaseUser.id, result === 1 ? "verified" : "invalid", response);
}
