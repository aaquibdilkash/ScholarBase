import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import {
  notificationPayloadSchema,
  type NotificationPayload,
} from "@/lib/qstash";
import { processNotificationPayload } from "@/lib/notification-processor";

async function handler(request: Request) {
  try {
    const parsedPayload = notificationPayloadSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return NextResponse.json({ error: "Invalid notification payload" }, { status: 400 });
    }
    const payload: NotificationPayload = parsedPayload.data;
    const result = await processNotificationPayload(payload);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("QStash notification worker error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
