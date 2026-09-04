"use server";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";

const notificationInclude = {
  actor: true,
} as const;

export async function getNotifications(
  userId: string,
  limit = 10,
  cursor?: string,
) {
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
