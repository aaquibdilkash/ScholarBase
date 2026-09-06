"use server";

import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getBaseUrl } from "@/lib/url";
import prisma from "@/lib/db";
import type { Duration } from "@upstash/ratelimit";
import {
  checkRateLimit,
  getRequestFingerprint,
  hashRateLimitKey,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";
import {
  MAX_AUTH_EMAIL,
  MAX_AUTH_PASSWORD,
} from "@/lib/constants";

type AuthResult =
  | { success: true; redirect?: string; message?: string; url?: string }
  | { success: false; error: string };

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email") && lower.includes("already")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (lower.includes("password") && lower.includes("weak")) {
    return "Password is too weak. Use at least 6 characters with a mix of letters and numbers.";
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
  const requestKey = getRequestFingerprint(headersList);
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

function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function checkUserExists(email: string): Promise<boolean> {
  const normalizedEmail = normalizeAuthEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  return !!user;
}

function readAuthField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function login(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = normalizeAuthEmail(readAuthField(formData, "email"));
  const password = readAuthField(formData, "password");
  const callbackUrl = sanitizeRedirectUrl(formData.get("callbackUrl") as string);

  if (email.length === 0 || email.length > MAX_AUTH_EMAIL) {
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
    25,
    "1 m",
  );
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, error: "Incorrect email or password." };
  }

  return { success: true, redirect: callbackUrl };
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const email = normalizeAuthEmail(readAuthField(formData, "email"));
  const password = readAuthField(formData, "password");
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  if (email.length > MAX_AUTH_EMAIL) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const rateLimitResult = await limitByEmailAndIp(
    "auth:signup",
    email,
    3,
    10,
    "1 h",
  );
  if (rateLimitResult) {
    return rateLimitResult;
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }
  if (password.length > MAX_AUTH_PASSWORD) {
    return { success: false, error: "Password is too long." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback?next=/auth/confirmed`,
    },
  });

  if (error) {
    const message = mapAuthError(error.message);
    return { success: false, error: message };
  }

  // Detect existing user under Supabase Email Enumeration Protection
  // When enabled, Supabase returns a user with empty identities array
  // instead of an error to prevent email enumeration attacks
  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    return {
      success: false,
      error: "An account with this email already exists. Please sign in.",
    };
  }

  return {
    success: true,
    message: "Check your email to confirm your account.",
  };
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
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const email = normalizeAuthEmail(readAuthField(formData, "email"));

  if (!email) {
    return { success: false, error: "Please enter your email address." };
  }

  if (email.length > MAX_AUTH_EMAIL) {
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

  const redirectTo = `${baseUrl}/auth/callback?next=/auth/update-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}