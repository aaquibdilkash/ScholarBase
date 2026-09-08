import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  notificationPayloadSchema,
  type NotificationPayload,
} from "@/lib/qstash";

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
    const parsedPayload = notificationPayloadSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return NextResponse.json({ error: "Invalid notification payload" }, { status: 400 });
    }
    const payload: NotificationPayload = parsedPayload.data;

    if (payload.mode === "TARGETED") {
      if (payload.actorId === payload.recipientId) {
        return NextResponse.json({ success: true, processed: 0 });
      }

      const actor = await prisma.user.findUnique({
        where: { id: payload.actorId },
        select: { name: true, handle: true },
      });
      const actorName = actor?.name || actor?.handle || "A researcher";

      // Serialize the read-rollup check and write so concurrent QStash
      // deliveries cannot both observe the same count and lose an event.
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
          const count = existingNotification.count + 1;
          await tx.notification.update({
            where: { id: existingNotification.id },
            data: {
              actorId: payload.actorId,
              count,
              body: formatRollupBody(payload.type, actorName, count - 1, payload.body),
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
            body: formatRollupBody(payload.type, actorName, 0, payload.body),
            count: 1,
          },
        });
        return false;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return NextResponse.json({
        success: true,
        processed: 1,
        aggregated,
      });
    }

    if (payload.mode === "FAN_OUT") {
      const chunkSize = 500;
      let processed = 0;
      let cursor: { followerId: string; followingId: string } | undefined;

      // Page through the compound primary key instead of loading every
      // follower into one serverless invocation's memory.
      while (true) {
        const followers = await prisma.follows.findMany({
          where: { followingId: payload.actorId },
          select: { followerId: true, followingId: true },
          orderBy: [{ followerId: "asc" }, { followingId: "asc" }],
          take: chunkSize,
          ...(cursor
            ? { cursor: { followerId_followingId: cursor }, skip: 1 }
            : {}),
        });

        if (followers.length === 0) break;

        const chunk = followers;
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

        if (followers.length < chunkSize) break;
        const lastFollower = followers[followers.length - 1];
        cursor = {
          followerId: lastFollower.followerId,
          followingId: lastFollower.followingId,
        };
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
