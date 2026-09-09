"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  MAX_INSTITUTION_NAME,
  MAX_INSTITUTION_REQUEST_DETAILS,
  MAX_INSTITUTION_WEBSITE,
} from "@/lib/constants";
import { getEmailDomain, isAllowedEmailDomain } from "@/lib/email-domain-allowlist";
import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";
import {
  checkRateLimit,
  getRequestFingerprint,
  hashRateLimitKey,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";

type InstitutionRequestResult =
  | { success: true; message: string; data?: unknown }
  | { success: false; error: string };

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWebsite(value: string): string | null {
  if (!value) return null;
  if (value.length > MAX_INSTITUTION_WEBSITE) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function requestInstitutionDomain(
  formData: FormData,
): Promise<InstitutionRequestResult> {
  const requesterEmail = normalizeEmail(readField(formData, "institutionEmail"));
  const institutionName = readField(formData, "institutionName");
  const websiteInput = readField(formData, "website");
  const details = readField(formData, "details");

  // Cheap bot filter for scripts that fill every form field. It intentionally
  // returns the same generic success response as a real submission.
  if (readField(formData, "company")) {
    return {
      success: true,
      message: "Your institution request was submitted for review.",
    };
  }

  if (!validateEmailFormat(requesterEmail)) {
    return { success: false, error: "Please enter a valid institutional email." };
  }
  if (!institutionName || institutionName.length > MAX_INSTITUTION_NAME) {
    return { success: false, error: "Please enter a valid institution name." };
  }
  if (details.length > MAX_INSTITUTION_REQUEST_DETAILS) {
    return { success: false, error: "Your details are too long." };
  }

  const domain = getEmailDomain(requesterEmail);
  if (isAllowedEmailDomain(domain)) {
    return {
      success: false,
      error: "This email domain is already approved for ScholarBase.",
    };
  }

  const website = normalizeWebsite(websiteInput);
  if (websiteInput && !website) {
    return { success: false, error: "Please enter a valid institution website." };
  }

  const headersList = await headers();
  const requestFingerprint = getRequestFingerprint(headersList);
  const [emailRateLimit, ipRateLimit] = await Promise.all([
    checkRateLimit({
      namespace: "auth:institution-domain-request:email",
      key: hashRateLimitKey(requesterEmail),
      limit: 2,
      window: "1 h",
    }),
    checkRateLimit({
      namespace: "auth:institution-domain-request:ip",
      key: requestFingerprint,
      limit: 5,
      window: "1 h",
    }),
  ]);

  if (!emailRateLimit.allowed || !ipRateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  try {
    const existing = await prisma.institutionDomainRequest.findUnique({
      where: { domain },
      select: { status: true },
    });

    const request = existing
      ? existing.status === "REJECTED"
        ? await prisma.institutionDomainRequest.update({
            where: { domain },
            data: {
              institutionName,
              requesterEmail,
              website,
              details: details || null,
              status: "PENDING",
              reviewNote: null,
              reviewedById: null,
              reviewedAt: null,
            },
          })
        : await prisma.institutionDomainRequest.findUniqueOrThrow({
            where: { domain },
          })
      : await prisma.institutionDomainRequest.create({
          data: {
            domain,
            institutionName,
            requesterEmail,
            website,
            details: details || null,
          },
        });

    return {
      success: true,
      message:
        request.status === "PENDING"
          ? "Your institution request was submitted for review."
          : "This institution domain has already been reviewed.",
      data: request,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: true,
        message: "This institution domain is already under review.",
      };
    }

    console.error("Failed to submit institution domain request:", error);
    return {
      success: false,
      error: "We could not submit your request. Please try again later.",
    };
  }
}
