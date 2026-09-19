import { Client } from "@upstash/qstash";
import { z } from "zod";

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const notificationFields = {
  type: z.string().min(1).max(64),
  actorId: z.string().min(1),
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1),
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(2000),
};

export const notificationPayloadSchema = z.union([
  z.object({ mode: z.literal("FAN_OUT"), ...notificationFields }),
  z.object({ mode: z.literal("TARGETED"), recipientId: z.string().min(1), ...notificationFields }),
]);

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export async function queueNotification(payload: NotificationPayload) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!siteUrl) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_SITE_URL or VERCEL_URL is not configured."),
    );
  }

  let destination: URL;
  try {
    destination = new URL(siteUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL or VERCEL_URL must be a valid URL.");
  }

  if (["localhost", "127.0.0.1", "::1"].includes(destination.hostname)) {
    if (process.env.NODE_ENV === "development") {
      const { processNotificationPayload } = await import(
        "@/lib/notification-processor"
      );
      return processNotificationPayload(payload);
    }
    throw new Error("QStash destination must be publicly reachable in production.");
  }

  return qstashClient.publishJSON({
    url: `${destination.toString().replace(/\/$/, "")}/api/jobs/process-notifications`,
    body: payload,
    retries: 3,
  });
}

/**
 * Message-only Web Push payload. Kept intentionally tiny: QStash forwards it
 * to `/api/jobs/send-push`, which checks whether the recipient is currently
 * using the app before touching their subscriptions.
 */
export const messagePushPayloadSchema = z.object({
  recipientId: z.string().min(1),
  conversationId: z.string().min(1),
  senderName: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});

export type MessagePushPayload = z.infer<typeof messagePushPayloadSchema>;

export async function queueMessagePush(payload: MessagePushPayload) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!siteUrl) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_SITE_URL or VERCEL_URL is not configured."),
    );
  }

  let destination: URL;
  try {
    destination = new URL(siteUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL or VERCEL_URL must be a valid URL.");
  }

  // Local development has no publicly reachable origin for QStash to call back
  // into, so run the worker inline. The activity gate still applies.
  if (["localhost", "127.0.0.1", "::1"].includes(destination.hostname)) {
    if (process.env.NODE_ENV === "development") {
      const { isUserActive } = await import("@/lib/push-activity");
      if (await isUserActive(payload.recipientId)) {
        return { skipped: "ACTIVE" as const };
      }
      const { sendMessagePush } = await import("@/lib/push-server");
      return sendMessagePush(payload);
    }
    throw new Error("QStash destination must be publicly reachable in production.");
  }

  return qstashClient.publishJSON({
    url: `${destination.toString().replace(/\/$/, "")}/api/jobs/send-push`,
    body: payload,
    retries: 3,
  });
}
