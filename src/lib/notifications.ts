import { getModuleLabel } from "@/lib/notification-links";
import prisma from "@/lib/db";


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
  mentions?: { id: string, handle: string }[];
};

export async function notifyMentionedUsers(params: NotifyMentionedUsersParams): Promise<{ id: string; handle: string | null }[]> {
  let mentionedUsers: { id: string, handle: string | null }[] = [];

  if (params.mentions) {
    mentionedUsers = params.mentions;
  } else {
    const mentions = params.content.match(MENTION_REGEX);
    if (!mentions) return [];

    const mentionedHandles = mentions.map((mention) => mention.substring(1));

    mentionedUsers = await prisma.user.findMany({
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
  }

  if (mentionedUsers.length === 0) return [];

  const actor = await prisma.user.findUnique({
    where: { id: params.actorId },
    select: { name: true, handle: true, email: true },
  });
  const actorName =
    actor?.name || (actor?.handle ? `@${actor.handle}` : actor?.email?.split("@")[0]) || "A scholar";
  const moduleName = getModuleLabel(params.targetType);

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
  return mentionedUsers;
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
