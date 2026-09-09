"use server";

import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { getBaseUrl } from "@/lib/url";
import { sendInstitutionVerificationEmail } from "@/lib/email";
import {
  MAX_INSTITUTION_VERIFICATION_EMAIL,
} from "@/lib/constants";
import {
  getEmailDomain,
  isInstitutionalEmailDomain,
} from "@/lib/email-domain-allowlist";
import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";
import {
  checkRateLimit,
  getRequestFingerprint,
  hashRateLimitKey,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";

const VERIFICATION_TTL_MS = 20 * 60 * 1000;

type InstitutionVerificationResult =
  | { success: true; message: string }
  | { success: false; error: string; code?: "EMAIL_DOMAIN_NOT_ALLOWED" };

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestInstitutionVerification(
  formData: FormData,
): Promise<InstitutionVerificationResult> {
  const supabaseUser = await requireActiveUser(
    "You must be logged in to verify an institutional email.",
  );
  const institutionEmail = normalizeEmail(readField(formData, "institutionEmail"));

  if (
    institutionEmail.length > MAX_INSTITUTION_VERIFICATION_EMAIL ||
    !validateEmailFormat(institutionEmail)
  ) {
    return { success: false, error: "Please enter a valid institutional email." };
  }

  if (!isInstitutionalEmailDomain(institutionEmail)) {
    return {
      success: false,
      code: "EMAIL_DOMAIN_NOT_ALLOWED",
      error: "This email domain is not recognized as an institutional domain yet.",
    };
  }

  const headersList = await headers();
  const [userRateLimit, ipRateLimit] = await Promise.all([
    checkRateLimit({
      namespace: "profile:institution-verification:user",
      key: hashRateLimitKey(supabaseUser.id),
      limit: 3,
      window: "1 h",
    }),
    checkRateLimit({
      namespace: "profile:institution-verification:ip",
      key: getRequestFingerprint(headersList),
      limit: 10,
      window: "1 h",
    }),
  ]);

  if (!userRateLimit.allowed || !ipRateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: {
      name: true,
      institutionEmail: true,
      institutionVerifiedAt: true,
    },
  });

  if (!user) {
    return { success: false, error: "Your ScholarBase profile was not found." };
  }

  if (
    user.institutionVerifiedAt &&
    user.institutionEmail === institutionEmail
  ) {
    return {
      success: true,
      message: "This institutional email is already verified.",
    };
  }

  const existingOwner = await prisma.user.findUnique({
    where: { institutionEmail },
    select: { id: true },
  });

  if (existingOwner && existingOwner.id !== supabaseUser.id) {
    return {
      success: false,
      error: "This institutional email has already been verified on another account.",
    };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

  try {
    await prisma.user.update({
      where: { id: supabaseUser.id },
      data: {
        pendingInstitutionEmail: institutionEmail,
        pendingInstitutionDomain: getEmailDomain(institutionEmail),
        institutionVerificationTokenHash: tokenHash,
        institutionVerificationExpiresAt: expiresAt,
      },
    });

    const baseUrl = await getBaseUrl();
    const verificationUrl = `${baseUrl}/auth/verify-institution?token=${encodeURIComponent(token)}`;
    const emailResult = await sendInstitutionVerificationEmail({
      recipientEmail: institutionEmail,
      recipientName: user.name,
      verificationUrl,
    });

    if (!emailResult.success) {
      await prisma.user.updateMany({
        where: {
          id: supabaseUser.id,
          institutionVerificationTokenHash: tokenHash,
        },
        data: {
          pendingInstitutionEmail: null,
          pendingInstitutionDomain: null,
          institutionVerificationTokenHash: null,
          institutionVerificationExpiresAt: null,
        },
      });
      return {
        success: false,
        error: "We could not send the verification email. Please try again later.",
      };
    }

    return {
      success: true,
      message: "Verification email sent. The link expires in 20 minutes.",
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "This institutional email has already been verified on another account.",
      };
    }

    console.error("Failed to request institutional email verification:", error);
    return {
      success: false,
      error: "We could not start verification. Please try again later.",
    };
  }
}
