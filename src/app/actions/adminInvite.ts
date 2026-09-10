"use server";

import { z } from "zod";
import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import { sendScholarOutreachEmail } from "@/lib/email";
import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";
import { buildScholarOutreachBody } from "@/lib/emails/scholarInvite";
import {
  checkRateLimit,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";
import prisma from "@/lib/db";

const MAX_NAME_LENGTH = 120;
const MAX_SUBJECT_LENGTH = 150;
const MAX_GREETING_LENGTH = 50;
const MAX_HEADLINE_LENGTH = 150;
const MAX_BODY_LENGTH = 8_000;
const MAX_UNIVERSITY_LENGTH = 200;
const MAX_DEPARTMENT_LENGTH = 200;
const MAX_CTA_LENGTH = 80;
const MAX_SENDER_NAME_LENGTH = 120;
const MAX_SENDER_ROLE_LENGTH = 160;
const MAX_FOOTER_LENGTH = 300;

const sendInviteSchema = z.object({
  scholarName: z.string().trim().max(MAX_NAME_LENGTH),
  scholarEmail: z.string().trim().min(3).max(320),
  subject: z.string().trim().min(1).max(MAX_SUBJECT_LENGTH),
  greeting: z.string().trim().min(1).max(MAX_GREETING_LENGTH),
  headline: z.string().trim().min(1).max(MAX_HEADLINE_LENGTH),
  body: z.string().trim().min(1).max(MAX_BODY_LENGTH),
  university: z.string().trim().max(MAX_UNIVERSITY_LENGTH).optional().default(""),
  department: z.string().trim().max(MAX_DEPARTMENT_LENGTH).optional().default(""),
  ctaLabel: z.string().trim().min(1).max(MAX_CTA_LENGTH),
  senderName: z.string().trim().min(1).max(MAX_SENDER_NAME_LENGTH),
  senderRole: z.string().trim().max(MAX_SENDER_ROLE_LENGTH),
  footerText: z.string().trim().max(MAX_FOOTER_LENGTH),
  isTestSend: z.boolean().optional().default(false),
});

export type SendAdminScholarInvitePayload = z.input<typeof sendInviteSchema>;

type SendAdminScholarInviteResult =
  | { success: true; message: string }
  | { success: false; error: string };

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://scholarbase.app").replace(
    /\/+$/,
    "",
  );
}

export async function sendAdminScholarInviteAction(
  payload: SendAdminScholarInvitePayload,
): Promise<SendAdminScholarInviteResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return { success: false, error: "You are not authorized to send outreach emails." };
  }

  const parsed = sendInviteSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Please check the form fields.",
    };
  }

  const data = parsed.data;
  const scholarName = data.scholarName || "Scholar";
  const scholarEmail = normalizeEmail(data.scholarEmail);
  if (!validateEmailFormat(scholarEmail)) {
    return { success: false, error: "Please enter a valid scholar email address." };
  }

  const isTestSend = data.isTestSend === true;
  const recipientEmail = isTestSend ? currentUser.email : scholarEmail;

  if (!recipientEmail) {
    return {
      success: false,
      error: "Your admin account does not have an email address for test delivery.",
    };
  }

  const rateLimit = await checkRateLimit({
    namespace: isTestSend
      ? "admin:scholar-outreach:test"
      : "admin:scholar-outreach:send",
    key: currentUser.id,
    limit: isTestSend ? 5 : 30,
    window: "1 h",
  });

  if (rateLimit.degraded) {
    return {
      success: false,
      error: "Request protection is temporarily unavailable. Please try again later.",
    };
  }

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  if (!isTestSend) {
    const existingUser = await prisma.user.findFirst({
      where: { email: scholarEmail, isDeleted: false },
      select: { handle: true },
    });

    if (existingUser) {
      return {
        success: false,
        error: `This email already belongs to a ScholarBase account${existingUser.handle ? ` (@${existingUser.handle})` : ""}.`,
      };
    }
  }

  const senderName =
    typeof currentUser.user_metadata?.full_name === "string"
      ? currentUser.user_metadata.full_name.trim()
      : typeof currentUser.user_metadata?.name === "string"
        ? currentUser.user_metadata.name.trim()
        : "ScholarBase";

  const result = await sendScholarOutreachEmail({
    recipientEmail,
    isTestSend,
    scholarName,
    subject: data.subject,
    greeting: data.greeting,
    headline: data.headline,
    body: buildScholarOutreachBody({
      body: data.body,
      university: data.university,
      department: data.department,
    }),
    ctaLabel: data.ctaLabel,
    inviteUrl: getSiteUrl(),
    senderName: data.senderName || senderName || "ScholarBase",
    senderRole: data.senderRole,
    footerText: data.footerText,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    message: isTestSend
      ? `Test email sent to ${currentUser.email}.`
      : `Outreach email sent to ${scholarEmail}.`,
  };
}
