import { getModuleLabel } from "@/lib/notification-links";
import prisma from "@/lib/db";
import { queueNotification } from "@/lib/qstash";


type NotifyUserByIdParams = {
  recipientId: string;
  actorId: string;
  type: string;
  targetType: string;
  targetId: string;
  title: string;
  body: string;
};

// These event names are deliberately kept separate from the older, more
// descriptive notification types used by mentions and moderation notices.
// The worker uses them as the stable rollup key.
const ROLLUP_TYPES: Record<string, "NEW_COMMENT" | "NEW_REPLY" | "NEW_FOLLOWER"> = {
  "comment-created": "NEW_COMMENT",
  "reply-created": "NEW_REPLY",
  follow: "NEW_FOLLOWER",
};

export async function notifyUserById(params: NotifyUserByIdParams) {
  if (params.recipientId === params.actorId) return;

  void queueNotification({
    mode: "TARGETED",
    ...params,
    type: ROLLUP_TYPES[params.type] ?? params.type,
  }).catch((error) => {
    console.error("QStash targeted notification error:", error);
  });
}

const MENTION_REGEX = /@(\w+)/g;
const MAX_MENTIONS_PER_ITEM = 20;

type NotifyMentionedUsersParams = {
  actorId: string;
  content: string;
  type: string;
  targetType: string;
  targetId: string;
  titleFactory: (handle: string) => string;
  bodyFactory: (handle: string) => string;
  mentions?: { id: string, handle: string | null }[];
};

export async function notifyMentionedUsers(params: NotifyMentionedUsersParams): Promise<{ id: string; handle: string | null }[]> {
  const mentionedUsers = params.mentions ?? await resolveMentionedUsers(params.content);

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

    void queueNotification({
      mode: "TARGETED",
      recipientId: user.id,
      actorId: params.actorId,
      type: params.type,
      targetType: params.targetType,
      targetId: params.targetId,
      title: params.type === "mention"
        ? `${actorName} tagged you in ${moduleName} discussion`
        : params.type === "post-mention"
        ? `${actorName} mentioned you in a post`
        : params.titleFactory(user.handle),
      body: params.bodyFactory(user.handle),
    }).catch((error) => {
      console.error("QStash mention notification error:", error);
    });
  }
  return mentionedUsers;
}

export async function resolveMentionedUsers(
  content: string,
): Promise<{ id: string; handle: string | null }[]> {
  const handles = [...new Set(
    Array.from(content.matchAll(MENTION_REGEX), ([, handle]) => handle),
  )].slice(0, MAX_MENTIONS_PER_ITEM);

  if (handles.length === 0) return [];

  return prisma.user.findMany({
    where: { handle: { in: handles } },
    select: { id: true, handle: true },
  });
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
  void queueNotification({ mode: "FAN_OUT", ...params }).catch((error) => {
    console.error("QStash fan-out notification error:", error);
  });
}
