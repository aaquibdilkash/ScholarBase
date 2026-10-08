import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getModuleNoun } from "@/lib/notification-links";
import { queueNotification, type NotificationPayload } from "@/lib/qstash";

/**
 * Fan-out work bounds (P2-1).
 *
 * `FAN_OUT_CHUNK_SIZE` is how many followers one `findMany` pulls;
 * `MAX_FAN_OUT_CHUNKS` caps how many chunks a single invocation may process
 * before it re-enqueues the remainder. 4 x 500 = 2000 recipients per
 * invocation, which stays comfortably inside a serverless timeout while still
 * fanning out to a very large following in a handful of messages.
 */
const FAN_OUT_CHUNK_SIZE = 500;
const MAX_FAN_OUT_CHUNKS = 4;

const ROLLUP_TYPES = new Set([
  "NEW_COMMENT",
  "NEW_REPLY",
  "NEW_FOLLOWER",
  "NEW_VOTE",
]);

function formatRollupBody(
  type: string,
  actorName: string,
  othersCount: number,
  fallback: string,
  // What was voted on, e.g. "journal review". Only NEW_VOTE is module-aware
  // today; a review vote used to be announced as "upvoted your post".
  noun: string = "post",
) {
  if (!ROLLUP_TYPES.has(type)) return fallback;
  if (othersCount === 0) {
    switch (type) {
      case "NEW_COMMENT":
        return `${actorName} commented on your post.`;
      case "NEW_REPLY":
        return `${actorName} replied to your comment.`;
      case "NEW_FOLLOWER":
        return `${actorName} started following you.`;
      case "NEW_VOTE":
        return `${actorName} upvoted your ${noun}.`;
    }
  }

  const suffix = othersCount === 1 ? "1 other" : `${othersCount} others`;
  switch (type) {
    case "NEW_COMMENT":
      return `${actorName} and ${suffix} commented on your post.`;
    case "NEW_REPLY":
      return `${actorName} and ${suffix} replied to your comment.`;
    case "NEW_FOLLOWER":
      return `${actorName} and ${suffix} started following you.`;
    case "NEW_VOTE":
      return `${actorName} and ${suffix} upvoted your ${noun}.`;
    default:
      return fallback;
  }
}

export async function processNotificationPayload(payload: NotificationPayload) {
  // P0-2: the digest rides the same worker and the same QStash destination as
  // notifications, so it inherits one schema, one retry policy and one DLQ
  // rather than adding a parallel job route nobody remembers exists.
  if (payload.mode === "DIGEST") {
    const { sendDigestChunk } = await import("@/lib/emails/digest");
    const result = await sendDigestChunk(payload.preference, payload.afterUserId);
    return {
      success: result.success,
      processed: result.emailedUsers,
      flaggedNotifications: result.flaggedNotifications,
      exhausted: result.exhausted,
      failedUsers: result.failedUsers,
    };
  }

  if (payload.mode === "TARGETED") {
    if (payload.actorId === payload.recipientId) {
      return { success: true, processed: 0 };
    }

    const actor = await prisma.user.findUnique({
      where: { id: payload.actorId },
      select: { name: true, handle: true },
    });
    const actorName = actor?.name || actor?.handle || "A researcher";
    // Resolved once for both rollup paths: a vote on a journal review must be
    // announced as "upvoted your journal review", not as a generic post.
    const noun = getModuleNoun(payload.targetType);

    const aggregated = await prisma.$transaction(async (tx) => {
      const existingNotification = ROLLUP_TYPES.has(payload.type)
        ? await tx.notification.findFirst({
            where: {
              recipientId: payload.recipientId,
              targetId: payload.targetId,
              type: payload.type,
              readAt: null,
            },
            orderBy: { updatedAt: "desc" },
          })
        : null;

      if (existingNotification) {
        // SAME-ACTOR GUARD. `count` is presented as "Alice and N others" —
        // i.e. distinct people — but the rollup query never looked at who
        // triggered the previous event. One person re-triggering the same
        // rollup while the row is still unread (a vote toggle storm, or an
        // unfollow/refollow loop) used to increment the count every time.
        // The same actor contributes at most once per unread rollup now.
        // Applies to every rollup type — votes, follows, comments, replies.
        // Known limit: A, B, A interleaves to 3 (the row tracks only the most
        // recent actor); the single-actor inflation this fixes is gone, and
        // the remainder needs a contributor set to be exact.
        if (existingNotification.actorId === payload.actorId) {
          return true;
        }

        const count = existingNotification.count + 1;
        await tx.notification.update({
          where: { id: existingNotification.id },
          data: {
            actorId: payload.actorId,
            count,
            body: formatRollupBody(payload.type, actorName, count - 1, payload.body, noun),
            updatedAt: new Date(),
          },
        });
        return true;
      }

      await tx.notification.create({
        data: {
          recipientId: payload.recipientId,
          actorId: payload.actorId,
          type: payload.type,
          targetType: payload.targetType,
          targetId: payload.targetId,
          title: payload.title,
          body: formatRollupBody(payload.type, actorName, 0, payload.body, noun),
          count: 1,
        },
      });
      return false;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      success: true,
      processed: 1,
      aggregated,
    };
  }

  if (payload.mode === "FAN_OUT") {
    // Bounded work per invocation (RULE 3 / Vercel timeouts): walk at most
    // FAN_OUT_CHUNK_SIZE * MAX_CHUNKS_PER_INVOCATION followers, then hand the
    // remainder to a fresh message that carries its own cursor.
    let cursor: { followerId: string; followingId: string } | undefined =
      payload.cursor;
    let processed = 0;
    let chunks = 0;
    let exhausted = false;

    while (chunks < MAX_FAN_OUT_CHUNKS) {
      const followers = await prisma.follows.findMany({
        where: { followingId: payload.actorId },
        select: { followerId: true, followingId: true },
        orderBy: [{ followerId: "asc" }, { followingId: "asc" }],
        take: FAN_OUT_CHUNK_SIZE,
        ...(cursor
          ? { cursor: { followerId_followingId: cursor }, skip: 1 }
          : {}),
      });

      if (followers.length === 0) {
        exhausted = true;
        break;
      }

      const data = followers
        .filter(({ followerId }) => followerId !== payload.actorId)
        .map(({ followerId }) => ({
          recipientId: followerId,
          actorId: payload.actorId,
          type: payload.type,
          targetType: payload.targetType,
          targetId: payload.targetId,
          title: payload.title,
          body: payload.body,
          count: 1,
        }));

      if (data.length > 0) {
        // P2-1 idempotency, part 2 of 2. The partial unique index
        // `Notification_unread_dedupe_key` (migration
        // 20260930120000) guarantees one unread row per
        // (recipientId, targetId, type), so `skipDuplicates` turns a replayed
        // or overlapping chunk into a no-op instead of a second notification.
        // Without it this insert is the line that produced duplicates.
        await prisma.notification.createMany({ data, skipDuplicates: true });
        processed += data.length;
      }

      chunks += 1;

      if (followers.length < FAN_OUT_CHUNK_SIZE) {
        exhausted = true;
        break;
      }

      const lastFollower = followers[followers.length - 1];
      cursor = {
        followerId: lastFollower.followerId,
        followingId: lastFollower.followingId,
      };
    }

    // Re-enqueue the tail with the cursor INSIDE the payload. This is what makes
    // the fan-out resumable: a continuation restarts at the boundary instead of
    // at follower #1, and a QStash retry of either message is idempotent thanks
    // to the unique index above.
    if (!exhausted && cursor) {
      void queueNotification({ ...payload, cursor }).catch((error) => {
        console.error("QStash fan-out continuation error:", error);
      });
    }

    return { success: true, processed };
  }

  return { success: false, error: "Invalid notification mode" };
}
