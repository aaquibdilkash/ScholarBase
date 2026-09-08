import { Client } from "@upstash/qstash";

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export type NotificationPayload =
  | {
      mode: "FAN_OUT";
      type: string;
      actorId: string;
      targetType: string;
      targetId: string;
      title: string;
      body: string;
    }
  | {
      mode: "TARGETED";
      type: string;
      actorId: string;
      targetType: string;
      targetId: string;
      recipientId: string;
      title: string;
      body: string;
    };

export function queueNotification(payload: NotificationPayload) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!siteUrl) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_SITE_URL or VERCEL_URL is not configured."),
    );
  }

  return qstashClient.publishJSON({
    url: `${siteUrl.replace(/\/$/, "")}/api/jobs/process-notifications`,
    body: payload,
    retries: 3,
  });
}
