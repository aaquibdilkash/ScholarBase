"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { z } from "zod";
import { requireEnv } from "@/lib/env";
import {
  checkRateLimit,
  getRequestFingerprint,
  hashRateLimitKey,
  RATE_LIMIT_DEGRADED_ERROR,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";
import { verifyContactFormTurnstile } from "@/lib/turnstile";
import type { ContactFormState } from "@/types/contact";
import {
  renderScholarBaseCompactHeader,
  renderScholarBaseResponsiveStyles,
} from "@/lib/emails/brand";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim() || (
    process.env.NODE_ENV === "production"
      ? requireEnv("RESEND_API_KEY")
      : "dev-local-resend-key"
  );

  return new Resend(apiKey);
}

const contactSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  subject: z.string().min(1, { message: "Subject is required" }),
  message: z.string().min(1, { message: "Message is required" }),
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

export async function sendContactMessage(
  prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const validatedFields = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: validatedFields.error.issues.map((e) => e.message).join(", "),
    };
  }

  const { name, email, subject, message } = validatedFields.data;

  // Rate limits run UNCONDITIONALLY. They used to sit behind a check on the
  // raw "email" form field, which is attacker-controlled — an empty value
  // skipped both limiters entirely. Validation has already run, so `email`
  // here is guaranteed non-empty.
  const headersList = await headers();
  const [emailRateLimit, ipRateLimit] = await Promise.all([
    checkRateLimit({
      namespace: "contact:email",
      key: hashRateLimitKey(email.trim().toLowerCase()),
      limit: 3,
      window: "1 h",
      onDegraded: "closed",
    }),
    checkRateLimit({
      namespace: "contact:ip",
      key: getRequestFingerprint(headersList),
      limit: 10,
      window: "1 h",
      onDegraded: "closed",
    }),
  ]);

  if (!emailRateLimit.allowed || !ipRateLimit.allowed) {
    if (emailRateLimit.degraded || ipRateLimit.degraded) {
      return {
        success: false,
        message: RATE_LIMIT_DEGRADED_ERROR,
      };
    }
    return {
      success: false,
      message: RATE_LIMIT_ERROR,
    };
  }

  // CAPTCHA: the two keys above are both fully attacker-controlled (the email
  // is self-reported, the IP fingerprint rides a spoofable header), so without
  // this they are the only thing standing between a script and Resend's
  // 100-emails/day free-tier cap — which would take down password resets and
  // digests for every real user. Fails closed: a missing secret or token
  // rejects the submission.
  const turnstileToken = formData.get("turnstileToken");
  if (
    !(await verifyContactFormTurnstile(
      typeof turnstileToken === "string" ? turnstileToken : "",
    ))
  ) {
    return {
      success: false,
      message: "Security verification failed. Please try again.",
    };
  }

  const replyToEmail = email;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const resend = getResendClient();

  try {
    await resend.emails.send({
      from: "ScholarBase Contact <contact@scholarbase.app>",
      to: ["connect@scholarbase.app"],
      replyTo: replyToEmail,
      subject: `Contact Form: ${subject}`,
      html: `
        ${renderScholarBaseResponsiveStyles()}
        <div class="sb-email-shell" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          ${renderScholarBaseCompactHeader("Contact form submission")}
          <div class="sb-email-panel" style="background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 4px solid #2563eb;">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">New Contact Form Submission</h2>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 8px 0; color: #374151;"><strong>From:</strong> ${safeName}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Email:</strong> ${safeEmail}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Subject:</strong> ${safeSubject}</p>
            </div>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
              <p style="margin: 8px 0; color: #374151;"><strong>Message:</strong></p>
              <p style="margin: 8px 0; color: #374151; white-space: pre-wrap; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${safeMessage}</p>
            </div>
          </div>
          <div class="sb-email-footer" style="text-align: center; margin-top: 24px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 ScholarBase. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    return {
      success: true,
      message: "Thank you for your message! We'll get back to you soon.",
    };
  } catch (error) {
    console.error("Failed to send contact email:", error);
    return {
      success: false,
      message: "Failed to send message. Please try again.",
    };
  }
}
