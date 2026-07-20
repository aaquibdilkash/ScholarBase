import { Notification } from "@prisma/client";
import prisma from "@/lib/db";

export function getNotificationLink(notification: Notification) {
  if (!notification.targetType || !notification.targetId) {
    return null;
  }

  switch (notification.type) {
    case "follow":
      return `/scholar/${notification.actorId}`;
    case "article-liked":
    case "article-published":
    case "comment-created":
    case "reply-created":
      if (notification.targetType === "article") {
        return `/blog/${notification.targetId}`;
      }
      return null;
    case "post-liked":
    case "post-published":
      return `/feed/${notification.targetId}`;
    case "vacancy-liked":
      return `/vacancies/${notification.targetId}`;
    case "admission-liked":
      return `/admissions/${notification.targetId}`;
    case "event-liked":
      return `/events/${notification.targetId}`;
    case "recommendation-liked":
      return `/recommendations/${notification.targetId}`;
    case "help-post-liked":
      return `/help/${notification.targetId}`;
    case "journal-liked":
      return `/journals/${notification.targetId}`;
    case "research-tool-liked":
      return `/research-tools/${notification.targetId}`;
    case "mention":
      if (notification.targetType === "article") {
        return `/blog/${notification.targetId}`;
      } else if (notification.targetType === "socialPost") {
        return `/feed/${notification.targetId}`;
      }
      return null;
    default:
      return null;
  }
}

type NotifyUserByIdParams = {
  recipientId: string;
  actorId: string;
  type: string;
  targetType: string;
  targetId: string;
  title: string;
  body: string;
};

export async function notifyUserById(params: NotifyUserByIdParams) {
  if (params.recipientId === params.actorId) return;

  await prisma.notification.create({
    data: {
      recipientId: params.recipientId,
      actorId: params.actorId,
      type: params.type,
      targetType: params.targetType,
      targetId: params.targetId,
      title: params.title,
      body: params.body,
    },
  });
}

const MENTION_REGEX = /@(\w+)/g;

type NotifyMentionedUsersParams = {
  actorId: string;
  content: string;
  type: string;
  targetType: string;
  targetId: string;
  titleFactory: (handle: string) => string;
  bodyFactory: (handle: string) => string;
};

export async function notifyMentionedUsers(params: NotifyMentionedUsersParams) {
  const mentions = params.content.match(MENTION_REGEX);
  if (!mentions) return;

  const mentionedHandles = mentions.map((mention) => mention.substring(1));

  const mentionedUsers = await prisma.user.findMany({
    where: {
      handle: {
        in: mentionedHandles,
      },
    },
    select: {
      id: true,
      handle: true,
    },
  });

  for (const user of mentionedUsers) {
    if (user.id === params.actorId) continue;
    if (!user.handle) continue;

    await prisma.notification.create({
      data: {
        recipientId: user.id,
        actorId: params.actorId,
        type: params.type,
        targetType: params.targetType,
        targetId: params.targetId,
        title: params.titleFactory(user.handle),
        body: params.bodyFactory(user.handle),
      },
    });
  }
}

type NotifyFollowersOfActivityParams = {
  actorId: string;
  type: string;
  targetType: string;
  targetId: string;
  title: string;
  body: string;
};

export async function notifyFollowersOfActivity(
  params: NotifyFollowersOfActivityParams,
) {
  const followers = await prisma.follows.findMany({
    where: { followingId: params.actorId },
    select: { followerId: true },
  });

  if (followers.length === 0) return;

  const notifications = followers.map((follower) => ({
    recipientId: follower.followerId,
    actorId: params.actorId,
    type: params.type,
    targetType: params.targetType,
    targetId: params.targetId,
    title: params.title,
    body: params.body,
  }));

  await prisma.notification.createMany({
    data: notifications,
    skipDuplicates: true,
  });
}
