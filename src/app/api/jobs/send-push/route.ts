import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import {
  messagePushPayloadSchema,
  type MessagePushPayload,
} from "@/lib/qstash";
import { isUserActive } from "@/lib/push-activity";
import { sendMessagePush } from "@/lib/push-server";

/**
 * QStash worker for message Web Push.
 *
 * ⚡ The gate: if the recipient currently has a visible ScholarBase tab, the
 * push is skipped — the in-app realtime toast/badge already covers them. Only
 * when they have stepped away does the OS notification fire.
 *
 * Exactly-once semantics: QStash retries 5xx responses, so a *transient*
 * push-service failure (429/503/timeout on every endpoint) returns 500 to
 * trigger a retry. The Service Worker dedupes by `messageId`, so the retry
 * renders no duplicate. Skips (ACTIVE / NO_SUBSCRIPTIONS / NOT_CONFIGURED)
 * and partial deliveries stay 200 — retrying those would only double-notify.
 */
async function handler(request: Request) {
  try {
    const parsedPayload = messagePushPayloadSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return NextResponse.json({ error: "Invalid push payload" }, { status: 400 });
    }
    const payload: MessagePushPayload = parsedPayload.data;

    if (await isUserActive(payload.recipientId)) {
      return NextResponse.json({ success: true, skipped: "ACTIVE" });
    }

    const result = await sendMessagePush(payload);
    if (result.transientFailure) {
      return NextResponse.json(
        { error: "Push service temporarily unavailable", ...result },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("QStash message push worker error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);