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
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111827; margin-bottom: 20px;">New Contact Form Submission</h2>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 8px 0; color: #374151;"><strong>From:</strong> ${name}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Subject:</strong> ${subject}</p>
          </div>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
            <p style="margin: 8px 0; color: #374151;"><strong>Message:</strong></p>
            <p style="margin: 8px 0; color: #374151; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
        });

    // REMOVED: revalidatePath("/contact");

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
