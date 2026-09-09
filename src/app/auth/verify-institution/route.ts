import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";

function redirectToSettings(request: NextRequest, userId: string, result: string) {
  const url = new URL(`/scholars/${userId}/settings`, request.url);
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
    const loginUrl = new URL("/login", request.url);
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
    return redirectToSettings(request, supabaseUser.id, "invalid");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const pendingVerification = await prisma.user.findUnique({
    where: { institutionVerificationTokenHash: tokenHash },
    select: {
      id: true,
      institutionVerificationExpiresAt: true,
    },
  });

  if (!pendingVerification || pendingVerification.id !== supabaseUser.id) {
    return redirectToSettings(request, supabaseUser.id, "invalid");
  }

  if (
    !pendingVerification.institutionVerificationExpiresAt ||
    pendingVerification.institutionVerificationExpiresAt <= new Date()
  ) {
    return redirectToSettings(request, supabaseUser.id, "expired");
  }

  const result = await prisma.user.updateMany({
    where: {
      id: supabaseUser.id,
      institutionVerificationTokenHash: tokenHash,
      institutionVerificationExpiresAt: { gt: new Date() },
    },
    data: {
      institutionVerifiedAt: new Date(),
      institutionVerificationTokenHash: null,
      institutionVerificationExpiresAt: null,
    },
  });

  return redirectToSettings(
    request,
    supabaseUser.id,
    result.count === 1 ? "verified" : "invalid",
  );
}
