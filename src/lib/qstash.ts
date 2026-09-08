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
    if (process.env.NODE_ENV === "development") return;
    throw new Error("QStash destination must be publicly reachable in production.");
  }

  return qstashClient.publishJSON({
    url: `${destination.toString().replace(/\/$/, "")}/api/jobs/process-notifications`,
    body: payload,
    retries: 3,
  });
}
