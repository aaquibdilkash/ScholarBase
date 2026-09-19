import webPush from "web-push";
import prisma from "@/lib/db";
import { MESSAGE_PUSH_TAG_PREFIX, PUSH_BODY_MAX_LENGTH } from "@/lib/push-constants";

/**
 * Server-only Web Push delivery.
 *
 * ⚡ ZERO-COMPUTE: only the subscriptions of a single recipient are read, via
 * the `@@index([userId])` B-Tree on `PushSubscription`. Dead endpoints (404/410
 * from the push service) are deleted in one batched statement so the table
 * never accumulates garbage rows.
 */

export type MessagePushInput = {
  recipientId: string;
  conversationId: string;
  senderName: string;
  body: string;
};

export type MessagePushResult = {
  delivered: number;
  removed: number;
  skipped?: "NOT_CONFIGURED" | "NO_SUBSCRIPTIONS";
};

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  try {
    webPush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:connect@scholarbase.app",
      publicKey,
      privateKey,
    );
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error("[Push] Invalid VAPID configuration.", error);
    return false;
  }
}

/** Collapses whitespace and clamps the preview so the payload stays small. */
export function truncatePushBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= PUSH_BODY_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, PUSH_BODY_MAX_LENGTH - 1).trimEnd()}…`;
}

/** The push service tells us the endpoint is permanently gone. */
function isExpiredSubscriptionError(error: unknown): boolean {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

export async function sendMessagePush(
  input: MessagePushInput,
): Promise<MessagePushResult> {
  if (!configureVapid()) {
    console.warn("[Push] VAPID keys missing — message push skipped.");
    return { delivered: 0, removed: 0, skipped: "NOT_CONFIGURED" };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: input.recipientId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) {
    return { delivered: 0, removed: 0, skipped: "NO_SUBSCRIPTIONS" };
  }

  const payload = JSON.stringify({
    title: input.senderName,
    body: truncatePushBody(input.body),
    url: `/messages/${input.conversationId}`,
    tag: `${MESSAGE_PUSH_TAG_PREFIX}${input.conversationId}`,
  });

  const deliveredIds: string[] = [];
  const expiredIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        deliveredIds.push(subscription.id);
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          expiredIds.push(subscription.id);
          return;
        }
        console.error("[Push] sendNotification failed.", error);
      }
    }),
  );

  if (deliveredIds.length > 0) {
    await prisma.pushSubscription
      .updateMany({
        where: { id: { in: deliveredIds } },
        data: { lastUsedAt: new Date() },
      })
      .catch((error) => console.error("[Push] lastUsedAt update failed.", error));
  }

  if (expiredIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: expiredIds } } })
      .catch((error) => console.error("[Push] stale subscription cleanup failed.", error));
  }

  return { delivered: deliveredIds.length, removed: expiredIds.length };
}