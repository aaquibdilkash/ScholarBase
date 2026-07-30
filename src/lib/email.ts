// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface CommentNotificationProps {
    recipientEmail: string;
    commenterName: string;
    paperTitle: string;
    commentSnippet: string;
}

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
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Comment on "${paperTitle}"</h2>
          <p><strong>${commenterName}</strong> left a comment:</p>
          <blockquote style="border-left: 4px solid #0070f3; padding-left: 12px; color: #555;">
            "${commentSnippet}"
          </blockquote>
          <a href="https://scholarbase.app" style="background: #0070f3; color: white; padding: 10px 18px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px;">
            View Comment
          </a>
        </div>
      `,
        });

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send notification email:', error);
        return { success: false, error };
    }
}