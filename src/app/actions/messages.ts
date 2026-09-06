"use server";

import prisma from "@/lib/db";
import { requireCurrentUser, requireActiveUser } from "@/lib/auth";
import { readFormValue } from "@/lib/form";
import { notifyUserById } from "@/lib/notifications";
import type { SubmitResult } from "@/types/form";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";

const directConversationSelect = {
  id: true,
  lastMessageAt: true,
  updatedAt: true,
  participants: {
    select: {
      user: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          bio: true,
          reputation: true,
        },
      },
      lastReadAt: true,
    },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: {
      body: true,
      createdAt: true,
      senderId: true,
      sender: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
    },
  },
};

export async function getInbox(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: "desc" },
    select: directConversationSelect,
  });

  const unreadCounts = conversations.length > 0
    ? await prisma.$queryRaw<{ conversationId: string; unreadCount: bigint }[]>`
        WITH participant_reads AS (
          SELECT "conversationId", COALESCE("lastReadAt", ${new Date(0)}) AS "lastReadAt"
          FROM "ConversationParticipant"
          WHERE "userId" = ${userId}
        )
        SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS "unreadCount"
        FROM "Message" m
        INNER JOIN participant_reads pr ON pr."conversationId" = m."conversationId"
        WHERE m."senderId" != ${userId}
          AND m."createdAt" > pr."lastReadAt"
        GROUP BY m."conversationId"
      `
    : [];

  const unreadCountMap = new Map(
    unreadCounts.map((row) => [row.conversationId, Number(row.unreadCount)]),
  );

  return conversations.map((conversation) => ({
    ...conversation,
    unreadCount: unreadCountMap.get(conversation.id) ?? 0,
  }));
}

export async function getUnreadMessageCount(userId: string) {
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::int AS count
    FROM "Message" m
    INNER JOIN "ConversationParticipant" cp ON m."conversationId" = cp."conversationId"
    WHERE cp."userId" = ${userId}
      AND m."senderId" != ${userId}
      AND m."createdAt" > COALESCE(cp."lastReadAt", ${new Date(0)})
  `;
  return Number(result[0]?.count ?? 0);
}

export async function findDirectConversation(userIdA: string, userIdB: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

export async function getConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    select: {
      id: true,
      lastMessageAt: true,
      participants: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
              bio: true,
              reputation: true,
            },
          },
          lastReadAt: true,
        },
      },
      messages: {
        take: 40, // ⚡ INFINITE SCROLL: Only load latest 40 initially
        orderBy: { createdAt: "desc" }, // ⚡ Must be descending to get newest
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderId: true,
          conversationId: true,
          editedAt: true,
          isDeleted: true,
          sender: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  if (!conversation) return null;

  // ⚡ BLOCK STATE: Resolve block relationships in the same action so the chat
  // UI can disable the composer and render the correct notice banner.
  const otherParticipantId = conversation.participants.find(
    (p) => p.user.id !== userId,
  )?.user.id;

  if (!otherParticipantId) return conversation;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherParticipantId },
        { blockerId: otherParticipantId, blockedId: userId },
      ],
    },
    select: { blockerId: true },
  });

  return {
    ...conversation,
    blockedByMe: block?.blockerId === userId,
    blockedMe: block ? block.blockerId !== userId : false,
  };
}

// ⚡ INFINITE SCROLL: Fetch older messages using a cursor
export async function getMoreMessages(
  conversationId: string,
  cursorId: string,
) {
  const supabaseUser = await requireCurrentUser(
    "Please log in to view messages.",
  );

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      conversation: { participants: { some: { userId: supabaseUser.id } } },
    },
    take: 40,
    skip: 1, // Skip the cursor message itself
    cursor: { id: cursorId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      conversationId: true,
      editedAt: true,
      isDeleted: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  });
  return messages;
}

// ⚡ REALTIME FIX: Safe fetcher for Prisma/Supabase conflicts
export async function getMessageDetails(messageId: string) {
  return prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      conversationId: true,
      editedAt: true,
      isDeleted: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  });
}

export async function startConversation(
  formData: FormData,
): Promise<SubmitResult> {
  const supabaseUser = await requireActiveUser(
    "Please log in to send a message.",
  );

  const rateLimit = await checkRateLimit({
    namespace: "message:start",
    key: supabaseUser.id,
    limit: 15,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  const recipientId = readFormValue(formData, "recipientId");
  const body = readFormValue(formData, "body");

  if (!recipientId || !body)
    return { success: false, error: "Recipient and message are required." };
  if (recipientId === supabaseUser.id)
    return { success: false, error: "You cannot message yourself." };

  // ⚡ BLOCK ENFORCEMENT (Issue 5): Check BOTH directions — the recipient may
  // have blocked the sender, or the sender may have blocked the recipient.
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: supabaseUser.id, blockedId: recipientId },
        { blockerId: recipientId, blockedId: supabaseUser.id },
      ],
    },
    select: { blockerId: true },
  });

  if (block) {
    return { success: false, error: "You cannot message this scholar." };
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  });
  if (!user) return { success: false, error: "User not found." };

  const existingConversation = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: recipientId } } },
      ],
    },
    select: { id: true },
  });

  const conversationId =
    existingConversation?.id ??
    (
      await prisma.conversation.create({
        data: {
          createdById: user.id,
          type: "DIRECT",
          participants: {
            create: [{ userId: user.id }, { userId: recipientId }],
          },
        },
        select: { id: true },
      })
    ).id;

  await prisma.message.create({
    data: { conversationId, senderId: user.id, body },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  await notifyUserById({
    recipientId,
    actorId: user.id,
    type: "message-received",
    targetType: "conversation",
    targetId: conversationId,
    title: `${user.name || "Someone"} sent you a new message`,
    body: body,
  });

  return { success: true, redirect: `/messages/${conversationId}` };
}

export interface CreatedMessage {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  conversationId: string;
  sender: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
}

export async function sendMessage(
  conversationId: string,
  formData: FormData,
): Promise<SubmitResult | CreatedMessage> {
  const supabaseUser = await requireActiveUser(
    "Please log in to message a scholar.",
  );

  const rateLimit = await checkRateLimit({
    namespace: "message:send",
    key: supabaseUser.id,
    limit: 60,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  const body = readFormValue(formData, "body");

  if (!body) return { success: false, error: "Message body is required." };

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  });
  if (!user) return { success: false, error: "User not found." };

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId: user.id } },
    },
    select: { id: true, participants: { select: { userId: true } } },
  });

  if (!conversation)
    return { success: false, error: "Conversation not found." };

  // ⚡ BLOCK ENFORCEMENT (Issue 5): Dual-direction check — a block in either
  // direction must prevent the message from being created.
  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== user.id,
  );
  if (otherParticipant) {
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: otherParticipant.userId },
          { blockerId: otherParticipant.userId, blockedId: user.id },
        ],
      },
      select: { blockerId: true },
    });

    if (block) {
      return {
        success: false,
        error:
          block.blockerId === user.id
            ? "You have blocked this scholar. Unblock them to send messages."
            : "You cannot message this scholar.",
      };
    }
  }

  const createdMessage = await prisma.message.create({
    data: { conversationId, senderId: user.id, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      conversationId: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  if (conversation) {
    for (const participant of conversation.participants) {
      if (participant.userId !== user.id) {
        await notifyUserById({
          recipientId: participant.userId,
          actorId: user.id,
          type: "message-received",
          targetType: "conversation",
          targetId: conversationId,
          title: `${user.name || "Someone"} sent a new message`,
          body: body,
        });
      }
    }
  }

  return createdMessage;
}

export async function editMessage(
  messageId: string,
  newBody: string,
): Promise<SubmitResult | (CreatedMessage & { editedAt: Date | null })> {
  const supabaseUser = await requireActiveUser(
    "Please log in to edit a message.",
  );

  const rateLimit = await checkRateLimit({
    namespace: "message:edit",
    key: supabaseUser.id,
    limit: 30,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  const trimmed = newBody?.trim();
  if (!trimmed) return { success: false, error: "Message body is required." };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, conversationId: true, isDeleted: true },
  });

  // ⚡ ACADEMIC INTEGRITY: only the author may edit their own message.
  if (!message || message.senderId !== supabaseUser.id) {
    return { success: false, error: "You can only edit your own messages." };
  }

  if (message.isDeleted) {
    return { success: false, error: "Deleted messages cannot be edited." };
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body: trimmed, editedAt: new Date() },
    select: {
      id: true,
      body: true,
      createdAt: true,
      editedAt: true,
      senderId: true,
      conversationId: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  });

  // Realtime propagation happens via the Postgres Changes UPDATE listener in
  // MessageList — no extra broadcast plumbing required.
  return updated;
}

export async function deleteMessage(
  messageId: string,
): Promise<SubmitResult> {
  const supabaseUser = await requireActiveUser(
    "Please log in to delete a message.",
  );

  const rateLimit = await checkRateLimit({
    namespace: "message:delete",
    key: supabaseUser.id,
    limit: 30,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, isDeleted: true },
  });

  // ⚡ ACADEMIC INTEGRITY: only the author may delete their own message.
  if (!message || message.senderId !== supabaseUser.id) {
    return { success: false, error: "You can only delete your own messages." };
  }

  if (message.isDeleted) {
    return { success: true };
  }

  // ⚡ TOMBSTONE (RULE 4): Soft delete — blank the body for privacy and flag
  // the row so both clients render "This message was deleted".
  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, body: "" },
  });

  return { success: true };
}

export async function isUserBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  });
  return !!block;
}

export async function blockUser(blockedId: string) {
  const user = await requireCurrentUser("Please log in to block a scholar.");
  const rateLimit = await checkRateLimit({
    namespace: "message:block",
    key: user.id,
    limit: 20,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    throw new Error(RATE_LIMIT_ERROR);
  }

  if (user.id === blockedId) throw new Error("You cannot block yourself.");
  await prisma.block.create({ data: { blockerId: user.id, blockedId } });
}

export async function unblockUser(blockedId: string) {
  const user = await requireActiveUser("Please log in to unblock a scholar.");
  const rateLimit = await checkRateLimit({
    namespace: "message:unblock",
    key: user.id,
    limit: 20,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    throw new Error(RATE_LIMIT_ERROR);
  }

  await prisma.block.delete({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
  });
}

export async function getBlockedUserIds(blockerId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { blockerId },
    select: { blockedId: true },
  });
  return blocks.map((b) => b.blockedId);
}

// ⚡ NEW: Automatically mark conversation as read when opened
export async function markConversationAsRead(conversationId: string) {
  const supabaseUser = await requireActiveUser();
  if (!supabaseUser) return;

  const rateLimit = await checkRateLimit({
    namespace: "message:read",
    key: supabaseUser.id,
    limit: 120,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return;
  }

  await prisma.conversationParticipant
    .update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: supabaseUser.id,
        },
      },
      data: { lastReadAt: new Date() },
    })
    .catch(() => {
      // Fail silently if participant record doesn't match
    });
}
