"use server";

import prisma from "@/lib/db";
import { requireActiveUser, requireCurrentUser } from "@/lib/auth";

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
  const user = await requireActiveUser("Log in to view your notifications.");

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
  const user = await requireActiveUser("Log in to view your notifications.");

  const result = await prisma.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
