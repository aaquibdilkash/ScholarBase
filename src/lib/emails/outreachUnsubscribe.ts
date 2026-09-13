import { createHmac } from "crypto";

const OUTREACH_UNSUBSCRIBE_PURPOSE = "scholar-outreach-unsubscribe";

function getSigningSecret(): string {
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
  return (
    token.length === expected.length &&
    [...token].every((char, index) => char === expected[index])
  );
}

export function getOutreachUnsubscribeUrl(email: string): string {
  const encodedEmail = encodeURIComponent(email.toLowerCase());
  const token = signOutreachUnsubscribeToken(email);
  return `${getEmailBaseUrl()}/api/email/outreach-unsubscribe?email=${encodedEmail}&token=${token}`;
}
