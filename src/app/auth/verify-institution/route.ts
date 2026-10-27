import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import prisma from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { createClient } from "@/utils/supabase/server";

/**
 * Redirects must not be built from `request.url`.
 *
 * Behind the production reverse proxy, `request.url` resolves to the internal
 * bind address (`https://0.0.0.0:3000`), so a verified user was sent to an
 * unreachable host right after the badge was granted — the database was
 * updated, but the page they landed on was dead. `getBaseUrl` resolves the
 * public origin from the configured site URL or the forwarded host headers.
 */
async function redirectToSettings(userId: string, result: string) {
  const url = new URL(`/scholars/${userId}/settings`, await getBaseUrl());
  url.searchParams.set("institution", result);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
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
    return NextResponse.redirect(loginUrl);
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return redirectToSettings(supabaseUser.id, "invalid");
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
    return redirectToSettings(supabaseUser.id, "invalid");
  }

  if (
    !pendingVerification.institutionVerificationExpiresAt ||
    pendingVerification.institutionVerificationExpiresAt <= new Date()
  ) {
    return redirectToSettings(supabaseUser.id, "expired");
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
    return redirectToSettings(supabaseUser.id, "invalid");
  }

  return redirectToSettings(
    supabaseUser.id,
    result === 1 ? "verified" : "invalid",
  );
}
