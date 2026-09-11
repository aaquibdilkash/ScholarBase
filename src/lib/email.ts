// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

import type { CommentNotificationProps, ScholarInviteProps } from '@/types/email';
import {
    generateScholarInviteHtml,
    generateScholarInvitePlainText,
    type ScholarInviteEmailProps,
} from '@/lib/emails/scholarInvite';
import {
    renderScholarBaseCompactHeader,
    renderScholarBaseResponsiveStyles,
} from '@/lib/emails/brand';

export async function sendCommentNotification({
    recipientEmail,
    commenterName,
    paperTitle,
    commentSnippet,
}: CommentNotificationProps) {
    const safeCommenterName = escapeHtml(commenterName);
    const safePaperTitle = escapeHtml(paperTitle);
    const safeCommentSnippet = escapeHtml(commentSnippet);

    try {
        const data = await resend.emails.send({
            from: 'ScholarBase <notifications@scholarbase.app>',
            to: [recipientEmail],
            subject: `${commenterName} commented on your paper`,
            html: `
        ${renderScholarBaseResponsiveStyles()}
        <div class="sb-email-shell" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          ${renderScholarBaseCompactHeader("New activity on ScholarBase")}
          <div class="sb-email-panel" style="background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 4px solid #2563eb;">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">New Comment on "${safePaperTitle}"</h2>
            <p class="sb-email-copy" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;"><strong>${safeCommenterName}</strong> left a comment:</p>
            <blockquote class="sb-email-copy" style="border-left: 4px solid #0ea5e9; padding-left: 16px; color: #475569; background: #f8fafc; padding: 12px 0; margin: 16px 0; font-style: italic;">
              "${safeCommentSnippet}"
            </blockquote>
            <div style="text-align: center; margin: 32px 0;">
              <a class="sb-email-button" href="https://scholarbase.app" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Comment</a>
            </div>
          </div>
          <div class="sb-email-footer" style="text-align: center; margin-top: 24px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 ScholarBase. All rights reserved.</p>
          </div>
        </div>
      `,
        });

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send notification email:', error);
        return { success: false, error };
    }
}

export async function sendScholarInviteEmail({
    recipientEmail,
    inviterName,
    message,
    inviteUrl,
}: ScholarInviteProps) {
    const safeInviterName = escapeHtml(inviterName);
    const safeMessage = escapeHtml(message);
    const safeInviteUrl = escapeHtml(inviteUrl);

    try {
        const { data, error } = await resend.emails.send({
            from: 'ScholarBase <invitations@scholarbase.app>',
            to: [recipientEmail],
            subject: `${inviterName} invited you to join ScholarBase`,
            html: `
        ${renderScholarBaseResponsiveStyles()}
        <div class="sb-email-shell" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          ${renderScholarBaseCompactHeader("Collaboration Invitation")}
          <div class="sb-email-panel" style="background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 4px solid #2563eb;">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Collaboration Invitation</h2>
            <p class="sb-email-copy" style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${safeInviterName} wants to collaborate with you on ScholarBase.</p>
            <p class="sb-email-copy" style="color: #475569; font-size: 16px; line-height: 1.6; white-space: pre-wrap; margin: 0 0 16px 0;">${safeMessage}</p>
            <div style="text-align: center; margin: 32px 0;">
              <a class="sb-email-button" href="${safeInviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">If you are not expecting this invitation, you can simply delete this email.</p>
          </div>
          <div class="sb-email-footer" style="text-align: center; margin-top: 24px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 ScholarBase. All rights reserved.</p>
          </div>
        </div>
      `,
        });

        if (error) {
            console.error('Failed to send scholar invite email:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send scholar invite email:', error);
        return { success: false, error };
    }
}

export async function sendScholarOutreachEmail({
    recipientEmail,
    isTestSend,
    ...emailProps
}: ScholarInviteEmailProps & {
    recipientEmail: string;
    isTestSend?: boolean;
}) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'ScholarBase <invitations@scholarbase.app>',
            to: [recipientEmail],
            subject: isTestSend
                ? `[TEST] ${emailProps.subject}`
                : emailProps.subject,
            html: generateScholarInviteHtml(emailProps),
            text: generateScholarInvitePlainText(emailProps),
        });

        if (error) {
            console.error('Failed to send scholar outreach email:', error);
            return { success: false as const, error: error.message };
        }

        return { success: true as const, id: data?.id ?? null };
    } catch (error) {
        console.error('Failed to send scholar outreach email:', error);
        return { success: false as const, error: 'Email provider unavailable.' };
    }
}

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

export async function sendInstitutionVerificationEmail({
    recipientEmail,
    recipientName,
    verificationUrl,
}: {
    recipientEmail: string;
    recipientName: string | null;
    verificationUrl: string;
}) {
    const safeName = escapeHtml(recipientName || "Scholar");
    const safeUrl = escapeHtml(verificationUrl);

    try {
        const { data, error } = await resend.emails.send({
            from: "ScholarBase <system@scholarbase.app>",
            to: [recipientEmail],
            subject: "Verify your institutional email on ScholarBase",
            html: `
        ${renderScholarBaseResponsiveStyles()}
        <div class="sb-email-shell" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          ${renderScholarBaseCompactHeader("Institutional verification")}
          <div class="sb-email-panel" style="background-color: #ffffff; padding: 32px; border-radius: 8px; border-top: 4px solid #2563eb;">
            <h1 style="margin-top: 0; color: #0f172a; font-size: 22px;">Verify your institutional email</h1>
            <p class="sb-email-copy" style="color: #475569; font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
            <p class="sb-email-copy" style="color: #475569; font-size: 16px; line-height: 1.6;">Click the button below to verify that you control this institutional email address and receive the ScholarBase institutional badge.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a class="sb-email-button" href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify institutional email</a>
            </div>
            <p class="sb-email-copy" style="color: #64748b; font-size: 14px; line-height: 1.5;">This link expires in 20 minutes and can be used only once. If you did not request this, you can ignore the email.</p>
          </div>
        </div>
      `,
        });

        if (error) {
            console.error("Failed to send institution verification email:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error("Failed to send institution verification email:", error);
        return { success: false, error };
    }
}
