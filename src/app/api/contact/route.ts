import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { name, email, subject, message } = await request.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const data = await resend.emails.send({
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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to send contact email:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}