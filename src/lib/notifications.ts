import { Notification } from "@prisma/client";
import prisma from "@/lib/db";

const targetLinks: Record<string, (targetId: string) => string | null> = {
  article: (targetId) => `/blog/${targetId}`,
  post: (targetId) => `/feed/${targetId}`,
  socialPost: (targetId) => `/feed/${targetId}`,
  event: (targetId) => `/events/${targetId}`,
  vacancy: (targetId) => `/vacancies/${targetId}`,
  admission: (targetId) => `/admissions/${targetId}`,
  recommendation: (targetId) => {
    const recIds = targetId.split("/");
    return recIds.length === 2
      ? `/supervisor/${recIds[0]}/recommendation/${recIds[1]}`
      : null;
  },
  help: (targetId) => `/help/${targetId}`,
  journal: (targetId) => `/journals/${targetId}`,
  researchTool: (targetId) => `/research-tools/${targetId}`,
  researchGrant: (targetId) => `/grants/${targetId}`,
  course: (targetId) => `/learn/${targetId}`,
  result: (targetId) => `/results/${targetId}`,
  contribution: (targetId) => `/contributions/${targetId}`,
  publication: (targetId) => `/publications/${targetId}`,
  survey: (targetId) => `/surveys/${targetId}`,
};

const moduleLabels: Record<string, string> = {
  article: "Blog",
  post: "Feed",
  socialPost: "Feed",
  event: "Events",
  vacancy: "Vacancies",
  admission: "Admissions",
  recommendation: "Supervisor recommendation",
  help: "Help",
  journal: "Journals",
  researchTool: "Research Tools",
  researchGrant: "Research Grants",
  course: "Courses",
  result: "Results",
  contribution: "Contributions",
  publication: "Publications",
  survey: "Research Survey",
};

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
      return targetLinks[notification.targetType]?.(notification.targetId) ?? null;
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
    case "research-grant-published":
    case "research-grant-upvoted":
      return `/grants/${notification.targetId}`;
    case "course-published":
    case "course-upvoted":
      return `/learn/${notification.targetId}`;
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
      return notification.targetType && notification.targetId
        ? targetLinks[notification.targetType]?.(notification.targetId)?.concat("#comments") ?? null
        : null;
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

  const actor = await prisma.user.findUnique({
    where: { id: params.actorId },
    select: { name: true, handle: true, email: true },
  });
  const actorName =
    actor?.name || (actor?.handle ? `@${actor.handle}` : actor?.email?.split("@")[0]) || "A scholar";
  const moduleName = params.targetType
    ? moduleLabels[params.targetType] || params.targetType
    : "this module";

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
        title: params.type === "mention"
          ? `${actorName} tagged you in ${moduleName} discussion`
          : params.titleFactory(user.handle),
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
