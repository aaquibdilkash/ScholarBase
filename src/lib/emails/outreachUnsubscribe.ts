import { createHmac, timingSafeEqual } from "crypto";
import { requireEnv } from "@/lib/env";

const OUTREACH_UNSUBSCRIBE_PURPOSE = "scholar-outreach-unsubscribe";

function isConstantTimeEqual(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}

function getSigningSecret(): string {
  if (process.env.NODE_ENV === "production") {
    // Dedicated secret, HARD-FAIL if missing (requireEnv throws in production).
    // The old fallback silently borrowed CRON_SECRET: two unrelated systems
    // sharing one secret by accident means rotating either one invalidates the
    // other's tokens, and a leak of either one forges the other's credentials.
    // Set EMAIL_UNSUBSCRIBE_SECRET in production (any long random value).
    return requireEnv("EMAIL_UNSUBSCRIBE_SECRET");
  }

  // Non-production fallbacks only — local dev and tests never reach the branch
  // above.
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.CRON_SECRET ||
    process.env.RESEND_API_KEY ||
    "scholarbase-local-email-secret"
  );
}

export function getEmailBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://scholarbase.app"
  ).replace(/\/+$/, "");
}

export function signOutreachUnsubscribeToken(email: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(`${OUTREACH_UNSUBSCRIBE_PURPOSE}:${email.toLowerCase()}`)
    .digest("hex");
}

export function verifyOutreachUnsubscribeToken(
  email: string,
  token: string | null,
): boolean {
  if (!token) return false;

  const expected = signOutreachUnsubscribeToken(email);
  return isConstantTimeEqual(expected, token);
}

export function getOutreachUnsubscribeUrl(email: string): string {
  const encodedEmail = encodeURIComponent(email.toLowerCase());
  const token = signOutreachUnsubscribeToken(email);
  return `${getEmailBaseUrl()}/api/email/outreach-unsubscribe?email=${encodedEmail}&token=${token}`;
}
