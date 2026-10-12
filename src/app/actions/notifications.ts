"use server";

import prisma from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

const notificationInclude = {
  actor: true,
} as const;

export async function getUnreadNotificationCount() {
  const currentUser = await requireCurrentUser("Please log in to view notifications.");
  const userId = currentUser.id;

  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::int AS count
    FROM "Notification"
    WHERE "recipientId" = ${userId}
      AND "readAt" IS NULL
  `;
  return Number(result[0]?.count ?? 0);
}

export async function getNotifications(
  limit = 10,
  cursor?: string,
) {
  const currentUser = await requireCurrentUser("Please log in to view your notifications.");
  const userId = currentUser.id;

  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    include: notificationInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  return notifications;
}

export async function markNotificationRead(notificationId: string) {
  // Reads are allowed for frozen accounts — marking a notification read is
  // private state, not community interaction. Only deleted accounts stay
  // blocked (they are signed out in layout anyway).
  const user = await requireCurrentUser("Log in to view your notifications.");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isDeleted: true },
  });
  if (dbUser?.isDeleted) {
    throw new Error(
      "ACCOUNT_DELETED: This account has been deleted and this action is disabled.",
    );
  }

  const notification = await prisma.notification.update({
    where: { id: notificationId, recipientId: user.id },
    data: { readAt: new Date() },
    include: {
      actor: true,
    },
  });

  return notification;
}

export async function markAllNotificationsRead() {
  // Same as markNotificationRead: frozen accounts can still clear their own
  // inbox; only deleted accounts are refused.
  const user = await requireCurrentUser("Log in to view your notifications.");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isDeleted: true },
  });
  if (dbUser?.isDeleted) {
    throw new Error(
      "ACCOUNT_DELETED: This account has been deleted and this action is disabled.",
    );
  }

  const result = await prisma.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
