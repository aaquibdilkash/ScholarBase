"use server";

import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getBaseUrl } from "@/lib/url";
import prisma from "@/lib/db";
import { ensureUserProfile } from "@/lib/users";
import type { Duration } from "@upstash/ratelimit";
import {
  checkRateLimit,
  getRequestIpKey,
  hashRateLimitKey,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";
import {
  MAX_AUTH_EMAIL,
  MAX_AUTH_PASSWORD,
} from "@/lib/constants";
import {
  normalizeEmail,
  validateEmailFormat,
} from "@/lib/email-normalizer";
import { isAllowedEmailDomain } from "@/lib/email-domain-allowlist";
import { recoverDeletedAccount } from "@/lib/account-recovery";

type AuthResult =
  | { success: true; redirect?: string; message?: string; url?: string }
  | { success: false; error: string; code?: "EMAIL_DOMAIN_NOT_ALLOWED" };

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email") && lower.includes("already")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (lower.includes("password") && lower.includes("weak")) {
    return "Password is too weak. Use at least 8 characters with a mix of letters and numbers.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "Please enter a valid email address.";
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return message;
}

/**
 * Ensures redirect URLs are strictly internal relative paths
 * to prevent Open Redirect vulnerabilities.
 */
function sanitizeRedirectUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "/";
  const trimmed = url.trim();
  // Must start with a single slash and not double slashes (protocol-relative)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  return trimmed;
}

async function limitByEmailAndIp(
  namespace: string,
  email: string,
  emailLimit: number,
  ipLimit: number,
  window: Duration,
): Promise<AuthResult | null> {
  const headersList = await headers();
  const requestKey = getRequestIpKey(headersList);
  const emailKey = hashRateLimitKey(email.trim().toLowerCase());

  const [emailRateLimit, ipRateLimit] = await Promise.all([
    checkRateLimit({
      namespace: `${namespace}:email`,
      key: emailKey,
      limit: emailLimit,
      window,
    }),
    checkRateLimit({
      namespace: `${namespace}:ip`,
      key: requestKey,
      limit: ipLimit,
      window,
    }),
  ]);

  if (!emailRateLimit.allowed || !ipRateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  return null;
}

function readAuthField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function login(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = normalizeEmail(readAuthField(formData, "email"));
  const password = readAuthField(formData, "password");
  const callbackUrl = sanitizeRedirectUrl(formData.get("callbackUrl") as string);

  if (!validateEmailFormat(email) || email.length > MAX_AUTH_EMAIL) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!password) {
    return { success: false, error: "Please enter your password." };
  }
  if (password.length > MAX_AUTH_PASSWORD) {
    return { success: false, error: "Password is too long." };
  }

  const rateLimitResult = await limitByEmailAndIp(
    "auth:login",
    email,
    5,
    100,
    "1 m",
  );
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: "Incorrect email or password." };
  }

  if (data.user) {
    const recovery = await recoverDeletedAccount(data.user.id);
    if (recovery === "expired") {
      await supabase.auth.signOut();
      return {
        success: false,
        error:
          "This account’s 30-day recovery period has expired. Please contact support.",
      };
    }
    if (recovery === "admin-deleted") {
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Your account has been deleted. Contact an administrator for more information.",
      };
    }

    if (recovery === "recovered") {
      return {
        success: true,
        redirect: callbackUrl,
        message: "Your account was recovered successfully.",
      };
    }
  }

  return { success: true, redirect: callbackUrl };
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = normalizeEmail(readAuthField(formData, "email"));
  const password = readAuthField(formData, "password");
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  if (!validateEmailFormat(email) || email.length > MAX_AUTH_EMAIL) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (!isAllowedEmailDomain(email)) {
    return {
      success: false,
      code: "EMAIL_DOMAIN_NOT_ALLOWED",
      error:
        "This email domain is not approved yet. You can request your institution to be added.",
    };
  }

  const rateLimitResult = await limitByEmailAndIp(
    "auth:signup",
    email,
    3,
    200,
    "1 h",
  );
  if (rateLimitResult) {
    return rateLimitResult;
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }
  if (password.length > MAX_AUTH_PASSWORD) {
    return { success: false, error: "Password is too long." };
  }

  // Calling signUp without emailRedirectTo triggers the numeric OTP {{ .Token }} dispatch
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  // Catch email enumeration protection returning empty identities
  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    return {
      success: false,
      error: "An account with this email already exists. Please sign in.",
    };
  }

  return {
    success: true,
    message: "A 6-digit verification code has been sent to your email.",
  };
}

export async function verifySignupOtp(
  email: string,
  token: string,
): Promise<AuthResult> {
  const supabase = await createClient();
  const cleanEmail = normalizeEmail(email);
  const cleanToken = token.trim();

  if (!/^\d{6}$/.test(cleanToken)) {
    return { success: false, error: "Please enter the complete 6-digit code." };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: "signup",
  });

  if (error) {
    return {
      success: false,
      error: "Invalid or expired code. Please try again.",
    };
  }

  if (data.user) {
    try {
      await ensureUserProfile(data.user);
    } catch {
      // Profile creation is best-effort here; the root layout's
      // ensureUserProfile call will retry on the next authenticated request.
    }
  }

  revalidatePath("/", "layout");
  return { success: true, redirect: "/feed" };
}

export async function resendSignupOtp(email: string): Promise<AuthResult> {
  const supabase = await createClient();
  const cleanEmail = normalizeEmail(email);

  const rateLimitResult = await limitByEmailAndIp(
    "auth:resend-otp",
    cleanEmail,
    3,
    10,
    "1 h",
  );
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: cleanEmail,
  });

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  return { success: true, message: "A new 6-digit code has been sent." };
}

export async function requestEmailChange(
  formData: FormData,
): Promise<
  | { success: true; message: string; newEmail: string }
  | { success: false; error: string; code?: "EMAIL_DOMAIN_NOT_ALLOWED" }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { success: false, error: "You must be signed in to change your email." };
  }

  const newEmail = normalizeEmail(readAuthField(formData, "email"));
  if (!validateEmailFormat(newEmail) || newEmail.length > MAX_AUTH_EMAIL) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (normalizeEmail(user.email) === newEmail) {
    return { success: false, error: "That is already your primary email address." };
  }

  if (!isAllowedEmailDomain(newEmail)) {
    return {
      success: false,
      code: "EMAIL_DOMAIN_NOT_ALLOWED",
      error: "That email domain is not approved for ScholarBase.",
    };
  }

  const verifiedEmailOwner = await prisma.user.findUnique({
    where: { institutionEmail: newEmail },
    select: { id: true },
  });
  if (verifiedEmailOwner && verifiedEmailOwner.id !== user.id) {
    return {
      success: false,
      error: "That email is already verified on another ScholarBase account.",
    };
  }

  const rateLimitResult = await limitByEmailAndIp(
    "auth:change-email",
    newEmail,
    2,
    5,
    "1 h",
  );
  if (rateLimitResult) {
    return {
      success: false,
      error: rateLimitResult.success ? RATE_LIMIT_ERROR : rateLimitResult.error,
    };
  }

  // Without emailRedirectTo, Supabase populates {{ .Token }} in the
  // "Change Email Address" template so the user gets a numeric OTP.
  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  return {
    success: true,
    newEmail,
    message: "A 6-digit confirmation code has been sent to your new email address.",
  };
}

export async function verifyEmailChangeOtp(
  newEmail: string,
  token: string,
): Promise<AuthResult> {
  const supabase = await createClient();
  const cleanEmail = normalizeEmail(newEmail);
  const cleanToken = token.trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Session expired. Please sign in again." };
  }

  if (!/^\d{6}$/.test(cleanToken)) {
    return { success: false, error: "Please enter a complete 6-digit code." };
  }

  const { error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: "email_change",
  });

  if (error) {
    return { success: false, error: "Invalid or expired code. Please try again." };
  }

  // Sync the updated primary email into Prisma.
  const updatedEmail = cleanEmail;
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: updatedEmail },
    });
  } catch {
    // Best-effort: auth email already changed; layout profile sync retries later.
  }

  revalidatePath("/", "layout");
  return { success: true, message: "Primary email updated successfully." };
}

export async function signInWithGoogle(
  callbackUrl?: string,
): Promise<AuthResult> {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  // Sanitized to prevent open redirects and standardized to use 'next'
  const target = sanitizeRedirectUrl(callbackUrl);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(target)}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    return { success: false, error: "Could not start Google sign-in." };
  }

  return { success: true, url: data.url };
}

export async function forgotPassword(
  formData: FormData,
): Promise<{ success: boolean; error?: string; email?: string }> {
  const supabase = await createClient();

  const email = normalizeEmail(readAuthField(formData, "email"));

  if (!email) {
    return { success: false, error: "Please enter your email address." };
  }

  if (!validateEmailFormat(email) || email.length > MAX_AUTH_EMAIL) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const rateLimitResult = await limitByEmailAndIp(
    "auth:forgot-password",
    email,
    3,
    10,
    "1 h",
  );
  if (rateLimitResult) {
    return rateLimitResult;
  }

  // Note: We intentionally do NOT check if the user exists in our local database.
  // Supabase's resetPasswordForEmail handles non-existent emails gracefully
  // (it won't send an email but won't reveal if the email is registered).
  // Checking our local DB would leak information about registered emails
  // and could fail for users who exist in Supabase Auth but not yet in our DB.

  // Dropping redirectTo instructs Supabase to dispatch the numeric {{ .Token }}
  // OTP instead of a clickable recovery link (avoids mail-scanner prefetch burn).
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  return { success: true, email };
}

export async function verifyRecoveryOtp(
  email: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const cleanEmail = normalizeEmail(email);
  const cleanToken = token.trim();

  if (!/^\d{6}$/.test(cleanToken)) {
    return { success: false, error: "Please enter a complete 6-digit code." };
  }

  const { error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: "recovery",
  });

  if (error) {
    return { success: false, error: "Invalid or expired recovery code." };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
