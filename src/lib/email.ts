// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

import type { CommentNotificationProps, ScholarInviteProps } from '@/types/email';

export async function sendCommentNotification({
    recipientEmail,
    commenterName,
    paperTitle,
    commentSnippet,
}: CommentNotificationProps) {
    try {
        const data = await resend.emails.send({
            from: 'ScholarBase <notifications@scholarbase.app>',
            to: [recipientEmail],
            subject: `${commenterName} commented on your paper`,
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; color: #020617; margin: 0;">Scholar<span style="color: #2563eb;">Base</span></h1>
          </div>
          <div style="background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 4px solid #2563eb;">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">New Comment on "${paperTitle}"</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;"><strong>${commenterName}</strong> left a comment:</p>
            <blockquote style="border-left: 4px solid #0ea5e9; padding-left: 16px; color: #475569; background: #f8fafc; padding: 12px 0; margin: 16px 0; font-style: italic;">
              "${commentSnippet}"
            </blockquote>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://scholarbase.app" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Comment</a>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
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
    try {
        const { data, error } = await resend.emails.send({
            from: 'ScholarBase <invitations@scholarbase.app>',
            to: [recipientEmail],
            subject: `${inviterName} invited you to join ScholarBase`,
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; color: #020617; margin: 0;">Scholar<span style="color: #2563eb;">Base</span></h1>
          </div>
          <div style="background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 4px solid #2563eb;">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Collaboration Invitation</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${inviterName} wants to collaborate with you on ScholarBase.</p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; white-space: pre-wrap; margin: 0 0 16px 0;">${message}</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">If you are not expecting this invitation, you can simply delete this email.</p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
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
            from: "ScholarBase <notifications@scholarbase.app>",
            to: [recipientEmail],
            subject: "Verify your institutional email on ScholarBase",
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="background-color: #ffffff; padding: 32px; border-radius: 8px; border-top: 4px solid #2563eb;">
            <h1 style="margin-top: 0; color: #0f172a; font-size: 22px;">Verify your institutional email</h1>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">Click the button below to verify that you control this institutional email address and receive the ScholarBase institutional badge.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify institutional email</a>
            </div>
            <p style="color: #64748b; font-size: 14px; line-height: 1.5;">This link expires in 20 minutes and can be used only once. If you did not request this, you can ignore the email.</p>
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
