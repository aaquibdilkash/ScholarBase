"use server";

import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);

const contactSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  subject: z.string().min(1, { message: "Subject is required" }),
  message: z.string().min(1, { message: "Message is required" }),
});

import type { ContactFormState } from '@/types/contact';

export async function sendContactMessage(
  prevState: ContactFormState,
  formData: FormData
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

try {
    await resend.emails.send({
      from: "ScholarBase Contact <contact@scholarbase.app>",
      to: ["connect@scholarbase.app"],
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; color: #020617; margin: 0;">Scholar<span style="color: #2563eb;">Base</span></h1>
          </div>
          <div style="background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 4px solid #2563eb;">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">New Contact Form Submission</h2>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 8px 0; color: #374151;"><strong>From:</strong> ${name}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Subject:</strong> ${subject}</p>
            </div>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
              <p style="margin: 8px 0; color: #374151;"><strong>Message:</strong></p>
              <p style="margin: 8px 0; color: #374151; white-space: pre-wrap; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${message}</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
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
