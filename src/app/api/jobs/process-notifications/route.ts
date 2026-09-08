import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { NotificationPayload } from "@/lib/qstash";

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
        return `${actorName} upvoted your post.`;
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
      return `${actorName} and ${suffix} upvoted your post.`;
    default:
      return fallback;
  }
}

async function handler(request: Request) {
  try {
    const payload = (await request.json()) as NotificationPayload;

    if (payload.mode === "TARGETED") {
      if (payload.actorId === payload.recipientId) {
        return NextResponse.json({ success: true, processed: 0 });
      }

      const actor = await prisma.user.findUnique({
        where: { id: payload.actorId },
        select: { name: true, handle: true },
      });
      const actorName = actor?.name || actor?.handle || "A researcher";

      // Only unread notifications are rolled up. Once read, the next event
      // starts a fresh notification row for the user.
      const existingNotification = ROLLUP_TYPES.has(payload.type)
        ? await prisma.notification.findFirst({
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
        const count = existingNotification.count + 1;
        await prisma.notification.update({
          where: { id: existingNotification.id },
          data: {
            actorId: payload.actorId,
            count,
            body: formatRollupBody(
              payload.type,
              actorName,
              count - 1,
              payload.body,
            ),
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.notification.create({
          data: {
            recipientId: payload.recipientId,
            actorId: payload.actorId,
            type: payload.type,
            targetType: payload.targetType,
            targetId: payload.targetId,
            title: payload.title,
            body: formatRollupBody(payload.type, actorName, 0, payload.body),
            count: 1,
          },
        });
      }

      return NextResponse.json({
        success: true,
        processed: 1,
        aggregated: Boolean(existingNotification),
      });
    }

    if (payload.mode === "FAN_OUT") {
      const followers = await prisma.follows.findMany({
        where: { followingId: payload.actorId },
        select: { followerId: true },
      });

      const chunkSize = 500;
      let processed = 0;
      for (let index = 0; index < followers.length; index += chunkSize) {
        const chunk = followers.slice(index, index + chunkSize);
        if (chunk.length === 0) continue;

        const data = chunk
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
          await prisma.notification.createMany({ data });
          processed += data.length;
        }
      }

      return NextResponse.json({ success: true, processed });
    }

    return NextResponse.json({ error: "Invalid notification mode" }, { status: 400 });
  } catch (error) {
    console.error("QStash notification worker error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
