import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import {
  notificationPayloadSchema,
  type NotificationPayload,
} from "@/lib/qstash";
import { processNotificationPayload } from "@/lib/notification-processor";

async function handler(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    // Malformed JSON is not recoverable; return 200 (or 400 if DLQ retry is desired)
    console.error("QStash notification worker: Malformed JSON body");
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const parsedPayload = notificationPayloadSchema.safeParse(body);
  if (!parsedPayload.success) {
    console.error(
      "QStash notification worker: Invalid payload schema",
      parsedPayload.error.flatten()
    );
    // Return 200 if you want to silently discard deterministic schema mismatches,
    // or keep 400 if you rely on QStash retrying before forwarding to the DLQ.
    return NextResponse.json(
      { error: "Invalid notification payload", details: parsedPayload.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const payload: NotificationPayload = parsedPayload.data;
    const result = await processNotificationPayload(payload);

    // If result.success is false due to a transient error, status 500 triggers a QStash retry.
    // If it is a non-retryable domain failure, acknowledge with 200 so retries halt.
    const status = result.success ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("QStash notification worker processing error:", error);
    // 500 instructs QStash to retry according to configured backoff
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);