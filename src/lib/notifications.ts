import { Notification } from "@prisma/client";
import prisma from "@/lib/db";

export function getNotificationLink(notification: Notification) {
  if (!notification.targetType || !notification.targetId) {
    return null;
  }

  switch (notification.type) {
    case "follow":
      return `/scholars/${notification.actorId}`;
    case "article-upvoted":
    case "article-published":
      if (notification.targetType === "article") {
        return `/blog/${notification.targetId}`;
      }
      return null;
    case "comment-created":
    case "reply-created":
      switch (notification.targetType) {
        case "article":
          return `/blog/${notification.targetId}`;
        case "post":
          return `/feed/${notification.targetId}`;
        case "event":
          return `/events/${notification.targetId}`;
        case "vacancy":
          return `/vacancies/${notification.targetId}`;
        case "admission":
          return `/admissions/${notification.targetId}`;
        case "recommendation":
          const recIds = notification.targetId.split('/');
          if (recIds.length === 2) {
            return `/supervisor/${recIds[0]}/recommendation/${recIds[1]}`;
          }
          return null;
        case "help":
          return `/help/${notification.targetId}`;
        case "journal":
          return `/journals/${notification.targetId}`;
        case "researchTool":
          return `/research-tools/${notification.targetId}`;
        case "result":
          return `/results/${notification.targetId}`;
        case "contribution":
          return `/contributions/${notification.targetId}`;
        case "publication":
          return `/publications/${notification.targetId}`;
        default:
          return null;
      }
    case "vacancy-published":
    case "vacancy-upvoted":
      return `/vacancies/${notification.targetId}`;
    case "admission-published":
    case "admission-upvoted":
      return `/admissions/${notification.targetId}`;
    case "event-published":
    case "event-upvoted":
      return `/events/${notification.targetId}`;
    case "recommendation-upvoted":
      const recIds = notification.targetId.split('/');
      if (recIds.length === 2) {
        return `/supervisor/${recIds[0]}/recommendation/${recIds[1]}`;
      }
      return null;
    case "help-post-published":
    case "help-post-upvoted":
      return `/help/${notification.targetId}`;
    case "journal-published":
    case "journal-upvoted":
      return `/journals/${notification.targetId}`;
    case "contribution-published":
    case "contribution-upvoted":
    case "contribution-approved":
    case "contribution-rejected":
      return `/contributions/${notification.targetId}`;
    case "publication-published":
    case "publication-upvoted":
      return `/publications/${notification.targetId}`;
    case "research-tool-published":
    case "research-tool-upvoted":
      return `/research-tools/${notification.targetId}`;
    case "survey-published":
      return `/surveys/${notification.targetId}`;
    case "result-published":
      return `/results/${notification.targetId}`;
    case "supervisor-published":
      return `/supervisor/${notification.targetId}`;
    case "post-published":
      return `/feed/${notification.targetId}`;
    case "post-upvoted":
      return `/feed/${notification.targetId}`;
    case "mention":
      if (notification.targetType === "article") {
        return `/blog/${notification.targetId}`;
      } else if (notification.targetType === "socialPost") {
        return `/feed/${notification.targetId}`;
      }
      return null;
    case "message-received":
      return `/messages/${notification.targetId}`;
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
