import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/db";
import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";

// The signature check needs the raw request body and node:crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Svix rejects timestamps older than five minutes; match that tolerance. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const resendEventSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().optional(),
    /** Resend sends the recipient list on delivery/bounce/complaint events. */
    to: z.array(z.string()).optional(),
    bounce: z
      .object({
        type: z.string().optional(),
        message: z.string().optional(),
      })
      .optional(),
  }),
});

function constantTimeEqual(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}

/**
 * Verify a Resend (Svix) webhook by hand.
 *
 * Svix signs `${id}.${timestamp}.${rawBody}` with HMAC-SHA256 and sends the
 * digest base64-encoded in `svix-signature` as `v1,<digest>` (possibly several,
 * space-separated, for rotation). The signing secret is the base64 part of a
 * `whsec_...` value. Doing this directly avoids pulling in the Svix SDK just
 * for one HMAC.
 */
function verifyResendSignature(request: NextRequest, body: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signatureHeader = request.headers.get("svix-signature");

  if (!id || !timestamp || !signatureHeader) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const key = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const expected = createHmac("sha256", Buffer.from(key, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return signatureHeader.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    return version === "v1" && Boolean(signature) && constantTimeEqual(expected, signature!);
  });
}

function recipientEmails(raw: string[] | undefined): string[] {
  if (!raw) return [];

  const emails = new Set<string>();
  for (const value of raw) {
    const email = normalizeEmail(value);
    if (validateEmailFormat(email)) emails.add(email);
  }

  return [...emails];
}

/**
 * Resend delivery feedback.
 *
 * A permanent bounce marks the contact BOUNCED so it drops out of the PENDING
 * pool. A complaint is a hard opt-out forever: it both unsubscribes the address
 * and marks the contact UNSUBSCRIBED, because mailing someone who reported spam
 * is the fastest way to lose a sending domain.
 *
 * Transient bounces are logged only — the provider retries those itself, and
 * marking a contact as bounced for a temporary mailbox-full would be wrong.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  if (!verifyResendSignature(request, body)) {
    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  let event: z.infer<typeof resendEventSchema>;
  try {
    event = resendEventSchema.parse(JSON.parse(body));
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid payload" },
      { status: 400 },
    );
  }

  try {
    if (event.type === "email.bounced") {
      const isPermanent = event.data.bounce?.type === "Permanent";
      const emails = recipientEmails(event.data.to);

      if (!isPermanent) {
        console.warn(
          "[webhooks/resend] transient bounce:",
          event.data.bounce?.message ?? event.data.email_id ?? "unknown",
        );
        return NextResponse.json({ received: true, ignored: "transient_bounce" });
      }

      if (emails.length > 0) {
        await prisma.outreach.updateMany({
          where: { email: { in: emails } },
          data: { status: "BOUNCED" },
        });
      }

      return NextResponse.json({ received: true, status: "BOUNCED", emails });
    }

    if (event.type === "email.complained") {
      const emails = recipientEmails(event.data.to);

      for (const email of emails) {
        await prisma.outreachEmailUnsubscribe.upsert({
          where: { email },
          update: {},
          create: { email },
        });
      }

      if (emails.length > 0) {
        await prisma.outreach.updateMany({
          where: { email: { in: emails } },
          data: { status: "UNSUBSCRIBED" },
        });
      }

      return NextResponse.json({
        received: true,
        status: "UNSUBSCRIBED",
        emails,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/resend]", error);
    return NextResponse.json(
      { success: false, error: "Webhook handling failed" },
      { status: 500 },
    );
  }
}
